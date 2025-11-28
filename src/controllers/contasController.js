const db = require("../config/db");
const dominiosService = require("../services/dominiosService");

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

async function validarContaPayload(payload = {}) {
  let {
    banco,
    agencia,
    conta,
    digito,
    tipo_conta,
    principal,
  } = payload;

  banco = banco === undefined || banco === null ? "" : String(banco).trim();
  agencia = agencia === undefined || agencia === null ? "" : String(agencia).trim();
  conta = conta === undefined || conta === null ? "" : String(conta).trim();
  digito = digito === undefined || digito === null ? null : String(digito).trim();

  if (!banco) throw criarErro("Informe o banco.");
  if (!agencia) throw criarErro("Informe a agência.");
  if (!conta) throw criarErro("Informe a conta.");

  if (!tipo_conta) {
    throw criarErro("Tipo da conta é obrigatório.");
  }
  const tipoValido = await dominiosService.validarDominio(
    "dom_tipo_conta_bancaria",
    tipo_conta
  );
  if (!tipoValido) {
    throw criarErro("Tipo de conta bancária inválido.");
  }

  principal = Boolean(principal);

  return {
    banco,
    agencia,
    conta,
    digito,
    tipo_conta,
    principal,
  };
}

async function listarPorCliente(req, res) {
  try {
    const clienteId = req.params.clienteId || req.params.id;
    await garantirClienteExiste(clienteId);

    const [rows] = await db.query(
      "SELECT * FROM contas_bancarias_cliente WHERE cliente_id = ? ORDER BY principal DESC, id DESC",
      [clienteId]
    );

    return res.json(rows);
  } catch (err) {
    console.error("Erro ao listar contas bancárias:", err);
    const status = err.statusCode || 500;
    return res.status(status).json({ error: err.message || "Erro ao listar contas." });
  }
}

async function definirContaPrincipal(clienteId, contaIdAtual) {
  await db.query(
    "UPDATE contas_bancarias_cliente SET principal = 0 WHERE cliente_id = ? AND id <> ?",
    [clienteId, contaIdAtual || 0]
  );
}

async function criarConta(req, res) {
  try {
    const clienteId = req.params.clienteId || req.params.id;
    await garantirClienteExiste(clienteId);

    const payload = await validarContaPayload(req.body);

    const sql = `
      INSERT INTO contas_bancarias_cliente (
        cliente_id,
        banco,
        agencia,
        conta,
        digito,
        tipo_conta,
        principal
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    const [result] = await db.query(sql, [
      clienteId,
      payload.banco,
      payload.agencia,
      payload.conta,
      payload.digito,
      payload.tipo_conta,
      payload.principal ? 1 : 0,
    ]);

    if (payload.principal) {
      await definirContaPrincipal(clienteId, result.insertId);
      await db.query("UPDATE contas_bancarias_cliente SET principal = 1 WHERE id = ?", [
        result.insertId,
      ]);
    }

    return res
      .status(201)
      .json({ id: result.insertId, cliente_id: Number(clienteId), ...payload });
  } catch (err) {
    console.error("Erro ao criar conta bancária:", err);
    const status = err.statusCode || 500;
    return res.status(status).json({ error: err.message || "Erro ao criar conta." });
  }
}

async function obterConta(id) {
  const [rows] = await db.query("SELECT * FROM contas_bancarias_cliente WHERE id = ?", [id]);
  if (!rows.length) {
    throw criarErro("Conta não encontrada.", 404);
  }
  return rows[0];
}

async function atualizarConta(req, res) {
  try {
    const { id } = req.params;
    const existente = await obterConta(id);
    const payload = await validarContaPayload(req.body);

    await db.query(
      `
        UPDATE contas_bancarias_cliente
        SET banco = ?, agencia = ?, conta = ?, digito = ?, tipo_conta = ?, principal = ?
        WHERE id = ?
      `,
      [
        payload.banco,
        payload.agencia,
        payload.conta,
        payload.digito,
        payload.tipo_conta,
        payload.principal ? 1 : 0,
        id,
      ]
    );

    if (payload.principal) {
      await definirContaPrincipal(existente.cliente_id, id);
      await db.query("UPDATE contas_bancarias_cliente SET principal = 1 WHERE id = ?", [id]);
    }

    return res.json({ id: Number(id), cliente_id: existente.cliente_id, ...payload });
  } catch (err) {
    console.error("Erro ao atualizar conta bancária:", err);
    const status = err.statusCode || 500;
    return res.status(status).json({ error: err.message || "Erro ao atualizar conta." });
  }
}

async function excluirConta(req, res) {
  try {
    const { id } = req.params;
    await obterConta(id);
    await db.query("DELETE FROM contas_bancarias_cliente WHERE id = ?", [id]);
    return res.json({ msg: "Conta bancária removida com sucesso." });
  } catch (err) {
    console.error("Erro ao excluir conta bancária:", err);
    const status = err.statusCode || 500;
    return res.status(status).json({ error: err.message || "Erro ao excluir conta." });
  }
}

module.exports = {
  listarPorCliente,
  criarConta,
  atualizarConta,
  excluirConta,
};
