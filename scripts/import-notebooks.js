const { DatabaseSync } = require('node:sqlite');
const path = require('path');

const serials = [
  'PEN015827455',
  'PEN015827453',
  'PEN015827454',
  'PE9015A10095',
  'PEN015827453',
  '1S20TBS1D000PE07FEA4',
  'PEN015827453',
  'PEN015827453',
  'PEN015827454',
  'PEN015826310',
  'PE9015707089',
  'PEN015827453',
  '1S20TBS1D000PE0COPITO',
  'PEN015827453',
  '1S20RBS7H200PE0764M4',
  'PEN015211084',
  'PE9015A10093',
  'PE9015708245',
  'PE9015A10093',
  '1S20TBS1D000PE0REVFM',
  'PEN015827453',
  'PE9015708249',
  'PEN015827453',
  'PEN015827453',
  'PEN015827454',
  'PEN015827455',
  'PEN015827456',
  'PEN015827457',
  'PEN015827458',
  'PEN015827459',
  'PEN015827460',
  'PEN015827461',
  'PEN015827462',
  'PEN015827463',
  'PEN015827464',
  'PEN015827465',
  'PEN015827466',
  'PEN015827467',
  'PEN015827468',
  'PEN015827469',
  'PEN015827470',
  'PEN015827471',
  'PEN015827472',
];

const dbPath = path.join(__dirname, '..', 'controle_ativos.db');
const db = new DatabaseSync(dbPath);
const uniqueSerials = [...new Set(serials.map((serial) => serial.trim()).filter(Boolean))];

function rebuildAssetsTable() {
  db.exec('DROP TABLE IF EXISTS ativos_new');
  db.exec(`
    CREATE TABLE ativos_new (
      id                  INTEGER PRIMARY KEY AUTOINCREMENT,
      codigo_patrimonio   TEXT NOT NULL UNIQUE,
      tipo                TEXT NOT NULL CHECK (tipo IN ('PDA', 'Notebook', 'Coletor', 'Impressora', 'Paleteira', 'Outro')),
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

const find = db.prepare(`
  SELECT id
  FROM ativos
  WHERE codigo_patrimonio = ? OR numero_serie = ?
  LIMIT 1
`);

db.exec('PRAGMA foreign_keys=OFF');
db.exec('BEGIN');

let inserted = 0;
let updated = 0;

try {
  rebuildAssetsTable();

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
    VALUES (?, 'Notebook', 'Notebook', ?, 'Disponivel', 'RJ02', 'Inventário Notebook')
  `);

  const update = db.prepare(`
    UPDATE ativos
    SET tipo = 'Notebook',
        modelo = 'Notebook',
        numero_serie = ?,
        filial = COALESCE(filial, 'RJ02'),
        observacoes = COALESCE(observacoes, 'Inventário Notebook'),
        atualizado_em = datetime('now')
    WHERE id = ?
  `);

  for (const serial of uniqueSerials) {
    const existing = find.get(serial, serial);
    if (existing) {
      updated += update.run(serial, existing.id).changes;
    } else {
      inserted += insert.run(serial, serial).changes;
    }
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
  WHERE tipo IN ('PDA', 'Notebook')
  GROUP BY tipo, modelo, status
  ORDER BY tipo, modelo, status
`).all();

console.log(JSON.stringify({
  recebidos: serials.length,
  unicos: uniqueSerials.length,
  inseridos: inserted,
  atualizados: updated,
  resumo: summary,
}, null, 2));
