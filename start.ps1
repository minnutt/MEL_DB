$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

$env:Path = "C:\Program Files\PostgreSQL\17\bin;C:\Program Files\nodejs;$env:Path"

if (-not (Test-Path "node_modules")) {
  Write-Host "Installing dependencies..."
  npm install
}

if (-not (Test-Path ".env") -and (Test-Path ".env.example")) {
  Copy-Item ".env.example" ".env"
  Write-Host "Created .env from .env.example"
}

if (-not (Test-Path ".pgdata")) {
  "postgres" | Out-File ".pgpass.tmp" -NoNewline
  initdb -D ".pgdata" -U postgres -A scram-sha-256 --pwfile=".pgpass.tmp" | Out-Null
  Remove-Item ".pgpass.tmp"
  Write-Host "Initialized local PostgreSQL cluster in .pgdata"
}

pg_isready -h localhost -p 5432 | Out-Null
if ($LASTEXITCODE -ne 0) {
  pg_ctl -D ".pgdata" -l ".pgdata\postgres.log" -o '"-p 5432"' start | Out-Null
  Start-Sleep -Seconds 2
}

node server.js
