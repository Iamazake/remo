// src/controllers/solicitacoesController.js
const db = require('../config/db');

// ========== FUNÇÕES COMPARTILHADAS (mesmas do emprestimoController) ==========

// Tabela Price
function calcularParcelaPrice(valor, taxaPercent, qtdParcelas) {
  const n = qtdParcelas;
  const i = taxaPercent / 100; // ex.: 6.5 => 0.065

  if (n <= 0) return 0;

  // Sem juros
  if (i === 0) {
    return valor / n;
  }

  // P = (i * V) / (1 - (1 + i)^-n)
  const parcela = (i * valor) / (1 - Math.pow(1 + i, -n));
  return Math.round(parcela * 100) / 100; // 2 casas
}

// Gera lista de parcelas + data_fim
function gerarCronogramaParcelas(valorParcela, qtdParcelas, dataInicioISO, diaVencimento) {
  const itensParcelas = [];

  const dataInicio = new Date(dataInicioISO);
  let ano = dataInicio.getFullYear();
  let mes = dataInicio.getMonth(); // 0-11

  for (let k = 1; k <= qtdParcelas; k++) {
    mes += 1;
    if (mes > 11) {
      mes = 0;
      ano += 1;
    }

    const venc = new Date(ano, mes, diaVencimento);
    const data_prevista = venc.toISOString().split('T')[0]; // YYYY-MM-DD

    itensParcelas.push({
      numero_parcela: k,
      data_prevista,
      valor: Math.round(valorParcela * 100) / 100
    });
  }

  const data_fim =
    itensParcelas.length > 0
      ? itensParcelas[itensParcelas.length - 1].data_prevista
      : dataInicioISO;

  return { itensParcelas, data_fim };
}


// helper de permissão
function exigirPerfil(req, res, perfisPermitidos) {
  const perfil = req.user?.perfil;

  if (!perfil || !perfisPermitidos.includes(perfil)) {
    return res.status(403).json({ error: 'Permissão negada.' });
  }
  return null;
}

