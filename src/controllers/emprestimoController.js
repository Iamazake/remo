const db = require('../config/db');

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
      SELECT e.*, c.nome AS nome_cliente
      FROM emprestimos e
      JOIN clientes c ON c.id = e.cliente_id
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
      taxa,          // % ao mês
      parcelas,
      data_inicio,
      dia_vencimento,
      status,
      observacoes
    } = req.body;

    if (!cliente_id || !valor_total || taxa === undefined || !parcelas || !data_inicio || !dia_vencimento) {
      return res.status(400).json({ error: 'Campos obrigatórios não preenchidos.' });
    }

    valor_total = parseFloat(valor_total);
    taxa = parseFloat(taxa);
    parcelas = parseInt(parcelas, 10);
    dia_vencimento = parseInt(dia_vencimento, 10);

    if (Number.isNaN(valor_total) || Number.isNaN(taxa) || Number.isNaN(parcelas) || parcelas <= 0) {
      return res.status(400).json({ error: 'Valores inválidos para valor, taxa ou parcelas.' });
    }

    const valor_parcela = calcularParcelaPrice(valor_total, taxa, parcelas);

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
        (cliente_id, valor_total, parcelas, valor_parcela, taxa,
         data_inicio, dia_vencimento, data_fim, status, observacoes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const [result] = await conn.query(sqlEmp, [
      cliente_id,
      valor_total,
      parcelas,
      valor_parcela,
      taxa,
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
      recalcularParcelas // boolean opcional
    } = req.body;

    valor_total = parseFloat(valor_total);
    taxa = parseFloat(taxa);
    parcelas = parseInt(parcelas, 10);
    dia_vencimento = parseInt(dia_vencimento, 10);

    if (Number.isNaN(valor_total) || Number.isNaN(taxa) || Number.isNaN(parcelas) || parcelas <= 0) {
      return res.status(400).json({ error: 'Valores inválidos para valor, taxa ou parcelas.' });
    }

    const valor_parcela = calcularParcelaPrice(valor_total, taxa, parcelas);
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
      SET cliente_id = ?, valor_total = ?, parcelas = ?, valor_parcela = ?, taxa = ?,
          data_inicio = ?, dia_vencimento = ?, data_fim = ?, status = ?, observacoes = ?
      WHERE id = ?
    `;

    const [result] = await conn.query(sql, [
      cliente_id,
      valor_total,
      parcelas,
      valor_parcela,
      taxa,
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
      // Apaga só as parcelas pendentes
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

module.exports = {
  listarEmprestimos,
  buscarEmprestimoPorId,
  criarEmprestimo,
  atualizarEmprestimo,
  excluirEmprestimo
};
