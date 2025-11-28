const dominiosService = require("../services/dominiosService");

async function listar(req, res) {
  try {
    const { tipo } = req.params;
    if (!tipo) {
      return res.status(400).json({ error: "Tipo de domínio não informado." });
    }

    const lista = await dominiosService.listarPorTipo(tipo);
    return res.json(lista);
  } catch (err) {
    console.error("Erro ao listar domínios:", err);
    return res.status(500).json({ error: "Erro ao listar domínios." });
  }
}

module.exports = {
  listar,
};
