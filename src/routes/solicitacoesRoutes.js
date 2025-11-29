// src/routes/solicitacoesRoutes.js
const express = require('express');
const router = express.Router();
const solicitacoesController = require('../controllers/solicitacoesController');

// Todas as rotas daqui devem estar protegidas pelo authMiddleware
// lá no app.js/server.js: app.use('/api/solicitacoes', authMiddleware, solicitacoesRoutes);

// AGENTE / ADMIN
router.post('/', solicitacoesController.criarSolicitacao);
router.get('/', solicitacoesController.listarSolicitacoes);
router.get('/:id', solicitacoesController.obterSolicitacao);
router.post('/:id/enviar-para-analise', solicitacoesController.enviarParaAnalise);

// ANALISTA / ADMIN
router.post('/:id/aprovar', solicitacoesController.aprovarSolicitacao);
router.post('/:id/reprovar', solicitacoesController.reprovarSolicitacao);

// FINANCEIRO / ADMIN
router.post('/:id/liberar', solicitacoesController.liberarSolicitacao);

// ANEXOS (AGENTE / ADMIN)
router.post('/:id/anexos', solicitacoesController.adicionarAnexo);

module.exports = router;
