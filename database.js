const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const crypto = require('crypto');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'controle_ativos.db');
const DB_DIR = path.dirname(DB_PATH);
if (!require('fs').existsSync(DB_DIR)) require('fs').mkdirSync(DB_DIR, { recursive: true });
const db = new DatabaseSync(DB_PATH);

db.exec('PRAGMA foreign_keys = ON;');

db.exec(`
  CREATE TABLE IF NOT EXISTS usuarios (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    nome          TEXT NOT NULL,
    email         TEXT NOT NULL UNIQUE,
    matricula     TEXT UNIQUE,
    cargo         TEXT,
    filial        TEXT,
    perfil        TEXT NOT NULL DEFAULT 'colaborador',
    senha_hash    TEXT,
    ativo         INTEGER NOT NULL DEFAULT 1,
    criado_em     TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS ativos (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    codigo_patrimonio   TEXT NOT NULL UNIQUE,
    tipo                TEXT NOT NULL CHECK (tipo IN ('PDA', 'Notebook', 'Radio', 'Coletor', 'Impressora', 'Paleteira', 'Outro')),
    modelo              TEXT,
    numero_serie        TEXT,
    status              TEXT NOT NULL DEFAULT 'Disponivel'
                          CHECK (status IN ('Disponivel', 'Em Uso', 'Manutencao', 'Baixado')),
    usuario_atual_id    INTEGER,
    filial              TEXT,
    observacoes         TEXT,
    criado_em           TEXT NOT NULL DEFAULT (datetime('now')),
    atualizado_em       TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (usuario_atual_id) REFERENCES usuarios (id)
      ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS requisicoes (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    usuario_id        INTEGER NOT NULL,
    ativo_id          INTEGER NOT NULL,
    status            TEXT NOT NULL DEFAULT 'Pendente'
                        CHECK (status IN ('Pendente', 'Aprovada', 'Rejeitada', 'Devolvida')),
    justificativa     TEXT,
    motivo_rejeicao   TEXT,
    aprovado_por      INTEGER,
    solicitado_em     TEXT NOT NULL DEFAULT (datetime('now')),
    respondido_em     TEXT,
    FOREIGN KEY (usuario_id) REFERENCES usuarios (id)
      ON DELETE CASCADE,
    FOREIGN KEY (ativo_id) REFERENCES ativos (id)
      ON DELETE CASCADE,
    FOREIGN KEY (aprovado_por) REFERENCES usuarios (id)
      ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS auditoria (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    entidade        TEXT NOT NULL,
    entidade_id     INTEGER,
    acao            TEXT NOT NULL,
    usuario_id      INTEGER,
    detalhes        TEXT,
    criado_em       TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (usuario_id) REFERENCES usuarios (id)
      ON DELETE SET NULL
  );

  CREATE INDEX IF NOT EXISTS idx_requisicoes_status ON requisicoes (status);
  CREATE INDEX IF NOT EXISTS idx_ativos_status ON ativos (status);
  CREATE INDEX IF NOT EXISTS idx_auditoria_entidade ON auditoria (entidade, entidade_id);
`);

function colunasDaTabela(tabela) {
  return db.prepare(`PRAGMA table_info(${tabela})`).all().map((coluna) => coluna.name);
}

function adicionarColunaSeNaoExistir(tabela, coluna, sql) {
  if (!colunasDaTabela(tabela).includes(coluna)) {
    db.exec(`ALTER TABLE ${tabela} ADD COLUMN ${sql}`);
  }
}

adicionarColunaSeNaoExistir('usuarios', 'perfil', "perfil TEXT NOT NULL DEFAULT 'colaborador'");
adicionarColunaSeNaoExistir('usuarios', 'senha_hash', 'senha_hash TEXT');
adicionarColunaSeNaoExistir('ativos', 'responsavel_nome', 'responsavel_nome TEXT');
adicionarColunaSeNaoExistir('ativos', 'responsavel_setor', 'responsavel_setor TEXT');
adicionarColunaSeNaoExistir('ativos', 'responsavel_lider', 'responsavel_lider TEXT');
adicionarColunaSeNaoExistir('ativos', 'responsavel_turno', 'responsavel_turno TEXT');
adicionarColunaSeNaoExistir('ativos', 'entregue_em', 'entregue_em TEXT');
adicionarColunaSeNaoExistir('ativos', 'devolvido_em', 'devolvido_em TEXT');

function hashSenha(senha) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(String(senha), salt, 120000, 32, 'sha256').toString('hex');
  return `${salt}:${hash}`;
}

function garantirMasterInicial() {
  const master = db.prepare('SELECT id FROM usuarios WHERE lower(email) = lower(?) LIMIT 1').get('master@shopee.com');
  if (!master) {
    db.prepare(`
      INSERT INTO usuarios (nome, email, matricula, cargo, filial, perfil, senha_hash)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run('Matheus Rodrigues', 'master@shopee.com', 'MASTER-001', 'Dono do Sistema', 'RJ2', 'master', hashSenha('master123'));
    return;
  }
  db.prepare("UPDATE usuarios SET perfil = 'master', senha_hash = COALESCE(senha_hash, ?) WHERE id = ?")
    .run(hashSenha('master123'), master.id);
}

garantirMasterInicial();
function garantirAdminInicial() {
  const adminComSenha = db
    .prepare("SELECT id FROM usuarios WHERE perfil IN ('master','admin') AND senha_hash IS NOT NULL LIMIT 1")
    .get();

  if (adminComSenha) return;

  const primeiroUsuario = db.prepare('SELECT id FROM usuarios ORDER BY id LIMIT 1').get();
  if (primeiroUsuario) {
    db.prepare("UPDATE usuarios SET perfil = 'admin', senha_hash = ? WHERE id = ?")
      .run(hashSenha('admin123'), primeiroUsuario.id);
    return;
  }

  db.prepare(`
    INSERT INTO usuarios (nome, email, cargo, filial, perfil, senha_hash)
    VALUES (?, ?, ?, ?, 'admin', ?)
  `).run('Administrador', 'admin@local', 'Administrador', 'RJ02', hashSenha('admin123'));
}

garantirAdminInicial();

db.transaction = function (fn) {
  return (...args) => {
    db.exec('BEGIN');
    try {
      const resultado = fn(...args);
      db.exec('COMMIT');
      return resultado;
    } catch (erro) {
      db.exec('ROLLBACK');
      throw erro;
    }
  };
};

module.exports = db;


