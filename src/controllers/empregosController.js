const db = require("../config/db");
const dominiosService = require("../services/dominiosService");
const { toNullableInt } = require("../utils/valueHelpers");

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

async function validarEmpregoPayload(payload = {}) {
  let {
    empresa,
    cargo,
    natureza_ocupacao,
    tempo_empresa_meses,
    tipo_comprovante,
    telefone_comercial,
    ramal,
    endereco_empresa,
  } = payload;

  if (!empresa) {
    throw criarErro("Nome da empresa é obrigatório.");
  }

  const naturezaValida = await dominiosService.validarDominio(
    "dom_natureza_ocupacao",
    natureza_ocupacao
  );
  if (!naturezaValida) {
    throw criarErro("Natureza de ocupação inválida.");
  }

  const tempoNormalizado = toNullableInt(tempo_empresa_meses);
  if (
    tempo_empresa_meses !== undefined &&
    tempo_empresa_meses !== null &&
    tempo_empresa_meses !== "" &&
    tempoNormalizado === null
  ) {
    throw criarErro("Tempo de empresa inválido.");
  }
  tempo_empresa_meses = tempoNormalizado;

  if (tipo_comprovante) {
    const comprovanteValido = await dominiosService.validarDominio(
      "dom_tipo_comprovante",
      tipo_comprovante
    );
    if (!comprovanteValido) {
      throw criarErro("Tipo de comprovante inválido.");
    }
  } else {
    tipo_comprovante = null;
  }

  telefone_comercial =
    telefone_comercial === undefined || telefone_comercial === null
      ? null
      : String(telefone_comercial).trim();
  ramal = ramal === undefined || ramal === null ? null : String(ramal).trim();
  endereco_empresa =
    endereco_empresa === undefined || endereco_empresa === null
      ? null
      : String(endereco_empresa).trim();
  cargo = cargo === undefined || cargo === null ? null : String(cargo).trim();

  return {
    empresa: String(empresa).trim(),
    cargo,
    natureza_ocupacao,
    tempo_empresa_meses,
    tipo_comprovante,
    telefone_comercial,
    ramal,
    endereco_empresa,
  };
}

async function listarPorCliente(req, res) {
  try {
    const clienteId = req.params.clienteId || req.params.id;
    await garantirClienteExiste(clienteId);

    const [rows] = await db.query(
      "SELECT * FROM empregos_cliente WHERE cliente_id = ? ORDER BY id DESC",
      [clienteId]
    );

    return res.json(rows);
  } catch (err) {
    console.error("Erro ao listar vínculos profissionais:", err);
    const status = err.statusCode || 500;
    return res.status(status).json({ error: err.message || "Erro ao listar vínculos." });
  }
}

async function criarEmprego(req, res) {
  try {
    const clienteId = req.params.clienteId || req.params.id;
    await garantirClienteExiste(clienteId);

    const [countRows] = await db.query(
      "SELECT COUNT(*) AS total FROM empregos_cliente WHERE cliente_id = ?",
      [clienteId]
    );
    if (countRows[0].total >= 1) {
      throw criarErro("Já existe um vínculo profissional cadastrado para este cliente.", 400);
    }

    const payload = await validarEmpregoPayload(req.body);

    const sql = `
      INSERT INTO empregos_cliente (
        cliente_id,
        empresa,
        cargo,
        natureza_ocupacao,
        tempo_empresa_meses,
        tipo_comprovante,
        telefone_comercial,
        ramal,
        endereco_empresa
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const [result] = await db.query(sql, [
      clienteId,
      payload.empresa,
      payload.cargo,
      payload.natureza_ocupacao,
      payload.tempo_empresa_meses,
      payload.tipo_comprovante,
      payload.telefone_comercial,
      payload.ramal,
      payload.endereco_empresa,
    ]);

    return res
      .status(201)
      .json({ id: result.insertId, cliente_id: Number(clienteId), ...payload });
  } catch (err) {
    console.error("Erro ao criar vínculo profissional:", err);
    const status = err.statusCode || 500;
    return res.status(status).json({ error: err.message || "Erro ao criar vínculo." });
  }
}

async function obterEmpregoPorId(id) {
  const [rows] = await db.query("SELECT * FROM empregos_cliente WHERE id = ?", [id]);
  if (!rows.length) {
    throw criarErro("Vínculo profissional não encontrado.", 404);
  }
  return rows[0];
}

async function atualizarEmprego(req, res) {
  try {
    const { id } = req.params;
    const existente = await obterEmpregoPorId(id);
    const payload = await validarEmpregoPayload(req.body);

    await db.query(
      `
        UPDATE empregos_cliente
        SET empresa = ?, cargo = ?, natureza_ocupacao = ?, tempo_empresa_meses = ?,
            tipo_comprovante = ?, telefone_comercial = ?, ramal = ?, endereco_empresa = ?
        WHERE id = ?
      `,
      [
        payload.empresa,
        payload.cargo,
        payload.natureza_ocupacao,
        payload.tempo_empresa_meses,
        payload.tipo_comprovante,
        payload.telefone_comercial,
        payload.ramal,
        payload.endereco_empresa,
        id,
      ]
    );

    return res.json({ id: Number(id), cliente_id: existente.cliente_id, ...payload });
  } catch (err) {
    console.error("Erro ao atualizar vínculo profissional:", err);
    const status = err.statusCode || 500;
    return res.status(status).json({ error: err.message || "Erro ao atualizar vínculo." });
  }
}

async function excluirEmprego(req, res) {
  try {
    const { id } = req.params;
    await obterEmpregoPorId(id);
    await db.query("DELETE FROM empregos_cliente WHERE id = ?", [id]);
    return res.json({ msg: "Vínculo profissional removido com sucesso." });
  } catch (err) {
    console.error("Erro ao excluir vínculo profissional:", err);
    const status = err.statusCode || 500;
    return res.status(status).json({ error: err.message || "Erro ao excluir vínculo." });
  }
}

module.exports = {
  listarPorCliente,
  criarEmprego,
  atualizarEmprego,
  excluirEmprego,
};