// ======================================================
// POST /api/solicitacoes
// AGENTE / ADMIN cria solicitação (rascunho)
// ======================================================
exports.criarSolicitacao = async (req, res) => {
  try {
    const erroPerm = exigirPerfil(req, res, ['agente', 'admin']);
    if (erroPerm) return;

    const { cliente_id, tabela_juros_id, valor_solicitado, parcelas_solicitadas, taxa_prevista } = req.body;
    const usuarioId = req.user.id;

    if (!cliente_id || !valor_solicitado || !parcelas_solicitadas) {
      return res.status(400).json({ error: 'cliente_id, valor_solicitado e parcelas_solicitadas são obrigatórios.' });
    }

    const [result] = await db.execute(
      `INSERT INTO solicitacoes_emprestimo
        (cliente_id, tabela_juros_id, valor_solicitado, parcelas_solicitadas, taxa_prevista, criado_por)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [cliente_id, tabela_juros_id || null, valor_solicitado, parcelas_solicitadas, taxa_prevista || null, usuarioId]
    );

    return res.status(201).json({ id: result.insertId });
  } catch (err) {
    console.error('[SOLIC] Erro ao criar solicitação:', err);
    return res.status(500).json({ error: 'Erro ao criar solicitação.' });
  }
};

// ======================================================
// GET /api/solicitacoes
// Lista com filtro por perfil
// - admin: vê tudo
// - agente: só as que criou
// - analista: que estejam enviadas/em_analise/aprovadas
// - financeiro: aprovadas/liberadas
// ======================================================
exports.listarSolicitacoes = async (req, res) => {
  try {
    const perfil = req.user.perfil;
    const usuarioId = req.user.id;

    let where = '1=1';
    const params = [];

    if (perfil === 'agente') {
      where = 'criado_por = ?';
      params.push(usuarioId);
    } else if (perfil === 'analista') {
      where = "status_solicitacao IN ('enviado','em_analise','aprovado')";
    } else if (perfil === 'financeiro') {
      where = "status_solicitacao IN ('aprovado','liberado')";
    } else if (perfil === 'admin') {
      // vê tudo
    }

    const [rows] = await db.execute(
      `SELECT se.*, c.nome AS nome_cliente, u.nome AS nome_criador
         FROM solicitacoes_emprestimo se
         JOIN clientes c ON c.id = se.cliente_id
         JOIN usuarios u ON u.id = se.criado_por
        WHERE ${where}
        ORDER BY se.id DESC`,
      params
    );

    return res.json(rows);
  } catch (err) {
    console.error('[SOLIC] Erro ao listar solicitações:', err);
    return res.status(500).json({ error: 'Erro ao listar solicitações.' });
  }
};

// ======================================================
// GET /api/solicitacoes/:id
// Detalhe da solicitação + anexos
// ======================================================
exports.obterSolicitacao = async (req, res) => {
  try {
    const { id } = req.params;
    const perfil = req.user.perfil;
    const usuarioId = req.user.id;

    const [rows] = await db.execute(
      `SELECT se.*, c.nome AS nome_cliente
         FROM solicitacoes_emprestimo se
         JOIN clientes c ON c.id = se.cliente_id
        WHERE se.id = ?`,
      [id]
    );

    if (!rows.length) return res.status(404).json({ error: 'Solicitação não encontrada.' });

    const solicitacao = rows[0];

    // Restrição básica para agente: só pode ver as dele
    if (perfil === 'agente' && solicitacao.criado_por !== usuarioId) {
      return res.status(403).json({ error: 'Permissão negada.' });
    }

    const [anexos] = await db.execute(
      `SELECT a.*
         FROM solicitacoes_emprestimo_anexos a
        WHERE a.solicitacao_id = ?`,
      [id]
    );

    solicitacao.anexos = anexos;

    return res.json(solicitacao);
  } catch (err) {
    console.error('[SOLIC] Erro ao obter solicitação:', err);
    return res.status(500).json({ error: 'Erro ao buscar solicitação.' });
  }
};

// ======================================================
// POST /api/solicitacoes/:id/enviar-para-analise
// AGENTE (dono da solicitação) / ADMIN
// ======================================================
exports.enviarParaAnalise = async (req, res) => {
  try {
    const perfil = req.user.perfil;
    const usuarioId = req.user.id;
    const { id } = req.params;

    const [rows] = await db.execute(
      'SELECT * FROM solicitacoes_emprestimo WHERE id = ?',
      [id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Solicitação não encontrada.' });

    const solic = rows[0];

    if (perfil === 'agente' && solic.criado_por !== usuarioId) {
      return res.status(403).json({ error: 'Você não pode enviar essa solicitação.' });
    }
    if (!['rascunho', 'reprovado'].includes(solic.status_solicitacao)) {
      return res.status(400).json({ error: 'Somente rascunhos ou reprovados podem ser enviados para análise.' });
    }

    // TODO: aqui dá pra validar se já tem anexos obrigatórios

    await db.execute(
      `UPDATE solicitacoes_emprestimo
          SET status_solicitacao = 'enviado'
        WHERE id = ?`,
      [id]
    );

    return res.json({ message: 'Solicitação enviada para análise.' });
  } catch (err) {
    console.error('[SOLIC] Erro ao enviar para análise:', err);
    return res.status(500).json({ error: 'Erro ao enviar para análise.' });
  }
};

// ======================================================
// POST /api/solicitacoes/:id/aprovar
// ANALISTA / ADMIN
// Agora cria de verdade um EMPRESTIMO + PARCELAS
// e vincula na solicitação (emprestimo_id)
// ======================================================
exports.aprovarSolicitacao = async (req, res) => {
  let conn;
  try {
    const erroPerm = exigirPerfil(req, res, ['analista', 'admin']);
    if (erroPerm) return;

    const { id } = req.params;
    const usuarioId = req.user.id;

    // 1) Busca a solicitação
    const [rows] = await db.query(
      'SELECT * FROM solicitacoes_emprestimo WHERE id = ?',
      [id]
    );
    if (!rows.length) {
      return res.status(404).json({ error: 'Solicitação não encontrada.' });
    }

    const solic = rows[0];

    if (!['enviado', 'em_analise'].includes(solic.status_solicitacao)) {
      return res.status(400).json({ error: 'Somente solicitações enviadas/em análise podem ser aprovadas.' });
    }

    // Se já tiver emprestimo_id vinculado, não cria outro
    if (solic.emprestimo_id) {
      await db.query(
        `UPDATE solicitacoes_emprestimo
           SET status_solicitacao = 'aprovado',
               analisado_por = ?,
               analisado_em = NOW(),
               motivo_recusa = NULL
         WHERE id = ?`,
        [usuarioId, id]
      );

      return res.json({
        message: 'Solicitação aprovada. Empréstimo já estava vinculado anteriormente.',
        emprestimo_id: solic.emprestimo_id
      });
    }

    // 2) Dados base para criar empréstimo
    const cliente_id = solic.cliente_id;
    let valor_total = parseFloat(solic.valor_solicitado);
    let parcelas = parseInt(solic.parcelas_solicitadas, 10);
    let tabela_juros_id = solic.tabela_juros_id ? parseInt(solic.tabela_juros_id, 10) : null;
    let taxaPrevista = solic.taxa_prevista != null ? parseFloat(solic.taxa_prevista) : NaN;

    if (!cliente_id || Number.isNaN(valor_total) || Number.isNaN(parcelas) || parcelas <= 0) {
      return res.status(400).json({ error: 'Dados da solicitação inválidos para criar empréstimo.' });
    }

    // MODO DEV: enquanto a solicitação não tem esses campos,
    // usamos padrões (depois vamos guardar isso na própria solicitação)
    const hoje = new Date();
    const data_inicio = hoje.toISOString().split('T')[0]; // YYYY-MM-DD
    const dia_vencimento = 5; // 🔧 TODO: trazer isso da solicitação futuramente
    const statusEmp = 'ativo';
    const observacoes = solic.observacoes_internas || null;

    // 3) Definir taxaFinal (mesma lógica do emprestimoController)
    let taxaFinal = taxaPrevista;

    if (!tabela_juros_id && (Number.isNaN(taxaFinal))) {
      return res.status(400).json({
        error: 'Solicitação não possui taxa prevista nem tabela de juros.'
      });
    }

    if (tabela_juros_id) {
      // valida tabela
      const [tabRows] = await db.query(
        'SELECT id FROM tabelas_juros WHERE id = ?',
        [tabela_juros_id]
      );
      if (!tabRows.length) {
        return res.status(400).json({ error: 'Tabela de juros da solicitação não encontrada.' });
      }

      // busca faixas
      const [faixas] = await db.query(
        `
        SELECT parcela_de, parcela_ate, taxa
        FROM tabelas_juros_faixas
        WHERE tabela_id = ?
        ORDER BY parcela_de ASC
        `,
        [tabela_juros_id]
      );

      if (!faixas.length) {
        return res.status(400).json({
          error: 'A tabela de juros da solicitação não possui faixas definidas.'
        });
      }

      const faixa = faixas.find(f =>
        parcelas >= Number(f.parcela_de) &&
        parcelas <= Number(f.parcela_ate)
      );

      if (!faixa) {
        const maxParcela = Math.max(...faixas.map(f => Number(f.parcela_ate)));
        return res.status(400).json({
          error: `A tabela de juros da solicitação só está configurada até ${maxParcela} parcelas.`
        });
      }

      taxaFinal = parseFloat(faixa.taxa);
    }

    if (Number.isNaN(taxaFinal)) {
      return res.status(400).json({ error: 'Taxa de juros inválida na solicitação.' });
    }

    // 4) Calcula parcela + cronograma (mesma fórmula do emprestimoController)
    const valor_parcela = calcularParcelaPrice(valor_total, taxaFinal, parcelas);

    const { itensParcelas, data_fim } = gerarCronogramaParcelas(
      valor_parcela,
      parcelas,
      data_inicio,
      dia_vencimento
    );

    // 5) Transação: cria empréstimo + parcelas + atualiza solicitação
    conn = await db.getConnection();
    await conn.beginTransaction();

    // 5.1 Inserir empréstimo
    const sqlEmp = `
      INSERT INTO emprestimos
        (cliente_id, tabela_juros_id, valor_total, parcelas, valor_parcela, taxa,
         data_inicio, dia_vencimento, data_fim, status, observacoes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const [resultEmp] = await conn.query(sqlEmp, [
      cliente_id,
      tabela_juros_id || null,
      valor_total,
      parcelas,
      valor_parcela,
      taxaFinal,
      data_inicio,
      dia_vencimento,
      data_fim,
      statusEmp,
      observacoes
    ]);

    const emprestimoId = resultEmp.insertId;

    // 5.2 Inserir parcelas em pagamentos
    const sqlPag = `
      INSERT INTO pagamentos
        (emprestimo_id, numero_parcela, valor, data_prevista, status)
      VALUES (?, ?, ?, ?, 'pendente')
    `;

    for (const p of itensParcelas) {
      await conn.query(sqlPag, [
        emprestimoId,
        p.numero_parcela,
        p.valor,
        p.data_prevista
      ]);
    }

    // 5.3 Atualizar solicitação (status + quem aprovou + emprestimo_id)
    await conn.query(
      `
      UPDATE solicitacoes_emprestimo
         SET status_solicitacao = 'aprovado',
             analisado_por = ?,
             analisado_em = NOW(),
             motivo_recusa = NULL,
             emprestimo_id = ?
       WHERE id = ?
      `,
      [usuarioId, emprestimoId, id]
    );

    await conn.commit();

    return res.json({
      message: 'Solicitação aprovada e empréstimo criado com sucesso.',
      emprestimo_id: emprestimoId
    });
  } catch (err) {
    console.error('[SOLIC] Erro ao aprovar (criando empréstimo):', err);
    if (conn) {
      try {
        await conn.rollback();
      } catch (e) {
        console.error('Erro ao fazer rollback na aprovação da solicitação:', e);
      }
    }
    return res.status(500).json({ error: 'Erro ao aprovar solicitação e criar empréstimo.' });
  } finally {
    if (conn) conn.release && conn.release();
  }
};


// ======================================================
// POST /api/solicitacoes/:id/reprovar
// ANALISTA / ADMIN
// body: { motivo_recusa }
// ======================================================
exports.reprovarSolicitacao = async (req, res) => {
  try {
    const erroPerm = exigirPerfil(req, res, ['analista', 'admin']);
    if (erroPerm) return;

    const { id } = req.params;
    const motivoLimpo = (req.body?.motivo_recusa || "").toString().trim();
    const usuarioId = req.user.id;

    const [rows] = await db.execute(
      'SELECT * FROM solicitacoes_emprestimo WHERE id = ?',
      [id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Solicitação não encontrada.' });

    if (!['enviado', 'em_analise', 'aprovado'].includes(rows[0].status_solicitacao)) {
      return res.status(400).json({ error: 'Status atual não permite reprovação.' });
    }

    await db.execute(
      `UPDATE solicitacoes_emprestimo
          SET status_solicitacao = 'reprovado',
              analisado_por = ?,
              analisado_em = NOW(),
              motivo_recusa = ?
        WHERE id = ?`,
      [usuarioId, motivoLimpo || null, id]
    );

    return res.json({
      message: 'Solicitação reprovada.',
      motivo_recusa: motivoLimpo || null,
    });
  } catch (err) {
    console.error('[SOLIC] Erro ao reprovar solicitação:', err);
    return res.status(500).json({ error: 'Erro ao reprovar solicitação.' });
  }
};

// ======================================================
// POST /api/solicitacoes/:id/liberar
// FINANCEIRO / ADMIN
// body: { forma_liberacao, conta_destino }
// Só pode liberar se estiver APROVADO
// ======================================================
// ======================================================
// POST /api/solicitacoes/:id/liberar
// FINANCEIRO / ADMIN
// body: { forma_liberacao }
// Só pode liberar se estiver APROVADO
// ======================================================
exports.liberarSolicitacao = async (req, res) => {
  let conn;
  try {
    const erroPerm = exigirPerfil(req, res, ['financeiro', 'admin']);
    if (erroPerm) return;

    const { id } = req.params;
    const { forma_liberacao } = req.body;
    const usuarioId = req.user.id;

    if (!forma_liberacao) {
      return res.status(400).json({ error: 'Informe a forma de liberação.' });
    }

    // 1) Busca apenas a solicitação
    const [solicRows] = await db.query(
      'SELECT * FROM solicitacoes_emprestimo WHERE id = ?',
      [id]
    );
    if (!solicRows.length) {
      return res.status(404).json({ error: 'Solicitação não encontrada.' });
    }

    const solic = solicRows[0];

    if (solic.status_solicitacao !== 'aprovado') {
      return res.status(400).json({
        error: 'Somente solicitações aprovadas podem ser liberadas.'
      });
    }

    if (!solic.emprestimo_id) {
      return res.status(400).json({
        error: 'Solicitação ainda não possui empréstimo vinculado. Aprove a solicitação antes de liberar.'
      });
    }

    // 2) Garante que o empréstimo existe e pega o cliente
    const [empRows] = await db.query(
      'SELECT id, cliente_id FROM emprestimos WHERE id = ?',
      [solic.emprestimo_id]
    );
    if (!empRows.length) {
      return res.status(400).json({ error: 'Empréstimo vinculado não encontrado.' });
    }

    const emprestimo = empRows[0];

    // 3) Busca conta principal do cliente (campos corretos)
    const [contas] = await db.query(
      `
      SELECT banco, agencia, conta, tipo_conta
        FROM contas_bancarias_cliente
       WHERE cliente_id = ? AND principal = 1
       LIMIT 1
      `,
      [emprestimo.cliente_id]
    );


    if (!contas.length) {
      return res.status(400).json({
        error: 'Cliente não possui conta bancária principal cadastrada.'
      });
    }

    const conta = contas[0];

    const contaDestinoTexto =
      `${conta.banco} / ag: ${conta.agencia} / conta: ${conta.conta} (${conta.tipo_conta})`;


    // 4) Transação: marca solicitação como liberada + ativa empréstimo
    conn = await db.getConnection();
    await conn.beginTransaction();

    await conn.query(
      `
      UPDATE solicitacoes_emprestimo
         SET status_solicitacao = 'liberado',
             liberado_por = ?,
             liberado_em = NOW(),
             forma_liberacao = ?,
             conta_destino = ?
       WHERE id = ?
      `,
      [usuarioId, forma_liberacao, contaDestinoTexto, id]
    );

    await conn.query(
      `UPDATE emprestimos SET status = 'ativo' WHERE id = ?`,
      [emprestimo.id]
    );

    await conn.commit();

    return res.json({
      message: 'Solicitação liberada com sucesso.',
      forma_liberacao,
      conta_destino: contaDestinoTexto
    });
  } catch (err) {
    console.error('[SOLIC] Erro ao liberar:', err);
    if (conn) {
      try { await conn.rollback(); } catch (e) {
        console.error('Erro ao fazer rollback na liberação:', e);
      }
    }
    return res.status(500).json({ error: 'Erro ao liberar solicitação.' });
  } finally {
    if (conn && conn.release) conn.release();
  }
};



// ======================================================
// POST /api/solicitacoes/:id/anexos
// AGENTE / ADMIN
// body: { tipo_documento, caminho_arquivo, observacoes }
// (modo DEV: caminho_arquivo vem pronto; depois você integra com upload de arquivo)
// ======================================================
exports.adicionarAnexo = async (req, res) => {
  try {
    const erroPerm = exigirPerfil(req, res, ['agente', 'admin']);
    if (erroPerm) return;

    const { id } = req.params;
    const { tipo_documento, caminho_arquivo, observacoes } = req.body;
    const usuarioId = req.user.id;

    if (!tipo_documento || !caminho_arquivo) {
      return res.status(400).json({ error: 'tipo_documento e caminho_arquivo são obrigatórios.' });
    }

    const [rows] = await db.execute(
      'SELECT * FROM solicitacoes_emprestimo WHERE id = ?',
      [id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Solicitação não encontrada.' });

    await db.execute(
      `INSERT INTO solicitacoes_emprestimo_anexos
        (solicitacao_id, tipo_documento, caminho_arquivo, enviado_por, observacoes)
       VALUES (?, ?, ?, ?, ?)`,
      [id, tipo_documento, caminho_arquivo, usuarioId, observacoes || null]
    );

    return res.status(201).json({ message: 'Anexo registrado com sucesso.' });
  } catch (err) {
    console.error('[SOLIC] Erro ao adicionar anexo:', err);
    return res.status(500).json({ error: 'Erro ao adicionar anexo.' });
  }
};
