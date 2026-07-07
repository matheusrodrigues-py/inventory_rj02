const express = require('express');
const { body, param, validationResult } = require('express-validator');
const db = require('../database');
const { autenticar, exigirPerfil, registrarAuditoria } = require('./auth');

const router = express.Router();

function validar(req, res, next) {
  const erros = validationResult(req);
  if (!erros.isEmpty()) return res.status(400).json({ sucesso: false, erros: erros.array() });
  next();
}

function buscarAtivo(id) {
  return db.prepare('SELECT * FROM ativos WHERE id = ?').get(id);
}

router.get('/', autenticar, (req, res) => {
  try {
    const { status } = req.query;
    let query = `
      SELECT a.*, COALESCE(a.responsavel_nome, u.nome) AS usuario_atual_nome
      FROM ativos a
      LEFT JOIN usuarios u ON u.id = a.usuario_atual_id
    `;
    const parametros = [];

    if (status) {
      query += ' WHERE a.status = ?';
      parametros.push(status);
    }

    query += ' ORDER BY a.tipo, a.codigo_patrimonio';

    const ativos = db.prepare(query).all(...parametros);
    return res.json({ sucesso: true, total: ativos.length, dados: ativos });
  } catch (erro) {
    console.error('[GET /ativos]', erro);
    return res.status(500).json({ sucesso: false, mensagem: 'Erro ao listar ativos.' });
  }
});

router.post(
  '/',
  autenticar,
  exigirPerfil('admin', 'gestor'),
  [
    body('codigo_patrimonio').isString().trim().notEmpty().withMessage('Codigo de patrimonio obrigatorio.'),
    body('tipo').isIn(['PDA', 'Notebook', 'Radio', 'Coletor', 'Impressora', 'Paleteira', 'Outro']).withMessage('Tipo de ativo invalido.'),
  ],
  validar,
  (req, res) => {
    const { codigo_patrimonio, tipo, modelo, numero_serie, filial, observacoes } = req.body;

    try {
      const resultado = db
        .prepare(`
          INSERT INTO ativos (codigo_patrimonio, tipo, modelo, numero_serie, filial, observacoes)
          VALUES (?, ?, ?, ?, ?, ?)
        `)
        .run(codigo_patrimonio, tipo, modelo || null, numero_serie || null, filial || null, observacoes || null);

      registrarAuditoria({
        entidade: 'ativos',
        entidadeId: resultado.lastInsertRowid,
        acao: 'CRIAR_ATIVO',
        usuarioId: req.usuario.id,
        detalhes: { codigo_patrimonio, tipo },
      });

      return res.status(201).json({ sucesso: true, id: resultado.lastInsertRowid });
    } catch (erro) {
      if (String(erro.message).includes('UNIQUE')) {
        return res.status(409).json({ sucesso: false, mensagem: 'Codigo de patrimonio ja cadastrado.' });
      }
      console.error('[POST /ativos]', erro);
      return res.status(500).json({ sucesso: false, mensagem: 'Erro ao cadastrar ativo.' });
    }
  }
);

router.patch(
  '/:id',
  autenticar,
  exigirPerfil('admin', 'gestor'),
  [
    param('id').isInt({ min: 1 }).withMessage('ID de ativo invalido.'),
    body('tipo').optional().isIn(['PDA', 'Notebook', 'Radio', 'Coletor', 'Impressora', 'Paleteira', 'Outro']).withMessage('Tipo invalido.'),
  ],
  validar,
  (req, res) => {
    const ativo = buscarAtivo(req.params.id);
    if (!ativo) return res.status(404).json({ sucesso: false, mensagem: 'Ativo nao encontrado.' });

    const campos = ['codigo_patrimonio', 'tipo', 'modelo', 'numero_serie', 'filial', 'observacoes'];
    const atualizacoes = [];
    const valores = [];

    campos.forEach((campo) => {
      if (Object.prototype.hasOwnProperty.call(req.body, campo)) {
        atualizacoes.push(`${campo} = ?`);
        valores.push(req.body[campo] || null);
      }
    });

    if (!atualizacoes.length) {
      return res.status(400).json({ sucesso: false, mensagem: 'Nenhum campo enviado para edicao.' });
    }

    atualizacoes.push("atualizado_em = datetime('now')");
    valores.push(req.params.id);

    try {
      db.prepare(`UPDATE ativos SET ${atualizacoes.join(', ')} WHERE id = ?`).run(...valores);
      registrarAuditoria({
        entidade: 'ativos',
        entidadeId: req.params.id,
        acao: 'EDITAR_ATIVO',
        usuarioId: req.usuario.id,
        detalhes: req.body,
      });
      return res.json({ sucesso: true, dados: buscarAtivo(req.params.id) });
    } catch (erro) {
      if (String(erro.message).includes('UNIQUE')) {
        return res.status(409).json({ sucesso: false, mensagem: 'Codigo de patrimonio ja cadastrado.' });
      }
      console.error('[PATCH /ativos/:id]', erro);
      return res.status(500).json({ sucesso: false, mensagem: 'Erro ao editar ativo.' });
    }
  }
);

