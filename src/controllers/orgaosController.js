// src/controllers/orgaosController.js
const db = require("../config/db");

// GET /api/orgaos
async function listarOrgaos(req, res) {
  try {
    const [rows] = await db.query(
      `
      SELECT
        id,
        codigo,
        descricao,
        ativo
      FROM orgaos
      WHERE ativo = 1
      ORDER BY descricao
      `
    );

    return res.json(rows);
  } catch (err) {
    console.error("[ORGAOS] Erro ao listar órgãos:", err);
    return res.status(500).json({ error: "Erro ao listar órgãos." });
  }
}

// GET /api/orgaos/:orgaoId/suborgaos
async function listarSuborgaosPorOrgao(req, res) {
  const { orgaoId } = req.params;

  const id = parseInt(orgaoId, 10);
  if (Number.isNaN(id)) {
    return res.status(400).json({ error: "orgaoId inválido." });
  }

  try {
    const [rows] = await db.query(
      `
      SELECT
        id,
        orgao_id,
        codigo,
        descricao,
        dia_pagamento,
        dia_virada,
        regra_pagamento,
        regra_vencimento,
        ajuste_fds,
        ajuste_feriado,
        ativo
      FROM suborgaos
      WHERE orgao_id = ?
        AND ativo = 1
      ORDER BY descricao
      `,
      [id]
    );

    return res.json(rows);
  } catch (err) {
    console.error("[ORGAOS] Erro ao listar subórgãos:", err);
    return res.status(500).json({ error: "Erro ao listar subórgãos." });
  }
}

module.exports = {
  listarOrgaos,
  listarSuborgaosPorOrgao,
};
