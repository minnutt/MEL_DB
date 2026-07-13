-- ═══════════════════════════════════════════════════════════
--  STQC DataVault — PostgreSQL Setup Script
--  Database : meldb  |  User : stqc
--
--  Run once:
--    psql -U stqc -d meldb -f setup.sql
-- ═══════════════════════════════════════════════════════════

-- Drop old table if migrating from the generic schema
DROP TABLE IF EXISTS records;

-- Main SRF records table
CREATE TABLE IF NOT EXISTS srf_records (

  -- ── Primary ───────────────────────────────────────────
  id              SERIAL        PRIMARY KEY,
  srf_no          VARCHAR(100)  NOT NULL,
  srf_date        DATE          NOT NULL,

  -- ── Job ───────────────────────────────────────────────
  job_no          VARCHAR(100),
  job_date        DATE,

  -- ── Sample ────────────────────────────────────────────
  date_of_reception    DATE,
  condition_of_samples VARCHAR(200),

  -- ── Category (2-level) ────────────────────────────────
  --    category_type : 'Digital' | 'Linear'
  --    category_sub  :
  --      Digital → SSI | MSI | LSI
  --      Linear  → OP-AMP | REGULATOR | PWM
  category_type   VARCHAR(20),
  category_sub    VARCHAR(30),

  -- ── Device ────────────────────────────────────────────
  part_no         VARCHAR(150),
  marking         VARCHAR(200),
  date_code       VARCHAR(50),
  batch_no        VARCHAR(100),
  quantity        INTEGER,

  -- ── Test ──────────────────────────────────────────────
  type_of_test    VARCHAR(200),
  readings        TEXT,
  failures        INTEGER DEFAULT 0,

  -- ── Documents ─────────────────────────────────────────
  po_no           VARCHAR(100),
  po_date         DATE,
  fn_no           VARCHAR(100),
  fn_date         DATE,
  tracer_card     VARCHAR(100),
  report_no       VARCHAR(100),
  report_date     DATE,
  dn_no           VARCHAR(100),
  dn_date         DATE,

  -- ── Audit ─────────────────────────────────────────────
  created_at      TIMESTAMPTZ   DEFAULT NOW(),

  -- ── Constraint ────────────────────────────────────────
  UNIQUE (srf_no, srf_date)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_srf_no   ON srf_records(LOWER(srf_no));
CREATE INDEX IF NOT EXISTS idx_srf_date ON srf_records(srf_date);
CREATE INDEX IF NOT EXISTS idx_job_no   ON srf_records(LOWER(job_no));

SELECT 'srf_records table is ready.' AS status;
