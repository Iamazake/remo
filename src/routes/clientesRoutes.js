const express = require("express");
const router = express.Router();
const clientesController = require("../controllers/clientesController");
const auth = require("../middlewares/auth"); // Middleware de autenticação

// ROTAS PROTEGIDAS
router.post("/", auth, clientesController.criarCliente);
router.get("/", auth, clientesController.listarClientes);
router.get("/:id", auth, clientesController.buscarCliente);
router.put("/:id", auth, clientesController.editarCliente);
router.delete("/:id", auth, clientesController.excluirCliente);

module.exports = router;
