const express = require('express');
const { param, body, validationResult } = require('express-validator');
const RequisicaoModel = require('../models/requisicaoModel');
const { autenticar, exigirPerfil } = require('./auth');

const router = express.Router();

function validar(req, res, next) {
  const erros = validationResult(req);
  if (!erros.isEmpty()) return res.status(400).json({ sucesso: false, erros: erros.array() });
  next();
}

router.get('/pendentes', autenticar, (req, res) => {
  try {
    const pendentes = RequisicaoModel.listarPendentes();
    return res.json({ sucesso: true, total: pendentes.length, dados: pendentes });
  } catch (erro) {
    console.error('[GET /requisicoes/pendentes]', erro);
    return res.status(500).json({ sucesso: false, mensagem: 'Erro ao listar requisicoes pendentes.' });
  }
});

router.patch(
  '/:id/aprovar',
  autenticar,
  exigirPerfil('admin', 'gestor'),
  [param('id').isInt({ min: 1 }).withMessage('ID da requisicao invalido.')],
  validar,
  (req, res) => {
    try {
      const requisicaoAtualizada = RequisicaoModel.aprovar(req.params.id, req.usuario.id);
      return res.json({
        sucesso: true,
        mensagem: 'Requisicao aprovada com sucesso. Ativo vinculado ao solicitante.',
        dados: requisicaoAtualizada,
      });
    } catch (erro) {
      return tratarErroDeNegocio(erro, res);
    }
  }
);

router.patch(
  '/:id/rejeitar',
  autenticar,
  exigirPerfil('admin', 'gestor'),
  [
    param('id').isInt({ min: 1 }).withMessage('ID da requisicao invalido.'),
    body('motivo').optional().isString().trim().isLength({ max: 500 }),
  ],
  validar,
  (req, res) => {
    try {
      const requisicaoAtualizada = RequisicaoModel.rejeitar(req.params.id, req.usuario.id, req.body.motivo);
      return res.json({ sucesso: true, mensagem: 'Requisicao rejeitada.', dados: requisicaoAtualizada });
    } catch (erro) {
      return tratarErroDeNegocio(erro, res);
    }
  }
);

function tratarErroDeNegocio(erro, res) {
  const mapaDeErros = {
    REQUISICAO_NAO_ENCONTRADA: { status: 404, mensagem: 'Requisicao nao encontrada.' },
    REQUISICAO_JA_PROCESSADA: { status: 409, mensagem: 'Esta requisicao ja foi processada.' },
    ATIVO_INDISPONIVEL: { status: 409, mensagem: 'O ativo vinculado a esta requisicao nao esta mais disponivel.' },
  };

  const erroConhecido = mapaDeErros[erro.message];
  if (erroConhecido) {
    return res.status(erroConhecido.status).json({ sucesso: false, mensagem: erroConhecido.mensagem });
  }

  console.error('[requisicoes] erro inesperado:', erro);
  return res.status(500).json({ sucesso: false, mensagem: 'Erro interno ao processar a requisicao.' });
}

module.exports = router;
