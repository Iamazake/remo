// src/routes/orgaosRoutes.js
const express = require("express");
const router = express.Router();

const auth = require("../middlewares/auth");
const orgaosController = require("../controllers/orgaosController");

// Apenas leitura por enquanto (quem pode mexer nas regras faremos depois como ADMIN)
router.get("/", auth, orgaosController.listarOrgaos);
router.get("/:orgaoId/suborgaos", auth, orgaosController.listarSuborgaosPorOrgao);

module.exports = router;
