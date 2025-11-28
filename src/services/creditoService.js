// src/services/creditoService.js (refatorado)
function calcularRecomendacaoEmprestimo(rendaMensal, situacaoProfissional) {
  if (!rendaMensal) {
    return { valor: 0, parcelaMaxima: 0 };
  }

  const renda = Number(rendaMensal);
  if (!Number.isFinite(renda) || renda <= 0) {
    return { valor: 0, parcelaMaxima: 0 };
  }

  // 30% da renda
  const parcelaMaxima = renda * 0.3;

  const multiplicadores = {
    CLT: 12,
    "Servidor Público": 15,
    Aposentado: 10,
    Pensionista: 10,
    Autônomo: 8,
  };

  const mult =
    multiplicadores[situacaoProfissional] ??
    multiplicadores[String(situacaoProfissional || "").trim()] ??
    6; // default conservador

  let valor = parcelaMaxima * mult;

  // arredonda para o 100 mais próximo
  valor = Math.round(valor / 100) * 100;

  return {
    valor, // valor recomendado total do empréstimo
    parcelaMaxima, // parcela máxima mensal
  };
}

module.exports = {
  calcularRecomendacaoEmprestimo,
};
