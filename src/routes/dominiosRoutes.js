const express = require("express");
const router = express.Router();
const dominiosController = require("../controllers/dominiosController");
const auth = require("../middlewares/auth");

router.get("/:tipo", auth, dominiosController.listar);

module.exports = router;
