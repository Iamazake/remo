const db = require('../config/db');
const { calcularRecomendacaoEmprestimo } = require('../services/creditoService');

// ========================= FUNÇÕES UTIL =========================

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
  // arredonda pra 2 casas decimais
  return Math.round(parcela * 100) / 100;
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

// ========================= CONTROLLERS =========================

// GET /api/emprestimos
async function listarEmprestimos(req, res) {
  try {
    const sql = `
      SELECT 
        e.*,
        c.nome AS nome_cliente,
        tj.nome AS nome_tabela_juros
      FROM emprestimos e
      JOIN clientes c ON c.id = e.cliente_id
      LEFT JOIN tabelas_juros tj ON tj.id = e.tabela_juros_id
      ORDER BY e.id DESC
    `;

    const [rows] = await db.query(sql);
    res.json(rows);
  } catch (err) {
    console.error('Erro ao listar empréstimos:', err);
    res.status(500).json({ error: 'Erro ao listar empréstimos.' });
  }
}

// GET /api/emprestimos/:id
async function buscarEmprestimoPorId(req, res) {
  try {
    const { id } = req.params;

    const sql = `
      SELECT e.*, c.nome AS nome_cliente
      FROM emprestimos e
      JOIN clientes c ON c.id = e.cliente_id
      WHERE e.id = ?
    `;
    const [rows] = await db.query(sql, [id]);

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Empréstimo não encontrado.' });
    }

    res.json(rows[0]);
  } catch (err) {
    console.error('Erro ao buscar empréstimo:', err);
    res.status(500).json({ error: 'Erro ao buscar empréstimo.' });
  }
}

