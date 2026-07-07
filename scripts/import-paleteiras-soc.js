const { DatabaseSync } = require('node:sqlite');
const path = require('path');

const sectors = [
  ['Reversa', 6],
  ['Inbound', 50],
  ['InterSoC', 10],
  ['Esteira B', 23],
  ['Almoxarifado', 15],
  ['Meio Ambiente', 4],
  ['Hub', 55],
  ['QB', 9],
  ['Manutenção', 11],
];

const dbPath = path.join(__dirname, '..', 'controle_ativos.db');
const db = new DatabaseSync(dbPath);

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
  VALUES (?, 'Paleteira', 'Paleteira SOC', ?, 'Disponivel', 'RJ02', ?)
`);

function normalizeSector(sector) {
  return sector
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toUpperCase();
}

let inserted = 0;
let existing = 0;

db.exec('BEGIN');
try {
  for (const [sector, total] of sectors) {
    const prefix = `PALETEIRA-SOC-${normalizeSector(sector)}`;
    for (let index = 1; index <= total; index += 1) {
      const code = `${prefix}-${String(index).padStart(3, '0')}`;
      if (find.get(code)) {
        existing += 1;
        continue;
      }
      inserted += insert.run(code, code, sector).changes;
    }
  }
  db.exec('COMMIT');
} catch (error) {
  db.exec('ROLLBACK');
  throw error;
}

const summary = db.prepare(`
  SELECT observacoes AS setor, COUNT(*) AS total
  FROM ativos
  WHERE tipo = 'Paleteira'
    AND modelo = 'Paleteira SOC'
  GROUP BY observacoes
  ORDER BY observacoes
`).all();

const grandTotal = summary.reduce((sum, row) => sum + row.total, 0);

console.log(JSON.stringify({ inseridos: inserted, existentes: existing, total: grandTotal, resumo: summary }, null, 2));
