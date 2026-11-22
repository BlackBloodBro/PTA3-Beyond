# Rebuilds the development Supabase project as a copy of the live project's schema and reference data.
#
#   powershell -ExecutionPolicy Bypass -File scripts\refresh-dev-db.ps1 -Step dump      # reads LIVE (read-only)
#   powershell -ExecutionPolicy Bypass -File scripts\refresh-dev-db.ps1 -Step restore   # WIPES and rebuilds DEV
#
# Why a copy and not a migration replay: on live, several reference tables (pokedex, passives, habitats,
# classes, subclasses, ...) have ids that don't start at 1 and have gaps from early re-imports, and many old
# migrations insert rows by fixed id. Replaying them into an empty database fails or links the wrong rows.
#
# What is copied: the whole `public` schema (tables, functions, policies, triggers, grants), the data of the
# reference tables listed below (with their exact ids and sequence positions), and the migration history
# (supabase_migrations.schema_migrations), so `supabase db push` on dev only applies newer migrations.
# What is NOT copied: players' data (campaigns, trainers, pokemon, encounters, ...) and auth accounts.
# New reference tables must be added to $ReferenceTables by hand -- anything not listed stays empty on dev.
#
# Requires the PostgreSQL client tools (scoop install postgresql). Each step asks for that project's database
# password (hidden input); it is passed to pg_dump/psql through PGPASSWORD for that call only.

