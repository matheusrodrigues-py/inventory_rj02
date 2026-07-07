const express = require('express');
const db = require('../database');
const { autenticar, exigirPerfil } = require('./auth');

const router = express.Router();

router.get('/', autenticar, exigirPerfil('admin', 'gestor'), (req, res) => {
  try {
    const { entidade, entidadeId } = req.query;
    const filtros = [];
    const params = [];

    if (entidade) {
      filtros.push('a.entidade = ?');
      params.push(entidade);
    }

    if (entidadeId) {
      filtros.push('a.entidade_id = ?');
      params.push(entidadeId);
    }

    const where = filtros.length ? `WHERE ${filtros.join(' AND ')}` : '';
    const dados = db.prepare(`
      SELECT
        a.id,
        a.entidade,
        a.entidade_id,
        a.acao,
        a.detalhes,
        a.criado_em,
        u.nome AS usuario_nome,
        u.email AS usuario_email
      FROM auditoria a
      LEFT JOIN usuarios u ON u.id = a.usuario_id
      ${where}
      ORDER BY a.id DESC
      LIMIT 200
    `).all(...params);

    return res.json({ sucesso: true, total: dados.length, dados });
  } catch (erro) {
    console.error('[GET /auditoria]', erro);
    return res.status(500).json({ sucesso: false, mensagem: 'Erro ao listar auditoria.' });
  }
});

module.exports = router;