router.delete(
  '/:id',
  autenticar,
  exigirPerfil('master', 'admin'),
  [param('id').isInt({ min: 1 }).withMessage('ID de ativo invalido.')],
  validar,
  (req, res) => {
    const ativo = buscarAtivo(req.params.id);
    if (!ativo) return res.status(404).json({ sucesso: false, mensagem: 'Ativo nao encontrado.' });

    try {
      const transacao = db.transaction(() => {
        db.prepare('DELETE FROM requisicoes WHERE ativo_id = ?').run(req.params.id);
        db.prepare('DELETE FROM ativos WHERE id = ?').run(req.params.id);
        registrarAuditoria({
          entidade: 'ativos',
          entidadeId: req.params.id,
          acao: 'EXCLUIR_ATIVO',
          usuarioId: req.usuario.id,
          detalhes: { codigo_patrimonio: ativo.codigo_patrimonio, tipo: ativo.tipo, statusAnterior: ativo.status },
        });
      });

      transacao();
      return res.json({ sucesso: true, mensagem: 'Ativo excluido com sucesso.' });
    } catch (erro) {
      console.error('[DELETE /ativos/:id]', erro);
      return res.status(500).json({ sucesso: false, mensagem: 'Erro ao excluir ativo.' });
    }
  }
);

router.post(
  '/:id/solicitar',
  autenticar,
  [body('usuarioId').isInt({ min: 1 }).withMessage('Usuario solicitante obrigatorio.')],
  validar,
  (req, res) => {
    const ativoId = req.params.id;
    const { usuarioId, justificativa } = req.body;

    if (req.usuario.perfil === 'colaborador' && Number(usuarioId) !== Number(req.usuario.id)) {
      return res.status(403).json({ sucesso: false, mensagem: 'Colaborador so pode solicitar para si mesmo.' });
    }

    try {
      const ativo = buscarAtivo(ativoId);
      if (!ativo) return res.status(404).json({ sucesso: false, mensagem: 'Ativo nao encontrado.' });
      if (ativo.status !== 'Disponivel') {
        return res.status(409).json({ sucesso: false, mensagem: `Ativo nao esta disponivel (status atual: ${ativo.status}).` });
      }

      const resultado = db
        .prepare('INSERT INTO requisicoes (usuario_id, ativo_id, justificativa) VALUES (?, ?, ?)')
        .run(usuarioId, ativoId, justificativa || null);

      registrarAuditoria({
        entidade: 'requisicoes',
        entidadeId: resultado.lastInsertRowid,
        acao: 'CRIAR_REQUISICAO',
        usuarioId: req.usuario.id,
        detalhes: { ativoId, usuarioId },
      });

      return res.status(201).json({ sucesso: true, id: resultado.lastInsertRowid, mensagem: 'Requisicao criada e aguardando aprovacao.' });
    } catch (erro) {
      console.error('[POST /ativos/:id/solicitar]', erro);
      return res.status(500).json({ sucesso: false, mensagem: 'Erro ao criar requisicao.' });
    }
  }
);

router.patch(
  '/:id/entregar',
  autenticar,
  exigirPerfil('master', 'admin', 'gestor'),
  [
    param('id').isInt({ min: 1 }),
    body('nome_colaborador').isString().trim().notEmpty().withMessage('Nome do colaborador obrigatorio.'),
    body('setor').isString().trim().notEmpty().withMessage('Nome do setor obrigatorio.'),
    body('lider').isString().trim().notEmpty().withMessage('Nome do lider obrigatorio.'),
    body('turno').isString().trim().notEmpty().withMessage('Turno obrigatorio.'),
  ],
  validar,
  (req, res) => {
    const ativo = buscarAtivo(req.params.id);
    if (!ativo) return res.status(404).json({ sucesso: false, mensagem: 'Ativo nao encontrado.' });
    if (ativo.status !== 'Disponivel') {
      return res.status(409).json({ sucesso: false, mensagem: `Ativo nao esta disponivel (status atual: ${ativo.status}).` });
    }

    const { nome_colaborador, setor, lider, turno } = req.body;
    const transacao = db.transaction(() => {
      db.prepare(`
        UPDATE ativos
        SET status = 'Em Uso',
            usuario_atual_id = NULL,
            responsavel_nome = ?,
            responsavel_setor = ?,
            responsavel_lider = ?,
            responsavel_turno = ?,
            entregue_em = datetime('now'),
            devolvido_em = NULL,
            observacoes = ?,
            atualizado_em = datetime('now')
        WHERE id = ?
      `).run(nome_colaborador, setor, lider, turno, setor, req.params.id);

      const requisicao = db.prepare(`
        INSERT INTO requisicoes (
          usuario_id,
          ativo_id,
          status,
          justificativa,
          aprovado_por,
          solicitado_em,
          respondido_em
        )
        VALUES (?, ?, 'Aprovada', ?, ?, datetime('now'), datetime('now'))
      `).run(
        req.usuario.id,
        req.params.id,
        `Entrega direta para ${nome_colaborador} | Setor: ${setor} | Lider: ${lider} | Turno: ${turno}`,
        req.usuario.id,
      );

      registrarAuditoria({
        entidade: 'ativos',
        entidadeId: req.params.id,
        acao: 'ENTREGAR_ATIVO',
        usuarioId: req.usuario.id,
        detalhes: { requisicaoId: requisicao.lastInsertRowid, nome_colaborador, setor, lider, turno },
      });

      return buscarAtivo(req.params.id);
    });

    return res.json({ sucesso: true, mensagem: 'Entrega registrada com sucesso.', dados: transacao() });
  }
);

