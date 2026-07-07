const db = require('../database');
const { registrarAuditoria } = require('../routes/auth');

const RequisicaoModel = {
  listarPendentes() {
    return db.prepare(`
      SELECT
        r.id,
        r.status,
        r.justificativa,
        r.solicitado_em,
        u.id   AS usuario_id,
        u.nome AS usuario_nome,
        u.filial AS usuario_filial,
        a.id   AS ativo_id,
        a.codigo_patrimonio,
        a.tipo AS ativo_tipo,
        a.modelo AS ativo_modelo
      FROM requisicoes r
      INNER JOIN usuarios u ON u.id = r.usuario_id
      INNER JOIN ativos   a ON a.id = r.ativo_id
      WHERE r.status = 'Pendente'
      ORDER BY r.solicitado_em ASC
    `).all();
  },

  buscarPorId(id) {
    return db.prepare('SELECT * FROM requisicoes WHERE id = ?').get(id);
  },

  aprovar(requisicaoId, aprovadoPorUsuarioId) {
    const transacao = db.transaction((reqId, aprovadorId) => {
      const requisicao = db.prepare('SELECT * FROM requisicoes WHERE id = ?').get(reqId);

      if (!requisicao) throw new Error('REQUISICAO_NAO_ENCONTRADA');
      if (requisicao.status !== 'Pendente') throw new Error('REQUISICAO_JA_PROCESSADA');

      const ativo = db.prepare('SELECT * FROM ativos WHERE id = ?').get(requisicao.ativo_id);
      if (!ativo || ativo.status !== 'Disponivel') throw new Error('ATIVO_INDISPONIVEL');

      db.prepare(`
        UPDATE requisicoes
        SET status = 'Aprovada',
            aprovado_por = ?,
            respondido_em = datetime('now')
        WHERE id = ?
      `).run(aprovadorId, reqId);

      db.prepare(`
        UPDATE ativos
        SET status = 'Em Uso',
            usuario_atual_id = ?,
            atualizado_em = datetime('now')
        WHERE id = ?
      `).run(requisicao.usuario_id, requisicao.ativo_id);

      registrarAuditoria({
        entidade: 'requisicoes',
        entidadeId: reqId,
        acao: 'APROVAR_REQUISICAO',
        usuarioId: aprovadorId,
        detalhes: { ativoId: requisicao.ativo_id, usuarioId: requisicao.usuario_id },
      });

      return db.prepare('SELECT * FROM requisicoes WHERE id = ?').get(reqId);
    });

    return transacao(requisicaoId, aprovadoPorUsuarioId);
  },

  rejeitar(requisicaoId, aprovadoPorUsuarioId, motivo) {
    const transacao = db.transaction((reqId, aprovadorId, motivoRejeicao) => {
      const requisicao = db.prepare('SELECT * FROM requisicoes WHERE id = ?').get(reqId);

      if (!requisicao) throw new Error('REQUISICAO_NAO_ENCONTRADA');
      if (requisicao.status !== 'Pendente') throw new Error('REQUISICAO_JA_PROCESSADA');

      db.prepare(`
        UPDATE requisicoes
        SET status = 'Rejeitada',
            aprovado_por = ?,
            motivo_rejeicao = ?,
            respondido_em = datetime('now')
        WHERE id = ?
      `).run(aprovadorId, motivoRejeicao || null, reqId);

      registrarAuditoria({
        entidade: 'requisicoes',
        entidadeId: reqId,
        acao: 'REJEITAR_REQUISICAO',
        usuarioId: aprovadorId,
        detalhes: { motivo: motivoRejeicao || null },
      });

      return db.prepare('SELECT * FROM requisicoes WHERE id = ?').get(reqId);
    });

    return transacao(requisicaoId, aprovadoPorUsuarioId, motivo);
  },
};

module.exports = RequisicaoModel;
