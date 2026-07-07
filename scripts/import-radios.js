const { DatabaseSync } = require('node:sqlite');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'controle_ativos.db');
const db = new DatabaseSync(dbPath);

function rebuildAssetsTable() {
  db.exec('DROP TABLE IF EXISTS ativos_new');
  db.exec(`
    CREATE TABLE ativos_new (
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
    )
  `);

  db.exec(`
    INSERT INTO ativos_new (
      id,
      codigo_patrimonio,
      tipo,
      modelo,
      numero_serie,
      status,
      usuario_atual_id,
      filial,
      observacoes,
      criado_em,
      atualizado_em
    )
    SELECT
      id,
      codigo_patrimonio,
      tipo,
      modelo,
      numero_serie,
      status,
      usuario_atual_id,
      filial,
      observacoes,
      criado_em,
      atualizado_em
    FROM ativos
  `);

  db.exec('DROP TABLE ativos');
  db.exec('ALTER TABLE ativos_new RENAME TO ativos');
  db.exec('CREATE INDEX IF NOT EXISTS idx_ativos_status ON ativos (status)');
}

const find = db.prepare('SELECT id FROM ativos WHERE codigo_patrimonio = ? LIMIT 1');
const insert = db.prepare(`
  INSERT INTO ativos (
    codigo_patrimonio,
    tipo,
    modelo,
    numero_serie,
    status,
    filial,
    observacoes
  )
  VALUES (?, 'Radio', 'Rádio', ?, 'Disponivel', 'RJ02', 'Inventário Rádio')
`);

let inserted = 0;
let existing = 0;

db.exec('PRAGMA foreign_keys=OFF');
db.exec('BEGIN');
try {
  rebuildAssetsTable();

  for (let index = 1; index <= 24; index += 1) {
    const code = `RADIO-RJ02-${String(index).padStart(3, '0')}`;
    if (find.get(code)) {
      existing += 1;
      continue;
    }
    inserted += insert.run(code, code).changes;
  }

  db.exec('COMMIT');
} catch (error) {
  db.exec('ROLLBACK');
  throw error;
} finally {
  db.exec('PRAGMA foreign_keys=ON');
}

const summary = db.prepare(`
  SELECT tipo, modelo, status, COUNT(*) AS total
  FROM ativos
  WHERE tipo = 'Radio'
  GROUP BY tipo, modelo, status
  ORDER BY status
`).all();

console.log(JSON.stringify({ inseridos: inserted, existentes: existing, resumo: summary }, null, 2));
