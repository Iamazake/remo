const express = require('express');
const router = express.Router();
const emprestimoController = require('../controllers/emprestimoController');

router.get('/', emprestimoController.listarEmprestimos);
router.get('/:id', emprestimoController.buscarEmprestimoPorId);
router.post('/', emprestimoController.criarEmprestimo);
router.put('/:id', emprestimoController.atualizarEmprestimo);
router.delete('/:id', emprestimoController.excluirEmprestimo);

module.exports = router;
