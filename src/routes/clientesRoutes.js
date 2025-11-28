const express = require("express");
const router = express.Router();
const clientesController = require("../controllers/clientesController");
const telefonesController = require("../controllers/telefonesController");
const empregosController = require("../controllers/empregosController");
const rendaController = require("../controllers/rendaController");
const contasController = require("../controllers/contasController");
const auth = require("../middlewares/auth");

router.post("/", auth, clientesController.criarCliente);
router.get("/", auth, clientesController.listarClientes);
router.get("/:id", auth, clientesController.buscarCliente);
router.get("/:id/detalhes", auth, clientesController.detalhesCliente);
router.put("/:id", auth, clientesController.editarCliente);
router.delete("/:id", auth, clientesController.excluirCliente);

// Telefones
router.get("/:clienteId/telefones", auth, telefonesController.listarPorCliente);
router.post("/:clienteId/telefones", auth, telefonesController.criarTelefone);

// Empregos
router.get("/:clienteId/empregos", auth, empregosController.listarPorCliente);
router.post("/:clienteId/empregos", auth, empregosController.criarEmprego);

// Renda
router.get("/:clienteId/renda", auth, rendaController.obterPorCliente);
router.put("/:clienteId/renda", auth, rendaController.salvarRenda);

// Contas bancárias
router.get("/:clienteId/contas", auth, contasController.listarPorCliente);
router.post("/:clienteId/contas", auth, contasController.criarConta);

module.exports = router;
