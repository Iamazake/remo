const db = require("../config/db");
const dominiosService = require("../services/dominiosService");
const { onlyDigits } = require("../utils/valueHelpers");

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

async function validarTelefonePayload(payload = {}) {
  let { tipo, ddd, numero, contato } = payload;

  if (!tipo) {
    throw criarErro("Tipo do telefone é obrigatório.");
  }

  const tipoValido = await dominiosService.validarDominio("dom_tipo_telefone", tipo);
  if (!tipoValido) {
    throw criarErro("Tipo de telefone inválido.");
  }

  ddd = onlyDigits(ddd, 3);
  if (!ddd || ddd.length < 2) {
    throw criarErro("DDD inválido.");
  }

  numero = onlyDigits(numero, 15);
  if (!numero || numero.length < 8) {
    throw criarErro("Número de telefone inválido.");
  }

  contato = contato === undefined || contato === null ? null : String(contato).trim();
  if ((tipo === "Recado" || tipo === "Trabalho") && !contato) {
    throw criarErro("Informe o nome do contato para telefones de recado ou trabalho.");
  }

  return { tipo, ddd, numero, contato };
}

async function listarPorCliente(req, res) {
  try {
    const clienteId = req.params.clienteId || req.params.id;
    await garantirClienteExiste(clienteId);

    const [rows] = await db.query(
      "SELECT * FROM telefones_cliente WHERE cliente_id = ? ORDER BY id DESC",
      [clienteId]
    );

    return res.json(rows);
  } catch (err) {
    console.error("Erro ao listar telefones:", err);
    const status = err.statusCode || 500;
    return res.status(status).json({ error: err.message || "Erro ao listar telefones." });
  }
}

async function criarTelefone(req, res) {
  try {
    const clienteId = req.params.clienteId || req.params.id;
    await garantirClienteExiste(clienteId);

    const payload = await validarTelefonePayload(req.body);

    const sql = `
      INSERT INTO telefones_cliente (cliente_id, tipo, ddd, numero, contato)
      VALUES (?, ?, ?, ?, ?)
    `;
    const [result] = await db.query(sql, [
      clienteId,
      payload.tipo,
      payload.ddd,
      payload.numero,
      payload.contato,
    ]);

    return res.status(201).json({ id: result.insertId, cliente_id: Number(clienteId), ...payload });
  } catch (err) {
    console.error("Erro ao criar telefone:", err);
    const status = err.statusCode || 500;
    return res.status(status).json({ error: err.message || "Erro ao criar telefone." });
  }
}

async function atualizarTelefone(req, res) {
  try {
    const { id } = req.params;
    const [rows] = await db.query("SELECT * FROM telefones_cliente WHERE id = ?", [id]);
    if (!rows.length) {
      throw criarErro("Telefone não encontrado.", 404);
    }
    const existente = rows[0];

    const payload = await validarTelefonePayload(req.body);
    await db.query(
      `
        UPDATE telefones_cliente
        SET tipo = ?, ddd = ?, numero = ?, contato = ?
        WHERE id = ?
      `,
      [payload.tipo, payload.ddd, payload.numero, payload.contato, id]
    );

    return res.json({ id: Number(id), cliente_id: existente.cliente_id, ...payload });
  } catch (err) {
    console.error("Erro ao atualizar telefone:", err);
    const status = err.statusCode || 500;
    return res.status(status).json({ error: err.message || "Erro ao atualizar telefone." });
  }
}

async function excluirTelefone(req, res) {
  try {
    const { id } = req.params;
    const [rows] = await db.query("SELECT id FROM telefones_cliente WHERE id = ?", [id]);

    if (!rows.length) {
      throw criarErro("Telefone não encontrado.", 404);
    }

    await db.query("DELETE FROM telefones_cliente WHERE id = ?", [id]);
    return res.json({ msg: "Telefone removido com sucesso." });
  } catch (err) {
    console.error("Erro ao excluir telefone:", err);
    const status = err.statusCode || 500;
    return res.status(status).json({ error: err.message || "Erro ao excluir telefone." });
  }
}

module.exports = {
  listarPorCliente,
  criarTelefone,
  atualizarTelefone,
  excluirTelefone,
};
