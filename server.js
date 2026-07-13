// ═══════════════════════════════════════════════════════════════
//  STQC DataVault — Node.js HTTP server (no Express; only `pg` dep)
//  Database : meldb  |  Default : http://0.0.0.0:3000
// ═══════════════════════════════════════════════════════════════

const http = require('http');
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

function loadDotEnv() {
  const envPath = path.join(__dirname, '.env');
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq === -1) continue;
    const key = t.slice(0, eq).trim();
    let val = t.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (key && process.env[key] === undefined) {
      process.env[key] = val;
    }
  }
}

loadDotEnv();

const PORT = parseInt(process.env.PORT || '3000', 10);
const HOST = process.env.HOST || '0.0.0.0';

const INDEX_HTML = path.join(__dirname, 'index.html');

// ── PostgreSQL Pool ────────────────────────────────────────────
const pool = new Pool({
  host: process.env.PGHOST || 'localhost',
  port: parseInt(process.env.PGPORT || '5432', 10),
  database: process.env.PGDATABASE || 'meldb',
  user: process.env.PGUSER || 'stqc',
  password: process.env.PGPASSWORD || 'stqcit@123',
});

pool.connect((err, client, release) => {
  if (err) {
    console.error('❌  Cannot connect to meldb:', err.message);
    console.error('    Server still starts — fix PostgreSQL and restart.');
    return;
  }
  release();
  console.log('✅  Connected to meldb');
});

