const express = require('express');
const router = express.Router();
const pagamentosController = require('../controllers/pagamentosController');
const auth = require('../middlewares/auth'); // mesmo que você usa em clientes

router.use(auth); // todas as rotas abaixo exigem login

router.get('/', pagamentosController.listarPagamentos);
router.get('/:id', pagamentosController.buscarPagamento);
router.post('/:id/pagar', pagamentosController.registrarPagamento);

module.exports = router;