router.patch(
  '/:id/devolver',
  autenticar,
  exigirPerfil('master', 'admin', 'gestor'),
  [param('id').isInt({ min: 1 }), body('observacao').optional().isString().trim().isLength({ max: 500 })],
  validar,
  (req, res) => {
    const ativo = buscarAtivo(req.params.id);
    if (!ativo) return res.status(404).json({ sucesso: false, mensagem: 'Ativo nao encontrado.' });
    if (ativo.status !== 'Em Uso') {
      return res.status(409).json({ sucesso: false, mensagem: 'Somente ativos em uso podem ser devolvidos.' });
    }

    const transacao = db.transaction(() => {
      db.prepare(`
        UPDATE ativos
        SET status = 'Disponivel',
            usuario_atual_id = NULL,
            responsavel_nome = NULL,
            responsavel_setor = NULL,
            responsavel_lider = NULL,
            responsavel_turno = NULL,
            devolvido_em = datetime('now'),
            atualizado_em = datetime('now')
        WHERE id = ?
      `).run(req.params.id);

      db.prepare(`
        UPDATE requisicoes
        SET status = 'Devolvida', respondido_em = COALESCE(respondido_em, datetime('now'))
        WHERE ativo_id = ? AND status = 'Aprovada'
      `).run(req.params.id);

      registrarAuditoria({
        entidade: 'ativos',
        entidadeId: req.params.id,
        acao: 'DEVOLVER_ATIVO',
        usuarioId: req.usuario.id,
        detalhes: { observacao: req.body.observacao || null },
      });

      return buscarAtivo(req.params.id);
    });

    return res.json({ sucesso: true, mensagem: 'Ativo devolvido e disponivel novamente.', dados: transacao() });
  }
);

router.patch(
  '/:id/manutencao',
  autenticar,
  exigirPerfil('master', 'admin', 'gestor'),
  [param('id').isInt({ min: 1 }), body('observacao').optional().isString().trim().isLength({ max: 500 })],
  validar,
  (req, res) => alterarStatusOperacional(req, res, 'Manutencao', 'ENVIAR_MANUTENCAO')
);

router.patch(
  '/:id/disponibilizar',
  autenticar,
  exigirPerfil('master', 'admin', 'gestor'),
  [param('id').isInt({ min: 1 }), body('observacao').optional().isString().trim().isLength({ max: 500 })],
  validar,
  (req, res) => alterarStatusOperacional(req, res, 'Disponivel', 'DISPONIBILIZAR_ATIVO')
);

router.patch(
  '/:id/baixar',
  autenticar,
  exigirPerfil('admin'),
  [param('id').isInt({ min: 1 }), body('observacao').optional().isString().trim().isLength({ max: 500 })],
  validar,
  (req, res) => alterarStatusOperacional(req, res, 'Baixado', 'BAIXAR_ATIVO')
);

function alterarStatusOperacional(req, res, status, acao) {
  const ativo = buscarAtivo(req.params.id);
  if (!ativo) return res.status(404).json({ sucesso: false, mensagem: 'Ativo nao encontrado.' });

  db.prepare(`
    UPDATE ativos
    SET status = ?,
        usuario_atual_id = NULL,
        responsavel_nome = NULL,
        responsavel_setor = NULL,
        responsavel_lider = NULL,
        responsavel_turno = NULL,
        atualizado_em = datetime('now')
    WHERE id = ?
  `).run(status, req.params.id);

  registrarAuditoria({
    entidade: 'ativos',
    entidadeId: req.params.id,
    acao,
    usuarioId: req.usuario.id,
    detalhes: { observacao: req.body.observacao || null, statusAnterior: ativo.status },
  });

  return res.json({ sucesso: true, dados: buscarAtivo(req.params.id) });
}

module.exports = router;
