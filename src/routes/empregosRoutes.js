const express = require("express");
const router = express.Router();
const empregosController = require("../controllers/empregosController");
const auth = require("../middlewares/auth");

router.put("/:id", auth, empregosController.atualizarEmprego);
router.delete("/:id", auth, empregosController.excluirEmprego);

module.exports = router;