async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS srf_records (

      id              SERIAL        PRIMARY KEY,
      srf_no          VARCHAR(100)  NOT NULL,
      srf_date        DATE          NOT NULL,

      job_no          VARCHAR(100),
      job_date        DATE,

      date_of_reception    DATE,
      condition_of_samples VARCHAR(200),

      category_type   VARCHAR(20),
      category_sub    VARCHAR(30),

      part_no         VARCHAR(150),
      marking         VARCHAR(200),
      date_code       VARCHAR(50),
      batch_no        VARCHAR(100),
      quantity        INTEGER,

      type_of_test    VARCHAR(200),
      readings        TEXT,
      failures        INTEGER DEFAULT 0,

      po_no           VARCHAR(100),
      po_date         DATE,
      fn_no           VARCHAR(100),
      fn_date         DATE,
      tracer_card     VARCHAR(100),
      report_no       VARCHAR(100),
      report_date     DATE,
      dn_no           VARCHAR(100),
      dn_date         DATE,

      created_at      TIMESTAMPTZ   DEFAULT NOW(),

      UNIQUE (srf_no, srf_date)
    );
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_srf_no   ON srf_records(LOWER(srf_no));
    CREATE INDEX IF NOT EXISTS idx_srf_date ON srf_records(srf_date);
    CREATE INDEX IF NOT EXISTS idx_job_no   ON srf_records(LOWER(job_no));
  `);

  console.log('✅  Table "srf_records" is ready');
}
initDB().catch((e) => console.error('initDB:', e.message));

function mapRow(r) {
  const fmt = (d) => {
    if (!d) return '';
    const dt = new Date(d);
    if (Number.isNaN(dt.getTime())) return '';
    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, '0');
    const day = String(dt.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };
  return {
    id: r.id,
    srf_no: r.srf_no || '',
    srf_date: fmt(r.srf_date),
    job_no: r.job_no || '',
    job_date: fmt(r.job_date),
    date_of_reception: fmt(r.date_of_reception),
    condition_of_samples: r.condition_of_samples || '',
    category_type: r.category_type || '',
    category_sub: r.category_sub || '',
    part_no: r.part_no || '',
    marking: r.marking || '',
    date_code: r.date_code || '',
    batch_no: r.batch_no || '',
    quantity: r.quantity ?? '',
    type_of_test: r.type_of_test || '',
    readings: r.readings || '',
    failures: r.failures ?? 0,
    po_no: r.po_no || '',
    po_date: fmt(r.po_date),
    fn_no: r.fn_no || '',
    fn_date: fmt(r.fn_date),
    tracer_card: r.tracer_card || '',
    report_no: r.report_no || '',
    report_date: fmt(r.report_date),
    dn_no: r.dn_no || '',
    dn_date: fmt(r.dn_date),
    created_at: fmt(r.created_at),
  };
}

function corsHeaders(extra = {}) {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    ...extra,
  };
}

function sendJson(res, status, obj) {
  res.writeHead(status, corsHeaders({ 'Content-Type': 'application/json; charset=utf-8' }));
  res.end(JSON.stringify(obj));
}

function sendHtmlFile(res, filepath) {
  fs.readFile(filepath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('index.html not found. Run the server from the project folder.');
      return;
    }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(data);
  });
}

function readBodyJson(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8');
        resolve(raw ? JSON.parse(raw) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, corsHeaders());
    res.end();
    return;
  }

  let url;
  try {
    url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  } catch {
    sendJson(res, 400, { success: false, error: 'Bad request' });
    return;
  }

  const pathname = url.pathname;

  try {
    // ── API ─────────────────────────────────────────────────
    if (pathname === '/api/ping' && req.method === 'GET') {
      await pool.query('SELECT 1');
      sendJson(res, 200, { ok: true });
      return;
    }

    if (pathname === '/api/records' && req.method === 'GET') {
      const { rows } = await pool.query('SELECT * FROM srf_records ORDER BY created_at DESC');
      sendJson(res, 200, { success: true, data: rows.map(mapRow) });
      return;
    }

    const recordIdMatch = pathname.match(/^\/api\/records\/(\d+)$/);
    if (recordIdMatch && req.method === 'GET') {
      const { rows } = await pool.query('SELECT * FROM srf_records WHERE id = $1 LIMIT 1', [
        recordIdMatch[1],
      ]);
      if (rows.length === 0) {
        sendJson(res, 404, { success: false, error: 'Record not found.' });
        return;
      }
      sendJson(res, 200, { success: true, data: mapRow(rows[0]) });
      return;
    }

    if (pathname === '/api/lookup' && req.method === 'GET') {
      const srf_no = url.searchParams.get('srf_no');
      const srf_date = url.searchParams.get('srf_date');
      if (!srf_no || !srf_date) {
        sendJson(res, 400, {
          success: false,
          error: 'srf_no and srf_date are both required for lookup.',
        });
        return;
      }
      const { rows } = await pool.query(
        `SELECT * FROM srf_records
         WHERE LOWER(srf_no) = LOWER($1) AND srf_date = $2
         LIMIT 1`,
        [srf_no.trim(), srf_date]
      );
      if (rows.length === 0) {
        sendJson(res, 200, {
          success: false,
          error: `No record found for SRF No. "${srf_no}" on ${srf_date}.`,
        });
        return;
      }
      sendJson(res, 200, { success: true, data: mapRow(rows[0]) });
      return;
    }

    if (pathname === '/api/stats' && req.method === 'GET') {
      const { rows } = await pool.query(`
        SELECT
          COUNT(*)                                             AS total,
          COUNT(*) FILTER (WHERE category_type = 'Digital')   AS digital,
          COUNT(*) FILTER (WHERE category_type = 'Linear')    AS linear,
          COUNT(*) FILTER (WHERE failures > 0)                AS with_failures
        FROM srf_records
      `);
      sendJson(res, 200, { success: true, data: rows[0] });
      return;
    }

    if (pathname === '/api/records' && req.method === 'POST') {
      const b = await readBodyJson(req);
      if (!b.srf_no || !b.srf_date) {
        sendJson(res, 400, { success: false, error: 'SRF No. and SRF Date are required fields.' });
        return;
      }
      const { rows } = await pool.query(
        `
      INSERT INTO srf_records (
        srf_no, srf_date,
        job_no, job_date,
        date_of_reception, condition_of_samples,
        category_type, category_sub,
        part_no, marking, date_code, batch_no, quantity,
        type_of_test, readings, failures,
        po_no, po_date,
        fn_no, fn_date,
        tracer_card,
        report_no, report_date,
        dn_no, dn_date
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,
        $14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25
      )
      ON CONFLICT (srf_no, srf_date)
      DO UPDATE SET
        job_no               = EXCLUDED.job_no,
        job_date             = EXCLUDED.job_date,
        date_of_reception    = EXCLUDED.date_of_reception,
        condition_of_samples = EXCLUDED.condition_of_samples,
        category_type        = EXCLUDED.category_type,
        category_sub         = EXCLUDED.category_sub,
        part_no              = EXCLUDED.part_no,
        marking              = EXCLUDED.marking,
        date_code            = EXCLUDED.date_code,
        batch_no             = EXCLUDED.batch_no,
        quantity             = EXCLUDED.quantity,
        type_of_test         = EXCLUDED.type_of_test,
        readings             = EXCLUDED.readings,
        failures             = EXCLUDED.failures,
        po_no                = EXCLUDED.po_no,
        po_date              = EXCLUDED.po_date,
        fn_no                = EXCLUDED.fn_no,
        fn_date              = EXCLUDED.fn_date,
        tracer_card          = EXCLUDED.tracer_card,
        report_no            = EXCLUDED.report_no,
        report_date          = EXCLUDED.report_date,
        dn_no                = EXCLUDED.dn_no,
        dn_date              = EXCLUDED.dn_date
      RETURNING id, srf_no
    `,
        [
          String(b.srf_no).trim(),
          b.srf_date || null,
          b.job_no || null,
          b.job_date || null,
          b.date_of_reception || null,
          b.condition_of_samples || null,
          b.category_type || null,
          b.category_sub || null,
          b.part_no || null,
          b.marking || null,
          b.date_code || null,
          b.batch_no || null,
          b.quantity ? parseInt(b.quantity, 10) : null,
          b.type_of_test || null,
          b.readings || null,
          b.failures ? parseInt(b.failures, 10) : 0,
          b.po_no || null,
          b.po_date || null,
          b.fn_no || null,
          b.fn_date || null,
          b.tracer_card || null,
          b.report_no || null,
          b.report_date || null,
          b.dn_no || null,
          b.dn_date || null,
        ]
      );
      sendJson(res, 200, { success: true, id: rows[0].id, srf_no: rows[0].srf_no });
      return;
    }

    if (recordIdMatch && req.method === 'DELETE') {
      await pool.query('DELETE FROM srf_records WHERE id = $1', [recordIdMatch[1]]);
      sendJson(res, 200, { success: true });
      return;
    }

    // ── Frontend (never expose server.js via static dir) ─────
    if (req.method === 'GET' && (pathname === '/' || pathname === '/index.html')) {
      sendHtmlFile(res, INDEX_HTML);
      return;
    }

    if (req.method === 'GET' && !pathname.startsWith('/api')) {
      sendHtmlFile(res, INDEX_HTML);
      return;
    }

    sendJson(res, 404, { success: false, error: 'Not found' });
  } catch (err) {
    console.error(req.method, pathname, err.message);
    sendJson(res, 500, { success: false, error: err.message });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`🚀  STQC DataVault`);
  console.log(`    Open in browser: http://localhost:${PORT}`);
  console.log(`    (bound to ${HOST}:${PORT} — use LAN IP if needed)`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`❌  Port ${PORT} is already in use.`);
    console.error('    PowerShell:   $env:PORT=3001; node server.js');
    console.error('    CMD:          set PORT=3001&& node server.js');
  } else {
    console.error('❌  Server error:', err.message);
  }
  process.exit(1);
});