param(
  [Parameter(Mandatory = $true)][ValidateSet('dump', 'restore')][string]$Step,
  [string]$LivePooler = 'aws-0-eu-west-1.pooler.supabase.com',
  [string]$DevPooler = 'aws-1-eu-west-1.pooler.supabase.com',
  [string]$WorkDir = (Join-Path $env:TEMP 'pta3-dev-db-refresh')
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot

$ReferenceTables = @(
  'afflictions', 'afflictions_stats', 'berries', 'berry_flavors', 'catch_modifiers_ball',
  'catch_modifiers_battle_start', 'catch_modifiers_hp', 'class_favored_stats', 'classes', 'classes_skill_talents',
  'diets', 'egg_groups', 'evolution_chains', 'evolution_triggers', 'features', 'flavors', 'grant_events',
  'growth_rates', 'habitats', 'held_item_boosts', 'item_aliases', 'item_categories', 'items',
  'items_item_categories', 'level_bands', 'levels', 'loyalties', 'moves', 'moves_proficiencies', 'natures',
  'obtain_methods', 'origins', 'origins_skill_talent_group_options', 'origins_skill_talent_groups', 'passives',
  'passives_stats', 'pokeball_catch_modifiers', 'pokedex', 'pokedex_diets', 'pokedex_egg_groups',
  'pokedex_habitats', 'pokedex_moves', 'pokedex_passives', 'pokedex_proficiencies', 'proficiencies',
  'shiny_rate_settings', 'sizes', 'skills', 'stats', 'subclasses', 'subclasses_skill_talents',
  'technical_machine_prices', 'type_immunities', 'type_matchups', 'types', 'weights'
)

function Get-Ref([string]$envFile) {
  $path = Join-Path $root $envFile
  if (-not (Test-Path $path)) { throw "$envFile not found in $root" }
  $m = Select-String -Path $path -Pattern '^NEXT_PUBLIC_SUPABASE_URL=https://([a-z0-9]+)\.supabase\.co' | Select-Object -First 1
  if ($null -eq $m) { throw "$envFile has no NEXT_PUBLIC_SUPABASE_URL" }
  return $m.Matches[0].Groups[1].Value
}

function Get-PgTool([string]$name) {
  $cmd = Get-Command $name -ErrorAction SilentlyContinue
  if ($null -ne $cmd) { return $cmd.Source }
  $scoop = Join-Path $env:USERPROFILE "scoop\apps\postgresql\current\bin\$name.exe"
  if (Test-Path $scoop) { return $scoop }
  throw "$name not found -- install the PostgreSQL client tools (scoop install postgresql)"
}

function Invoke-WithPassword([string]$label, [scriptblock]$body) {
  $secure = Read-Host "Database password for the $label project" -AsSecureString
  $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  try {
    $env:PGPASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
    & $body
  } finally {
    Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
  }
}

function Assert-Exit([string]$what) {
  if ($LASTEXITCODE -ne 0) { throw "$what failed (exit code $LASTEXITCODE)" }
}

$liveRef = Get-Ref '.env.live.local'
$devRef = Get-Ref '.env.dev.local'
if ($liveRef -eq $devRef) { throw ".env.live.local and .env.dev.local point at the same project ($liveRef) -- refusing." }

$liveUrl = "postgresql://postgres.$liveRef@$LivePooler`:5432/postgres?sslmode=require"
$devUrl = "postgresql://postgres.$devRef@$DevPooler`:5432/postgres?sslmode=require"
New-Item -ItemType Directory -Force $WorkDir | Out-Null
$schemaDump = Join-Path $WorkDir 'schema.dump'
$dataSql = Join-Path $WorkDir 'data.sql'
$preSql = Join-Path $WorkDir 'pre.sql'
$postSql = Join-Path $WorkDir 'post.sql'
$restoreSql = Join-Path $WorkDir 'restore.sql'

if ($Step -eq 'dump') {
  Write-Host "Reading from LIVE ($liveRef) -- read-only. Files go to $WorkDir"
  $pgDump = Get-PgTool 'pg_dump'
  $pgRestore = Get-PgTool 'pg_restore'
  $tableArgs = @('--table=supabase_migrations.schema_migrations')
  foreach ($t in $ReferenceTables) { $tableArgs += "--table=public.$t" }
  Invoke-WithPassword "LIVE ($liveRef)" {
    & $pgDump --schema-only --schema=public --no-owner --format=custom --file=$schemaDump $liveUrl
    Assert-Exit 'Schema dump'
    & $pgDump --data-only --no-owner --file=$dataSql @tableArgs $liveUrl
    Assert-Exit 'Reference data dump'
  }
  & $pgRestore --section=pre-data --no-owner --file=$preSql $schemaDump
  Assert-Exit 'Writing pre-data SQL'
  & $pgRestore --section=post-data --no-owner --file=$postSql $schemaDump
  Assert-Exit 'Writing post-data SQL'
  Write-Host "Done. Next: -Step restore (this wipes and rebuilds DEV, $devRef)."
  exit 0
}

# --- restore ---------------------------------------------------------------------------------------------
foreach ($f in @($preSql, $dataSql, $postSql)) { if (-not (Test-Path $f)) { throw "$f missing -- run -Step dump first." } }
$psql = Get-PgTool 'psql'

# Drop the few dump lines a Supabase project rejects or already has: the `public` schema itself (exists on
# every project) and default privileges for supabase_admin (the postgres user may not set those; every
# project already has them). Read/written as UTF-8 without BOM so psql parses the first line.
$utf8 = New-Object System.Text.UTF8Encoding($false)
$skip = '^(CREATE SCHEMA public;|COMMENT ON SCHEMA public |ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin )'
foreach ($pair in @(@($preSql, 'pre.clean.sql'), @($postSql, 'post.clean.sql'))) {
  $lines = [IO.File]::ReadAllLines($pair[0], $utf8) | Where-Object { $_ -notmatch $skip }
  [IO.File]::WriteAllLines((Join-Path $WorkDir $pair[1]), [string[]]$lines, $utf8)
}
$preSql = Join-Path $WorkDir 'pre.clean.sql'
$postSql = Join-Path $WorkDir 'post.clean.sql'

# Reference tables also hold campaign-specific rows (GM custom Moves, Items, Pokedex entries, ...). Their
# campaigns aren't copied, so before the foreign keys are created, delete every row whose foreign key points
# at a row that isn't there -- repeated until nothing changes, so rows hanging off a removed row (e.g. a custom
# species' learnset) go too. Built from the dump's own FOREIGN KEY definitions.
$postText = [IO.File]::ReadAllText($postSql, $utf8)
$fkPattern = 'ALTER TABLE ONLY (public\.\w+)\s+ADD CONSTRAINT \w+ FOREIGN KEY \(([^)]+)\) REFERENCES (public\.\w+)\(([^)]+)\)'
$deletes = @()
foreach ($m in [regex]::Matches($postText, $fkPattern)) {
  $child = $m.Groups[1].Value; $parent = $m.Groups[3].Value
  $cc = $m.Groups[2].Value -split ',\s*'; $pc = $m.Groups[4].Value -split ',\s*'
  $notNull = ($cc | ForEach-Object { "c.$_ is not null" }) -join ' and '
  $match = (0..($cc.Count - 1) | ForEach-Object { "p.$($pc[$_]) = c.$($cc[$_])" }) -join ' and '
  $deletes += @"
    delete from $child c where $notNull and not exists (select 1 from $parent p where $match);
    get diagnostics n = row_count;
    if n > 0 then total := total + n; raise warning 'Not copied: % row(s) of % (they belong to data that is not copied)', n, '$child'; end if;
"@
}
$orphanSql = @"
do `$`$
declare n bigint; total bigint;
begin
  loop
    total := 0;
$($deletes -join "`n")
    exit when total = 0;
  end loop;
end
`$`$;
"@

@"
\set ON_ERROR_STOP on
begin;

-- Empty DEV's public schema (keeps the schema itself and its Supabase grants).
do `$`$
declare r record;
begin
  for r in select tablename from pg_tables where schemaname = 'public' loop
    execute format('drop table if exists public.%I cascade', r.tablename);
  end loop;
  for r in select viewname from pg_views where schemaname = 'public' loop
    execute format('drop view if exists public.%I cascade', r.viewname);
  end loop;
  for r in select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public'
             and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e') loop
    execute 'drop routine if exists ' || r.sig || ' cascade';
  end loop;
  for r in select t.typname from pg_type t join pg_namespace n on n.oid = t.typnamespace
           where n.nspname = 'public' and t.typtype in ('e', 'd', 'c')
             and not exists (select 1 from pg_class c where c.reltype = t.oid and c.relkind <> 'c')
             and not exists (select 1 from pg_depend d where d.objid = t.oid and d.deptype = 'e') loop
    execute format('drop type if exists public.%I cascade', r.typname);
  end loop;
  for r in select sequencename from pg_sequences where schemaname = 'public' loop
    execute format('drop sequence if exists public.%I cascade', r.sequencename);
  end loop;
end
`$`$;
drop trigger if exists on_auth_user_created on auth.users;
truncate supabase_migrations.schema_migrations;

\i '$($preSql -replace '\\', '/')'
\i '$($dataSql -replace '\\', '/')'

$orphanSql

\i '$($postSql -replace '\\', '/')'

-- Lives on auth.users, so it is not part of the public-schema dump (from 20260724120000_initial_schema.sql).
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_auth_user();

-- DEV's own accounts (the test accounts) survive in auth.users, but their public.users rows were dropped with
-- the schema -- recreate them the same way the trigger does on sign-up.
insert into public.users (id, display_name)
select id, raw_user_meta_data ->> 'display_name' from auth.users
on conflict (id) do nothing;

commit;
"@ | Set-Content -Path $restoreSql -Encoding ascii

Write-Host "This WIPES the public schema of DEV ($devRef) and rebuilds it from the dump. LIVE is not touched."
Invoke-WithPassword "DEV ($devRef)" {
  & $psql --no-psqlrc --quiet --file=$restoreSql $devUrl
  Assert-Exit 'Restore into DEV'
}
Write-Host 'Done. DEV now matches live''s schema and reference data, with no player data or accounts.'
