const express = require("express");
const router = express.Router();
const telefonesController = require("../controllers/telefonesController");
const auth = require("../middlewares/auth");

router.put("/:id", auth, telefonesController.atualizarTelefone);
router.delete("/:id", auth, telefonesController.excluirTelefone);

module.exports = router;
