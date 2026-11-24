#!/usr/bin/env bash
# Sobe um PostgreSQL só seu, sem sudo, na porta 5433, com os dados em packages/server/.pg-local.
# Usa o PostgreSQL instalado no sistema (apt install postgresql). Para parar: bash este-script stop
set -euo pipefail
PASTA="$(cd "$(dirname "$0")/.." && pwd)/.pg-local"
BIN="$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)"
[ -x "$BIN/initdb" ] || { echo "PostgreSQL não encontrado. Instale com: sudo apt install postgresql"; exit 1; }
if [ "${1:-}" = "stop" ]; then "$BIN/pg_ctl" -D "$PASTA" stop; exit 0; fi
if [ ! -f "$PASTA/PG_VERSION" ]; then
  "$BIN/initdb" -D "$PASTA" -U postgres --auth=trust >/dev/null
fi
if ! "$BIN/pg_ctl" -D "$PASTA" status >/dev/null 2>&1; then
  "$BIN/pg_ctl" -D "$PASTA" -o "-p 5433 -k '' -c listen_addresses=127.0.0.1" -l "$PASTA/postgres.log" start
fi
psql -h 127.0.0.1 -p 5433 -U postgres -tAc "select 1 from pg_database where datname='consultorasync'" | grep -q 1 \
  || psql -h 127.0.0.1 -p 5433 -U postgres -c "create database consultorasync"
echo "PostgreSQL local pronto: postgresql://postgres@127.0.0.1:5433/consultorasync"
