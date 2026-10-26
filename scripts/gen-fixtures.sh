#!/usr/bin/env bash
# Regenerates tests/fixtures/*.json from the real public views. Run after changing a view:
#   PGHOST=/tmp PGPORT=54329 PGUSER=postgres npm run db:fixtures
set -euo pipefail
cd "$(dirname "$0")/.."
export PGOPTIONS='--client-min-messages=warning'
DB="insilicology_fixtures_$$"
psql -X -q -v ON_ERROR_STOP=1 -d postgres -c "create database $DB"
trap 'psql -X -q -d postgres -c "drop database if exists $DB" >/dev/null' EXIT
for f in supabase/tests/00_shim.sql supabase/migrations/*.sql supabase/seed.sql supabase/tests/01_helpers.sql scripts/fixtures.sql; do
  psql -X -q -v ON_ERROR_STOP=1 -d "$DB" -f "$f" >/dev/null
done
q() { psql -X -q -t -A -d "$DB" -c "$1"; }
mkdir -p tests/fixtures
# ids, dates and the owner/record path prefix are replaced with fixed values so the files are stable
q "select json_agg(r) from public.public_records r" | python3 -c "
import json, re, sys
d = json.load(sys.stdin)[0]
d['id'] = '11111111-1111-1111-1111-111111111111'
for i, f in enumerate(d['files']):
    f['id'] = '22222222-2222-2222-2222-%012d' % (i + 1)
    f['storage_path'] = re.sub(r'^[0-9a-f-]{36}/[0-9a-f-]{36}/', 'OWNER/RECORD/', f['storage_path'])
d['published_at'] = d['updated_at'] = '2026-10-26T12:00:00+00:00'
json.dump(d, open('tests/fixtures/public_record.json', 'w'), indent=2, sort_keys=True)
open('tests/fixtures/public_record.json', 'a').write('\n')"
q "select row_to_json(r) from public.published_pdbs r" | python3 -c "
import json, sys
json.dump(json.load(sys.stdin), open('tests/fixtures/published_pdb.json', 'w'), indent=2, sort_keys=True)
open('tests/fixtures/published_pdb.json', 'a').write('\n')"
q "select row_to_json(r) from public.public_posts r" | python3 -c "
import json, sys
d = json.load(sys.stdin)
d['id'] = '33333333-3333-3333-3333-333333333333'
d['published_at'] = d['updated_at'] = '2026-10-26T12:00:00+00:00'
json.dump(d, open('tests/fixtures/public_post.json', 'w'), indent=2, sort_keys=True)
open('tests/fixtures/public_post.json', 'a').write('\n')"
echo "wrote tests/fixtures/{public_record,published_pdb,public_post}.json"
