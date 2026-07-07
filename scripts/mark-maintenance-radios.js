const { DatabaseSync } = require('node:sqlite');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'controle_ativos.db');
const db = new DatabaseSync(dbPath);

const goodRadios = Array.from({ length: 24 }, (_, index) => (
  `RADIO-RJ02-${String(index + 1).padStart(3, '0')}`
));
const badRadios = Array.from({ length: 5 }, (_, index) => (
  `RADIO-RJ02-${String(index + 25).padStart(3, '0')}`
));

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
  VALUES (?, 'Radio', 'Radio', ?, ?, 'RJ02', ?)
`);
const updateGood = db.prepare(`
  UPDATE ativos
  SET status = 'Disponivel',
      atualizado_em = datetime('now')
  WHERE tipo = 'Radio'
    AND codigo_patrimonio = ?
`);
const updateBad = db.prepare(`
  UPDATE ativos
  SET status = 'Manutencao',
      observacoes = CASE
        WHEN observacoes IS NULL OR observacoes = '' THEN 'Radio ruim em manutencao'
        WHEN observacoes LIKE '%manutencao%' THEN observacoes
        ELSE observacoes || ' | Radio ruim em manutencao'
      END,
      atualizado_em = datetime('now')
  WHERE tipo = 'Radio'
    AND codigo_patrimonio = ?
`);

db.exec('BEGIN');
let inserted = 0;
let updatedGood = 0;
let updatedBad = 0;

try {
  for (const code of goodRadios) {
    if (!find.get(code)) {
      inserted += insert.run(code, code, 'Disponivel', 'Inventario Radio').changes;
    }
    updatedGood += updateGood.run(code).changes;
  }

  for (const code of badRadios) {
    if (!find.get(code)) {
      inserted += insert.run(code, code, 'Manutencao', 'Radio ruim em manutencao').changes;
    }
    updatedBad += updateBad.run(code).changes;
  }

  db.exec('COMMIT');
} catch (error) {
  db.exec('ROLLBACK');
  throw error;
}

const summary = db.prepare(`
  SELECT status, COUNT(*) AS total
  FROM ativos
  WHERE tipo = 'Radio'
  GROUP BY status
  ORDER BY status
`).all();

console.log(JSON.stringify({ inseridos: inserted, bonsAtualizados: updatedGood, ruinsAtualizados: updatedBad, resumo: summary }, null, 2));
