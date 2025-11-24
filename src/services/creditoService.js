// src/services/creditoService.js

function calcularRecomendacaoEmprestimo(renda_mensal, situacao_profissional) {
    if (!renda_mensal) {
        return { valor: 0, parcelaMaxima: 0 };
    }

    const renda = Number(renda_mensal);
    const parcelaMaxima = renda * 0.30; // 30% da renda

    const multiplicadores = {
        "CLT": 12,
        "Servidor Público": 15,
        "Aposentado": 10,
        "Pensionista": 10,
        "Autônomo": 8,
        "MEI / Empresário": 8,
        "Desempregado": 4,
        "Outro": 6,
        "": 6,
        null: 6,
        undefined: 6
    };

    const mult = multiplicadores[situacao_profissional] ?? 6;

    let valor = parcelaMaxima * mult;

    // arredonda para o 100 mais próximo
    valor = Math.round(valor / 100) * 100;

    return {
        valor,          // valor recomendado total do empréstimo
        parcelaMaxima   // parcela máxima mensal
    };
}

module.exports = {
    calcularRecomendacaoEmprestimo
};