// POST /api/emprestimos
async function criarEmprestimo(req, res) {
  let conn;
  try {
    let {
      cliente_id,
      valor_total,
      taxa,              // % ao mês (opcional se tiver tabela_juros_id)
      parcelas,
      data_inicio,
      dia_vencimento,
      status,
      observacoes,
      tabela_juros_id    // 🔹 novo
    } = req.body;

    if (!cliente_id || !valor_total || !parcelas || !data_inicio || !dia_vencimento) {
      return res.status(400).json({ error: 'Campos obrigatórios não preenchidos.' });
    }

    valor_total = parseFloat(valor_total);
    parcelas = parseInt(parcelas, 10);
    dia_vencimento = parseInt(dia_vencimento, 10);

    // tabela_juros_id pode vir string
    tabela_juros_id = tabela_juros_id ? parseInt(tabela_juros_id, 10) : null;

    if (Number.isNaN(valor_total) || Number.isNaN(parcelas) || parcelas <= 0) {
      return res.status(400).json({ error: 'Valores inválidos para valor ou parcelas.' });
    }

    // =========================================================
    // 🔍 Definir taxaFinal
    //    - se tiver tabela_juros_id → pega da faixa
    //    - se NÃO tiver tabela_juros_id → usa taxa enviada
    // =========================================================
    let taxaFinal = taxa !== undefined && taxa !== null && taxa !== ''
      ? parseFloat(taxa)
      : NaN;

    if (!tabela_juros_id && (Number.isNaN(taxaFinal))) {
      return res.status(400).json({
        error: 'Informe a taxa de juros ou selecione uma tabela de juros.'
      });
    }

    if (tabela_juros_id) {
      // valida tabela
      const [tabRows] = await db.query(
        'SELECT id FROM tabelas_juros WHERE id = ?',
        [tabela_juros_id]
      );
      if (!tabRows.length) {
        return res.status(400).json({ error: 'Tabela de juros não encontrada.' });
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
          error: 'A tabela de juros não possui faixas definidas.'
        });
      }

      // procura faixa em que a quantidade de parcelas se encaixa
      const faixa = faixas.find(f =>
        parcelas >= Number(f.parcela_de) &&
        parcelas <= Number(f.parcela_ate)
      );

      if (!faixa) {
        const maxParcela = Math.max(...faixas.map(f => Number(f.parcela_ate)));
        return res.status(400).json({
          error: `Essa tabela de juros só está configurada até ${maxParcela} parcelas.`
        });
      }

      taxaFinal = parseFloat(faixa.taxa);
    }

    if (Number.isNaN(taxaFinal)) {
      return res.status(400).json({ error: 'Taxa de juros inválida.' });
    }

    // =========================================================
    // 🧮 Cálculo da parcela (Price) + cronograma
    // =========================================================
    const valor_parcela = calcularParcelaPrice(valor_total, taxaFinal, parcelas);

    const { itensParcelas, data_fim } = gerarCronogramaParcelas(
      valor_parcela,
      parcelas,
      data_inicio,
      dia_vencimento
    );

    conn = await db.getConnection();
    await conn.beginTransaction();

    // Inserir empréstimo
    const sqlEmp = `
      INSERT INTO emprestimos
        (cliente_id, tabela_juros_id, valor_total, parcelas, valor_parcela, taxa,
         data_inicio, dia_vencimento, data_fim, status, observacoes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const [result] = await conn.query(sqlEmp, [
      cliente_id,
      tabela_juros_id || null,
      valor_total,
      parcelas,
      valor_parcela,
      taxaFinal,
      data_inicio,
      dia_vencimento,
      data_fim,
      status || 'ativo',
      observacoes || null
    ]);

    const emprestimoId = result.insertId;

    // Inserir parcelas na tabela pagamentos
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

    await conn.commit();

    res.status(201).json({
      id: emprestimoId,
      message: 'Empréstimo criado com sucesso com parcelas geradas automaticamente.'
    });
  } catch (err) {
    console.error('Erro ao criar empréstimo:', err);
    if (conn) {
      try {
        await conn.rollback();
      } catch (e) {
        console.error('Erro ao fazer rollback:', e);
      }
    }
    res.status(500).json({ error: 'Erro ao criar empréstimo.' });
  } finally {
    if (conn) conn.release();
  }
}


// PUT /api/emprestimos/:id
async function atualizarEmprestimo(req, res) {
  let conn;
  try {
    const { id } = req.params;
    let {
      cliente_id,
      valor_total,
      taxa,
      parcelas,
      data_inicio,
      dia_vencimento,
      status,
      observacoes,
      recalcularParcelas,  // boolean opcional
      tabela_juros_id      // 🔹 novo
    } = req.body;

    valor_total = parseFloat(valor_total);
    parcelas = parseInt(parcelas, 10);
    dia_vencimento = parseInt(dia_vencimento, 10);
    tabela_juros_id = tabela_juros_id ? parseInt(tabela_juros_id, 10) : null;

    if (Number.isNaN(valor_total) || Number.isNaN(parcelas) || parcelas <= 0) {
      return res.status(400).json({ error: 'Valores inválidos para valor ou parcelas.' });
    }

    // =========================================================
    // 🔍 Definir taxaFinal (igual na criação)
    // =========================================================
    let taxaFinal = taxa !== undefined && taxa !== null && taxa !== ''
      ? parseFloat(taxa)
      : NaN;

    if (!tabela_juros_id && (Number.isNaN(taxaFinal))) {
      return res.status(400).json({
        error: 'Informe a taxa de juros ou selecione uma tabela de juros.'
      });
    }

    if (tabela_juros_id) {
      const [tabRows] = await db.query(
        'SELECT id FROM tabelas_juros WHERE id = ?',
        [tabela_juros_id]
      );
      if (!tabRows.length) {
        return res.status(400).json({ error: 'Tabela de juros não encontrada.' });
      }

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
          error: 'A tabela de juros não possui faixas definidas.'
        });
      }

      const faixa = faixas.find(f =>
        parcelas >= Number(f.parcela_de) &&
        parcelas <= Number(f.parcela_ate)
      );

      if (!faixa) {
        const maxParcela = Math.max(...faixas.map(f => Number(f.parcela_ate)));
        return res.status(400).json({
          error: `Essa tabela de juros só está configurada até ${maxParcela} parcelas.`
        });
      }

      taxaFinal = parseFloat(faixa.taxa);
    }

    if (Number.isNaN(taxaFinal)) {
      return res.status(400).json({ error: 'Taxa de juros inválida.' });
    }

    const valor_parcela = calcularParcelaPrice(valor_total, taxaFinal, parcelas);
    const { itensParcelas, data_fim } = gerarCronogramaParcelas(
      valor_parcela,
      parcelas,
      data_inicio,
      dia_vencimento
    );

    conn = await db.getConnection();
    await conn.beginTransaction();

    const sql = `
      UPDATE emprestimos
      SET cliente_id = ?, tabela_juros_id = ?, valor_total = ?, parcelas = ?, valor_parcela = ?, taxa = ?,
          data_inicio = ?, dia_vencimento = ?, data_fim = ?, status = ?, observacoes = ?
      WHERE id = ?
    `;

    const [result] = await conn.query(sql, [
      cliente_id,
      tabela_juros_id || null,
      valor_total,
      parcelas,
      valor_parcela,
      taxaFinal,
      data_inicio,
      dia_vencimento,
      data_fim,
      status,
      observacoes || null,
      id
    ]);

    if (result.affectedRows === 0) {
      await conn.rollback();
      return res.status(404).json({ error: 'Empréstimo não encontrado.' });
    }

    // Se quiser recalcular parcelas (ex.: mudou taxa, valor ou quantidade)
    if (recalcularParcelas) {
      await conn.query(
        `DELETE FROM pagamentos
         WHERE emprestimo_id = ? AND status = 'pendente'`,
        [id]
      );

      const sqlPag = `
        INSERT INTO pagamentos
          (emprestimo_id, numero_parcela, valor, data_prevista, status)
        VALUES (?, ?, ?, ?, 'pendente')
      `;

      for (const p of itensParcelas) {
        await conn.query(sqlPag, [
          id,
          p.numero_parcela,
          p.valor,
          p.data_prevista
        ]);
      }
    }

    await conn.commit();

    res.json({ message: 'Empréstimo atualizado com sucesso.' });
  } catch (err) {
    console.error('Erro ao atualizar empréstimo:', err);
    if (conn) {
      try {
        await conn.rollback();
      } catch (e) {
        console.error('Erro ao fazer rollback:', e);
      }
    }
    res.status(500).json({ error: 'Erro ao atualizar empréstimo.' });
  } finally {
    if (conn) conn.release();
  }
}


// DELETE /api/emprestimos/:id
async function excluirEmprestimo(req, res) {
  try {
    const { id } = req.params;

    const [result] = await db.query(
      'DELETE FROM emprestimos WHERE id = ?',
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Empréstimo não encontrado.' });
    }

    // pagamentos é apagado automaticamente por causa do ON DELETE CASCADE
    res.json({ message: 'Empréstimo excluído com sucesso.' });
  } catch (err) {
    console.error('Erro ao excluir empréstimo:', err);
    res.status(500).json({ error: 'Erro ao excluir empréstimo.' });
  }
}

// GET /api/emprestimos/recomendacao/:clienteId
async function recomendarPorCliente(req, res) {
  try {
    const { clienteId } = req.params;

    // Busca renda e situação profissional do cliente
    const [rows] = await db.query(
      "SELECT renda_mensal, situacao_profissional FROM clientes WHERE id = ?",
      [clienteId]
    );

    if (!rows.length) {
      return res.status(404).json({ error: "Cliente não encontrado." });
    }

    const cliente = rows[0];

    const rec = calcularRecomendacaoEmprestimo(
      cliente.renda_mensal,
      cliente.situacao_profissional
    );

    return res.json({
      clienteId,
      renda_mensal: cliente.renda_mensal,
      situacao_profissional: cliente.situacao_profissional,
      valor_recomendado: rec.valor,
      parcela_maxima: rec.parcelaMaxima
    });

  } catch (err) {
    console.error("Erro ao recomendar empréstimo:", err);
    return res.status(500).json({ error: "Erro ao recomendar empréstimo." });
  }
}


module.exports = {
  listarEmprestimos,
  buscarEmprestimoPorId,
  criarEmprestimo,
  atualizarEmprestimo,
  excluirEmprestimo,
  recomendarPorCliente
};
