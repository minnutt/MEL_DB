# STQC DataVault — SRF Manager

Full-stack SRF (Sample Registration Form) management system.

## Stack
- **Frontend** : HTML/CSS/JS (no framework)
- **Backend**  : Node.js built-in `http` + `pg` (no Express; lighter `npm install`)
- **Database** : PostgreSQL (`meldb`, user: `stqc`)

---

## Database columns (srf_records table)

| Column | Type | Notes |
|--------|------|-------|
| srf_no | VARCHAR | Primary lookup key |
| srf_date | DATE | Primary lookup key (with srf_no) |
| job_no | VARCHAR | Shown on SRF lookup |
| job_date | DATE | |
| date_of_reception | DATE | |
| condition_of_samples | VARCHAR | |
| category_type | VARCHAR | 'Digital' or 'Linear' |
| category_sub | VARCHAR | Digital→SSI/MSI/LSI · Linear→OP-AMP/REGULATOR/PWM |
| part_no | VARCHAR | |
| marking | VARCHAR | Marking on device |
| date_code | VARCHAR | |
| batch_no | VARCHAR | |
| quantity | INTEGER | |
| type_of_test | VARCHAR | |
| readings | TEXT | |
| failures | INTEGER | |
| po_no / po_date | VARCHAR/DATE | PO No. / Date |
| fn_no / fn_date | VARCHAR/DATE | FN No. / Date |
| tracer_card | VARCHAR | |
| report_no / report_date | VARCHAR/DATE | Report No. / Date |
| dn_no / dn_date | VARCHAR/DATE | DN No. / Date |

---

## One-time setup (PostgreSQL)

```bash
# Create DB and user (if not done yet)
psql -U postgres -c "CREATE DATABASE meldb;"
psql -U postgres -c "CREATE USER stqc WITH PASSWORD 'stqcit@123';"
psql -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE meldb TO stqc;"

# Run schema
psql -U stqc -d meldb -f setup.sql
```

Windows PowerShell variant:

```powershell
psql -U postgres -c "CREATE DATABASE meldb;"
psql -U postgres -c "CREATE USER stqc WITH PASSWORD 'stqcit@123';"
psql -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE meldb TO stqc;"
psql -U stqc -d meldb -f .\setup.sql
```

---

## Configure app connection

Copy `.env.example` to `.env` and keep/edit these values:

```env
PGHOST=localhost
PGPORT=5432
PGDATABASE=meldb
PGUSER=stqc
PGPASSWORD=stqcit@123
HOST=0.0.0.0
PORT=3000
```

---

## Run on Windows (recommended)

From the project folder:

```powershell
npm install
npm run setup:db
.\start.ps1
```

Or double-click `start.bat`.

---

## Run on Linux/macOS

From this project folder:

```bash
npm install
npm run setup:db
node server.js
```

Or: `bash start.sh` (runs `npm install` if needed, then starts the server).

Open in the browser: **http://localhost:3000** (do not open `index.html` with `file://` — the app must load through the server so API calls work).

The server listens on **0.0.0.0** by default (reachable as `localhost` or your machine’s LAN IP). Override with `PORT` / `HOST`:

- PowerShell: `$env:PORT=3001; node server.js`
- CMD: `set PORT=3001&& node server.js`
- Bash: `PORT=3001 node server.js`

PostgreSQL settings can be set with `PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER`, `PGPASSWORD` (or through `.env`).

If the page does not load: ensure Node is installed, run `npm install` successfully, PostgreSQL is running, and nothing else is using port 3000.

---

## Verify create + retrieve flow

1. Open `http://localhost:3000`
2. In **Entry Form**, enter at least `SRF No.` + `SRF Date`, then click **Save to meldb**
3. Open **Lookup & Display**, enter the same `SRF No.` + `SRF Date`, click **Fetch Record**
4. Open **All Records** to confirm it appears in the table

---

## API

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/ping` | Health check |
| GET | `/api/records` | All SRF records |
| GET | `/api/lookup?srf_no=&srf_date=` | **Key lookup** — SRF No + Date → full record |
| GET | `/api/stats` | Summary counts |
| POST | `/api/records` | Insert / update record |
| DELETE | `/api/records/:id` | Delete by ID |

---

## Display logic

1. User opens **Lookup & Display** screen
2. Enters **SRF No.** + **SRF Date**
3. System calls `GET /api/lookup?srf_no=...&srf_date=...`
4. Full record card is rendered showing Job No., Job Date, and all other fields
5. Any row in the **All Records** table is also clickable → auto-fills lookup and fetches
