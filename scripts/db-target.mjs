#!/usr/bin/env node
// Shows or switches which Supabase project this checkout talks to.
//
//   node scripts/db-target.mjs          -> show where the app (.env.local) and the CLI (supabase link) point
//   node scripts/db-target.mjs dev      -> copy .env.dev.local  over .env.local (day-to-day development)
//   node scripts/db-target.mjs live     -> copy .env.live.local over .env.local (occasional checks on live data)
//
// .env.dev.local and .env.live.local hold the two projects' NEXT_PUBLIC_SUPABASE_URL / _ANON_KEY and are
// gitignored (.env*.local). The CLI link (used by `supabase db push` and `pnpm db:types`) is switched
// separately with `supabase link --project-ref <ref>`, which this script prints but does not run, since
// linking may ask for the database password.
import { copyFileSync, existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const file = (name) => resolve(root, name)

function refFromEnv(name) {
  const path = file(name)
  if (!existsSync(path)) return null
  const match = readFileSync(path, 'utf8').match(/^NEXT_PUBLIC_SUPABASE_URL=https:\/\/([a-z0-9]+)\.supabase\.co/m)
  return match ? match[1] : null
}

function linkedRef() {
  const path = file('supabase/.temp/project-ref')
  return existsSync(path) ? readFileSync(path, 'utf8').trim() : null
}

const targets = { dev: refFromEnv('.env.dev.local'), live: refFromEnv('.env.live.local') }

function label(ref) {
  if (!ref) return 'not set'
  const name = Object.entries(targets).find(([, r]) => r === ref)?.[0]
  return name ? `${name.toUpperCase()} (${ref})` : `UNKNOWN (${ref})`
}

const wanted = process.argv[2]

if (wanted) {
  if (!(wanted in targets)) {
    console.error(`Unknown target "${wanted}". Use "dev" or "live".`)
    process.exit(1)
  }
  if (!targets[wanted]) {
    console.error(`.env.${wanted}.local is missing or has no NEXT_PUBLIC_SUPABASE_URL.`)
    process.exit(1)
  }
  copyFileSync(file(`.env.${wanted}.local`), file('.env.local'))
  console.log(`.env.local now points at ${label(targets[wanted])}. Restart the dev server to pick it up.`)
}

const app = refFromEnv('.env.local')
const cli = linkedRef()
console.log(`App (.env.local):      ${label(app)}`)
console.log(`CLI (supabase link):   ${label(cli)}`)
if (cli && targets.live && cli === targets.live) {
  console.log('Note: the CLI is linked to LIVE -- `supabase db push` would change the live database.')
}
if (wanted && cli !== targets[wanted]) {
  console.log(`To point the CLI at it too:  supabase link --project-ref ${targets[wanted]}`)
}
