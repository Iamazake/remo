const db = require('../config/db');

// GET /api/pagamentos (opcionalmente filtra por emprestimo_id)
async function listarPagamentos(req, res) {
  try {
    const { emprestimo_id } = req.query;

    let sql = `
      SELECT p.*, e.cliente_id, c.nome AS nome_cliente
      FROM pagamentos p
      JOIN emprestimos e ON e.id = p.emprestimo_id
      JOIN clientes c ON c.id = e.cliente_id
    `;
    const params = [];

    if (emprestimo_id) {
      sql += ' WHERE p.emprestimo_id = ?';
      params.push(emprestimo_id);
    }

    sql += ' ORDER BY p.data_prevista ASC, p.numero_parcela ASC';

    const [rows] = await db.query(sql, params);
    res.json(rows);
  } catch (err) {
    console.error('Erro ao listar pagamentos:', err);
    res.status(500).json({ error: 'Erro ao listar pagamentos.' });
  }
}

// GET /api/pagamentos/:id
async function buscarPagamento(req, res) {
  try {
    const { id } = req.params;

    const [rows] = await db.query(
      `
      SELECT p.*, e.cliente_id, c.nome AS nome_cliente
      FROM pagamentos p
      JOIN emprestimos e ON e.id = p.emprestimo_id
      JOIN clientes c ON c.id = e.cliente_id
      WHERE p.id = ?
      `,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Pagamento não encontrado.' });
    }

    res.json(rows[0]);
  } catch (err) {
    console.error('Erro ao buscar pagamento:', err);
    res.status(500).json({ error: 'Erro ao buscar pagamento.' });
  }
}

// POST /api/pagamentos/:id/pagar
async function registrarPagamento(req, res) {
  try {
    const { id } = req.params;
    let { data_pagamento, valor_pago, forma_pagamento, observacoes } = req.body;

    if (!data_pagamento || !valor_pago || !forma_pagamento) {
      return res.status(400).json({ error: 'Data, valor pago e forma de pagamento são obrigatórios.' });
    }

    valor_pago = parseFloat(valor_pago);

    // busca a parcela pra pegar data_prevista e valor original
    const [rows] = await db.query(
      'SELECT * FROM pagamentos WHERE id = ?',
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Parcela não encontrada.' });
    }

    const parcela = rows[0];

    // calcula dias de atraso (somente pra referência/relatório)
    const prev = new Date(parcela.data_prevista);
    const pag = new Date(data_pagamento);
    let diasAtraso = Math.floor((pag - prev) / (1000 * 60 * 60 * 24));
    if (isNaN(diasAtraso) || diasAtraso < 0) diasAtraso = 0;

    await db.query(
      `
      UPDATE pagamentos
      SET data_pagamento = ?, valor_pago = ?, forma_pagamento = ?, observacoes = ?, status = 'pago'
      WHERE id = ?
      `,
      [data_pagamento, valor_pago, forma_pagamento, observacoes || null, id]
    );

    // opcional: se todas as parcelas do empréstimo estiverem pagas, marcar o empréstimo como finalizado
    const [restantes] = await db.query(
      `SELECT COUNT(*) AS pendentes
       FROM pagamentos
       WHERE emprestimo_id = ? AND status <> 'pago'`,
      [parcela.emprestimo_id]
    );

    if (restantes[0].pendentes === 0) {
      await db.query(
        `UPDATE emprestimos SET status = 'finalizado' WHERE id = ?`,
        [parcela.emprestimo_id]
      );
    }

    res.json({
      message: 'Pagamento registrado com sucesso.',
      dias_atraso: diasAtraso
    });
  } catch (err) {
    console.error('Erro ao registrar pagamento:', err);
    res.status(500).json({ error: 'Erro ao registrar pagamento.' });
  }
}

module.exports = {
  listarPagamentos,
  buscarPagamento,
  registrarPagamento
};
