const { DatabaseSync } = require('node:sqlite');
const path = require('path');

const serials = [
  'MT9055GL2WEXEM00741',
  'S24176523023189',
  'S23090523022825',
  'MT9055GL2WEXEM00719',
  'MT9055GL2WEXEM00688',
  'MT9055GL2WEXFD00539',
  'MT9055GL2WEXEM00122',
  'MT9055GL2WEXFC00948',
  'MT9055GL2WEXEK10982',
  'MT9055GL2WEXEM00455',
  'MT9055GL2WEXEJ04530',
  'S24058523021915',
  'MT9055GL2WEXFD01187',
  'S24079523021812',
  'S23065523021634',
  'MT9055GL2WEXEG07199',
  'MT9055GL2WEXFC00938',
  'S24058523022201',
  'MT9055GL2WEXEM00082',
  'S24107523021444',
  'MT9055GL2WEXEJ04633',
  'MT9055GL2WEXEG07668',
  'MT9055GL2WEXEM00227',
  'MT9055GL2WEXFD01347',
  'MT9055GL2WEXEM00242',
  'MT9055GL2WEXEM00220',
  'MT9055GL2WEXFJ03826',
  'MT9055GL2WEXEM00684',
  'MT9055GL2WEXEM00783',
  'MT9055GL2WEXFC00908',
  'MT9055GL2WEXFD01141',
  'MT9055GL2WEXEM00110',
  'S24058523021741',
  'S23340523020895',
  'MT9055GL2WEXFJ03848',
  'MT9055GL2WEXFD01273',
  'MT9055GL2WEXFD01275',
  'MT9055GL2WEXEM00194',
  'MT9055GL2WEXEM00228',
  'S23104523020238',
  'S22246523023512',
  'MT9055GL2WEXEJ04607',
  'MT9055GL2WEXEG07629',
  'S24080523020037',
  'S24079523021643',
  'S24080523020072',
  'MT9055GL2WEXEM00699',
  'MT9055GL2WEXFJ04130',
  'MT9055GL2WEXFL00118',
  'MT9055GL2WEXFJ04054',
  'MT9055GL2WEXFK00028',
];

const dbPath = path.join(__dirname, '..', 'controle_ativos.db');
const db = new DatabaseSync(dbPath);
const uniqueSerials = [...new Set(serials)];

const find = db.prepare(`
  SELECT id
  FROM ativos
  WHERE numero_serie = ? OR codigo_patrimonio = ?
  LIMIT 1
`);

const update = db.prepare(`
  UPDATE ativos
  SET status = 'Manutencao',
      atualizado_em = datetime('now')
  WHERE id = ?
`);

let updated = 0;
const missing = [];

db.exec('BEGIN');
try {
  for (const serial of uniqueSerials) {
    const asset = find.get(serial, serial);
    if (!asset) {
      missing.push(serial);
      continue;
    }
    updated += update.run(asset.id).changes;
  }
  db.exec('COMMIT');
} catch (error) {
  db.exec('ROLLBACK');
  throw error;
}

const summary = db.prepare(`
  SELECT status, COUNT(*) AS total
  FROM ativos
  WHERE tipo = 'PDA'
  GROUP BY status
  ORDER BY status
`).all();

console.log(JSON.stringify({
  recebidos: serials.length,
  unicos: uniqueSerials.length,
  atualizados: updated,
  naoEncontrados: missing,
  resumoPda: summary,
}, null, 2));
