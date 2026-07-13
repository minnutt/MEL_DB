@echo off
setlocal
cd /d "%~dp0"
set "PATH=C:\Program Files\PostgreSQL\17\bin;C:\Program Files\nodejs;%PATH%"

if not exist node_modules (
  echo Installing dependencies...
  npm install
  if errorlevel 1 exit /b 1
)

if not exist .env (
  if exist .env.example (
    copy /y .env.example .env >nul
    echo Created .env from .env.example
  )
)

if not exist .pgdata (
  > .pgpass.tmp echo|set /p=postgres
  initdb -D ".pgdata" -U postgres -A scram-sha-256 --pwfile=".pgpass.tmp"
  del /q .pgpass.tmp
)

pg_isready -h localhost -p 5432 >nul 2>&1
if errorlevel 1 (
  pg_ctl -D ".pgdata" -l ".pgdata\postgres.log" -o "\"-p 5432\"" start
)

node server.js
