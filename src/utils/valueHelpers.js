// src/utils/valueHelpers.js (refatorado)
function toNullableString(value) {
  if (value === undefined || value === null) return null;
  const trimmed = String(value).trim();
  return trimmed.length ? trimmed : null;
}

function toNullableInt(value, { allowNegative = false } = {}) {
  if (value === undefined || value === null || value === "") return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  const finalValue = Math.trunc(parsed);
  if (!allowNegative && finalValue < 0) return null;
  return finalValue;
}

function toNullableDecimal(value, { allowNegative = false } = {}) {
  if (value === undefined || value === null || value === "") return null;

  // Aceita "1.234,56" ou "1234.56"
  let normalized = String(value).trim();

  // Remove tudo que não for número, vírgula, ponto ou sinal
  normalized = normalized.replace(/[^0-9,.-]/g, "");

  const hasComma = normalized.includes(",");
  const hasDot = normalized.includes(".");

  if (hasComma && hasDot) {
    // remove separador de milhar (.)
    normalized = normalized.replace(/\./g, "").replace(",", ".");
  } else if (hasComma) {
    // só vírgula => troca por ponto
    normalized = normalized.replace(",", ".");
  }

  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) return null;
  if (!allowNegative && parsed < 0) return null;

  return parsed;
}

function onlyDigits(value, limit) {
  if (value === undefined || value === null) return "";
  const cleaned = String(value).replace(/\D/g, "");
  if (!limit) return cleaned;
  return cleaned.substring(0, limit);
}

module.exports = {
  toNullableString,
  toNullableInt,
  toNullableDecimal,
  onlyDigits,
};
