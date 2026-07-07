const crypto = require('crypto');
const express = require('express');
const { body, validationResult } = require('express-validator');
const db = require('../database');

const router = express.Router();
const sessoes = new Map();

function hashSenha(senha) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(String(senha), salt, 120000, 32, 'sha256').toString('hex');
  return `${salt}:${hash}`;
}

function validarSenha(senha, senhaHash) {
  if (!senhaHash || !senhaHash.includes(':')) return false;
  const [salt, hashSalvo] = senhaHash.split(':');
  const hash = crypto.pbkdf2Sync(String(senha), salt, 120000, 32, 'sha256').toString('hex');
  return crypto.timingSafeEqual(Buffer.from(hashSalvo, 'hex'), Buffer.from(hash, 'hex'));
}

function usuarioSeguro(usuario) {
  if (!usuario) return null;
  const { senha_hash, ...seguro } = usuario;
  return seguro;
}

function registrarAuditoria({ entidade, entidadeId, acao, usuarioId, detalhes }) {
  db.prepare(`
    INSERT INTO auditoria (entidade, entidade_id, acao, usuario_id, detalhes)
    VALUES (?, ?, ?, ?, ?)
  `).run(entidade, entidadeId || null, acao, usuarioId || null, detalhes ? JSON.stringify(detalhes) : null);
}

function autenticar(req, res, next) {
  const header = req.get('Authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  const sessao = token ? sessoes.get(token) : null;
  if (!sessao) {
    return res.status(401).json({ sucesso: false, mensagem: 'Login necessario.' });
  }

  const usuario = db
    .prepare('SELECT id, nome, email, cargo, filial, perfil, ativo FROM usuarios WHERE id = ? AND ativo = 1')
    .get(sessao.usuarioId);

  if (!usuario) {
    sessoes.delete(token);
    return res.status(401).json({ sucesso: false, mensagem: 'Sessao invalida.' });
  }

  req.usuario = usuario;
  req.token = token;
  next();
}

function exigirPerfil(...perfis) {
  return (req, res, next) => {
    if (!req.usuario || !perfis.includes(req.usuario.perfil)) {
      return res.status(403).json({ sucesso: false, mensagem: 'Acesso negado para este perfil.' });
    }
    next();
  };
}

router.post(
  '/login',
  [
    body('email').isEmail().withMessage('E-mail invalido.'),
    body('senha').isString().notEmpty().withMessage('Senha obrigatoria.'),
  ],
  (req, res) => {
    const erros = validationResult(req);
    if (!erros.isEmpty()) return res.status(400).json({ sucesso: false, erros: erros.array() });

    const { email, senha } = req.body;
    const usuario = db
      .prepare('SELECT * FROM usuarios WHERE lower(email) = lower(?) AND ativo = 1')
      .get(email);

    if (!usuario || !validarSenha(senha, usuario.senha_hash)) {
      return res.status(401).json({ sucesso: false, mensagem: 'E-mail ou senha invalidos.' });
    }

    const token = crypto.randomBytes(32).toString('hex');
    sessoes.set(token, { usuarioId: usuario.id, criadoEm: Date.now() });
    registrarAuditoria({ entidade: 'usuarios', entidadeId: usuario.id, acao: 'LOGIN', usuarioId: usuario.id });

    return res.json({ sucesso: true, token, usuario: usuarioSeguro(usuario) });
  }
);

router.post('/logout', autenticar, (req, res) => {
  sessoes.delete(req.token);
  registrarAuditoria({ entidade: 'usuarios', entidadeId: req.usuario.id, acao: 'LOGOUT', usuarioId: req.usuario.id });
  res.json({ sucesso: true });
});

router.get('/me', autenticar, (req, res) => {
  res.json({ sucesso: true, usuario: req.usuario });
});

module.exports = {
  router,
  autenticar,
  exigirPerfil,
  hashSenha,
  registrarAuditoria,
};
