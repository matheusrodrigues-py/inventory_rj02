const express = require('express');
const { body, validationResult } = require('express-validator');
const db = require('../database');
const { autenticar, exigirPerfil, hashSenha, registrarAuditoria } = require('./auth');

const router = express.Router();

function validar(req, res, next) {
  const erros = validationResult(req);
  if (!erros.isEmpty()) return res.status(400).json({ sucesso: false, mensagem: erros.array().map((erro) => erro.msg).join(' '), erros: erros.array() });
  next();
}

router.get('/', autenticar, (req, res) => {
  try {
    const usuarios = db
      .prepare(`
        SELECT id, nome, email, matricula, cargo, filial, perfil, ativo, criado_em
        FROM usuarios
        WHERE ativo = 1
        ORDER BY nome
      `)
      .all();
    return res.json({ sucesso: true, dados: usuarios });
  } catch (erro) {
    console.error('[GET /usuarios]', erro);
    return res.status(500).json({ sucesso: false, mensagem: 'Erro ao listar usuarios.' });
  }
});

router.post(
  '/',
  autenticar,
  exigirPerfil('master', 'admin'),
  [
    body('nome').isString().trim().notEmpty().withMessage('Nome obrigatorio.'),
    body('email').isEmail().withMessage('E-mail invalido.'),
    body('perfil').optional().isIn(['master', 'admin', 'gestor', 'operador', 'visualizador', 'suporte_ti', 'colaborador']).withMessage('Perfil invalido.'),
    body('senha').optional().isString().isLength({ min: 6 }).withMessage('Senha deve ter ao menos 6 caracteres.'),
  ],
  validar,
  (req, res) => {
    const { nome, email, matricula, cargo, filial, perfil = 'operador', senha } = req.body;

    if (perfil === 'admin' && req.usuario.perfil !== 'admin') {
      return res.status(403).json({ sucesso: false, mensagem: 'Apenas admin pode criar outro admin.' });
    }

    try {
      const resultado = db
        .prepare(`
          INSERT INTO usuarios (nome, email, matricula, cargo, filial, perfil, senha_hash)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `)
        .run(
          nome,
          email,
          matricula || null,
          cargo || null,
          filial || null,
          perfil,
          senha ? hashSenha(senha) : null
        );

      registrarAuditoria({
        entidade: 'usuarios',
        entidadeId: resultado.lastInsertRowid,
        acao: 'CRIAR_USUARIO',
        usuarioId: req.usuario.id,
        detalhes: { nome, email, perfil },
      });

      return res.status(201).json({ sucesso: true, id: resultado.lastInsertRowid });
    } catch (erro) {
      if (String(erro.message).includes('UNIQUE')) {
        return res.status(409).json({ sucesso: false, mensagem: 'E-mail ou matricula ja cadastrados.' });
      }
      console.error('[POST /usuarios]', erro);
      return res.status(500).json({ sucesso: false, mensagem: 'Erro ao criar usuario.' });
    }
  }
);

module.exports = router;


