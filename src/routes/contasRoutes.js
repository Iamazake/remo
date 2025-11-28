const express = require("express");
const router = express.Router();
const contasController = require("../controllers/contasController");
const auth = require("../middlewares/auth");

router.put("/:id", auth, contasController.atualizarConta);
router.delete("/:id", auth, contasController.excluirConta);

module.exports = router;
