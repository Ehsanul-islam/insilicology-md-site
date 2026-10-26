#!/usr/bin/env bash
# Builds a fresh throwaway database (Supabase shim, every migration, the seed, test helpers) for EACH
# supabase/tests/*.test.sql file and runs the file in it, so tests cannot affect each other.
# A test file raises an exception on failure.
#
# Needs a reachable Postgres 15+ with pg_trgm available and a superuser connection, e.g.
#   PGHOST=/tmp PGPORT=54329 PGUSER=postgres npm run db:test
#
# DB_TEST_MUTATE=file.sql applies a deliberate break before each test, to prove the tests can fail.
set -euo pipefail
cd "$(dirname "$0")/.."

export PGOPTIONS='--client-min-messages=warning'
PREFIX="insilicology_test_$$"
CURRENT=""
cleanup() { [ -n "$CURRENT" ] && psql -X -q -d postgres -c "drop database if exists $CURRENT" >/dev/null 2>&1 || true; }
trap cleanup EXIT

run() { psql -X -q -v ON_ERROR_STOP=1 -d "$CURRENT" -f "$1" >/dev/null; }

build() {
  local m
  CURRENT="${PREFIX}_$1"
  psql -X -q -v ON_ERROR_STOP=1 -d postgres -c "create database $CURRENT" >/dev/null
  run supabase/tests/00_shim.sql
  for m in supabase/migrations/*.sql; do run "$m"; done
  [ -f supabase/seed.sql ] && run supabase/seed.sql
  run supabase/tests/01_helpers.sql
  [ -n "${DB_TEST_MUTATE:-}" ] && run "$DB_TEST_MUTATE"
  return 0
}

fail=0
i=0
build "migrations"
echo "ok       migrations + seed apply to an empty database ($(ls supabase/migrations/*.sql | wc -l | tr -d ' ') files)"
cleanup

for f in supabase/tests/*.test.sql; do
  [ -e "$f" ] || continue
  i=$((i + 1))
  build "$i"
  if out=$(psql -X -q -v ON_ERROR_STOP=1 -d "$CURRENT" -f "$f" 2>&1); then echo "pass     $f"; else echo "FAIL     $f"; echo "$out" | sed 's/^/         /'; fail=1; fi
  cleanup
done
exit $fail
