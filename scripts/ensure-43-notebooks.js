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

const desiredCounts = serials.reduce((map, serial) => {
  map.set(serial, (map.get(serial) || 0) + 1);
  return map;
}, new Map());

const existingBySerial = db.prepare(`
  SELECT id, codigo_patrimonio, numero_serie
  FROM ativos
  WHERE tipo = 'Notebook'
    AND numero_serie = ?
  ORDER BY id
`);

const existingByCode = db.prepare(`
  SELECT id
  FROM ativos
  WHERE codigo_patrimonio = ?
  LIMIT 1
`);

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

function duplicateCode(serial, occurrence) {
  return `${serial}-${String(occurrence).padStart(2, '0')}`;
}

let inserted = 0;

db.exec('BEGIN');
try {
  for (const [serial, desiredTotal] of desiredCounts.entries()) {
    const existing = existingBySerial.all(serial);
    for (let occurrence = existing.length + 1; occurrence <= desiredTotal; occurrence += 1) {
      let code = occurrence === 1 ? serial : duplicateCode(serial, occurrence);
      let suffix = occurrence;
      while (existingByCode.get(code)) {
        suffix += 1;
        code = duplicateCode(serial, suffix);
      }
      inserted += insert.run(code, serial).changes;
    }
  }
  db.exec('COMMIT');
} catch (error) {
  db.exec('ROLLBACK');
  throw error;
}

const summary = db.prepare(`
  SELECT tipo, status, COUNT(*) AS total
  FROM ativos
  WHERE tipo = 'Notebook'
  GROUP BY tipo, status
  ORDER BY status
`).all();

console.log(JSON.stringify({
  recebidos: serials.length,
  seriaisUnicos: desiredCounts.size,
  inseridosAgora: inserted,
  resumo: summary,
}, null, 2));
