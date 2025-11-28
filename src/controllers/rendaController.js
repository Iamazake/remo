const db = require("../config/db");
const { toNullableDecimal } = require("../utils/valueHelpers");

function criarErro(mensagem, status = 400) {
  const err = new Error(mensagem);
  err.statusCode = status;
  return err;
}

async function garantirClienteExiste(clienteId) {
  const [rows] = await db.query("SELECT id FROM clientes WHERE id = ?", [clienteId]);
  if (!rows.length) {
    throw criarErro("Cliente não encontrado.", 404);
  }
}

function calcularRenda(bruto, descontos) {
  const salarioLiquido = bruto - descontos;
  const margemDisponivel = Math.max(0, bruto * 0.3 - descontos);
  return {
    salario_liquido: Number(salarioLiquido.toFixed(2)),
    margem_disponivel: Number(margemDisponivel.toFixed(2)),
  };
}

async function obterPorCliente(req, res) {
  try {
    const clienteId = req.params.clienteId || req.params.id;
    await garantirClienteExiste(clienteId);

    const [rows] = await db.query(
      "SELECT salario_bruto, descontos_emprestimos, salario_liquido, margem_disponivel FROM renda_cliente WHERE cliente_id = ?",
      [clienteId]
    );

    if (!rows.length) {
      return res.json(null);
    }

    return res.json(rows[0]);
  } catch (err) {
    console.error("Erro ao obter renda:", err);
    const status = err.statusCode || 500;
    return res.status(status).json({ error: err.message || "Erro ao obter renda." });
  }
}

async function salvarRenda(req, res) {
  try {
    const clienteId = req.params.clienteId || req.params.id;
    await garantirClienteExiste(clienteId);

    const bruto = toNullableDecimal(req.body.salario_bruto);
    if (bruto === null) {
      throw criarErro("Salário bruto inválido.");
    }

    let descontos = toNullableDecimal(req.body.descontos_emprestimos);
    if (descontos === null) descontos = 0;

    if (descontos < 0) {
      throw criarErro("Descontos de empréstimos não podem ser negativos.");
    }

    const calculos = calcularRenda(bruto, descontos);

    const sql = `
      INSERT INTO renda_cliente (
        cliente_id,
        salario_bruto,
        descontos_emprestimos,
        salario_liquido,
        margem_disponivel
      )
      VALUES (?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        salario_bruto = VALUES(salario_bruto),
        descontos_emprestimos = VALUES(descontos_emprestimos),
        salario_liquido = VALUES(salario_liquido),
        margem_disponivel = VALUES(margem_disponivel)
    `;

    await db.query(sql, [
      clienteId,
      bruto,
      descontos,
      calculos.salario_liquido,
      calculos.margem_disponivel,
    ]);

    return res.json({
      salario_bruto: bruto,
      descontos_emprestimos: descontos,
      ...calculos,
    });
  } catch (err) {
    console.error("Erro ao salvar renda:", err);
    const status = err.statusCode || 500;
    return res.status(status).json({ error: err.message || "Erro ao salvar renda." });
  }
}

module.exports = {
  obterPorCliente,
  salvarRenda,
};
