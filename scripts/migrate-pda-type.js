const { DatabaseSync } = require('node:sqlite');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'controle_ativos.db');
const db = new DatabaseSync(dbPath);

db.exec('PRAGMA foreign_keys=OFF');
db.exec('BEGIN');

try {
  db.exec(`
    CREATE TABLE ativos_new (
      id                  INTEGER PRIMARY KEY AUTOINCREMENT,
      codigo_patrimonio   TEXT NOT NULL UNIQUE,
      tipo                TEXT NOT NULL CHECK (tipo IN ('PDA', 'Coletor', 'Impressora', 'Paleteira', 'Outro')),
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
      CASE
        WHEN numero_serie LIKE 'MT%'
          OR numero_serie LIKE 'S%'
          OR modelo IN ('NewLand NLS-MT90', 'Zebra TC210K')
        THEN 'PDA'
        ELSE tipo
      END,
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
  GROUP BY tipo, modelo, status
  ORDER BY tipo, modelo, status
`).all();

console.log(JSON.stringify(summary, null, 2));
