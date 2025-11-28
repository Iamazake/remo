// src/services/dominiosService.js (refatorado)
const db = require("../config/db");

// cache simples em memória para domínios de tela
const cache = new Map();

async function listarPorTipo(tipo) {
  const normalizado = String(tipo || "").trim().toLowerCase();
  if (!normalizado) return [];

  if (cache.has(normalizado)) {
    return cache.get(normalizado);
  }

  const [rows] = await db.query(
    "SELECT valor, descricao FROM dominios WHERE tipo = ? ORDER BY descricao ASC",
    [normalizado]
  );

  const lista = rows.map((row) => ({
    valor: row.valor,
    descricao: row.descricao,
  }));

  cache.set(normalizado, lista);

  return lista;
}

async function validarDominio(tipo, valor) {
  if (!tipo || valor === undefined || valor === null) return false;

  const lista = await listarPorTipo(tipo);
  return lista.some((item) => String(item.valor) === String(valor));
}

function limparCache() {
  cache.clear();
}

module.exports = {
  listarPorTipo,
  validarDominio,
  limparCache,
};
