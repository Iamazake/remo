// src/routes/tabelasJurosRoutes.js
const express = require("express");
const router = express.Router();
const tabelasJurosController = require("../controllers/tabelasJurosController");

router.get("/", tabelasJurosController.listarTabelas);
router.get("/:id", tabelasJurosController.buscarTabelaPorId);
router.post("/", tabelasJurosController.criarTabela);
router.put("/:id", tabelasJurosController.atualizarTabela);
router.delete("/:id", tabelasJurosController.excluirTabela);

module.exports = router;
