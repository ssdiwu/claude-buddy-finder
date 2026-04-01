#!/usr/bin/env node
// finder.js - Buddy companion search engine
// Finds a userId that produces a matching companion

const { performance } = require('perf_hooks')
const { spawn } = require('child_process')
const { randomBytes } = require('crypto')
const os = require('os')

// ─── Companion Generation (mirrors companion.ts from Claude Code source) ───────

const SPECIES = ['duck','goose','blob','cat','dragon','octopus','owl','penguin','turtle','snail','ghost','axolotl','capybara','cactus','robot','rabbit','mushroom','chonk']
const EYES = ['·', '✦', '×', '◉', '@', '°']
const HATS = ['none','crown','tophat','propeller','halo','wizard','beanie','tinyduck']
const STAT_NAMES = ['DEBUGGING','PATIENCE','CHAOS','WISDOM','SNARK']
const RARITIES = ['common','uncommon','rare','epic','legendary']
const RARITY_WEIGHTS = { common: 60, uncommon: 25, rare: 10, epic: 4, legendary: 1 }
const RARITY_FLOOR = { common: 5, uncommon: 15, rare: 25, epic: 35, legendary: 50 }
const RARITY_STARS = { common: '★', uncommon: '★★', rare: '★★★', epic: '★★★★', legendary: '★★★★★' }
const SALT = 'friend-2026-401'

function mulberry32(seed) {
  let a = seed >>> 0
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function hashString(s) {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) }
  return h >>> 0
}

function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)] }

function rollRarity(rng) {
  const total = Object.values(RARITY_WEIGHTS).reduce((a, b) => a + b, 0)
  let roll = rng() * total
  for (const rarity of RARITIES) { roll -= RARITY_WEIGHTS[rarity]; if (roll < 0) return rarity }
  return 'common'
}

function rollStats(rng, rarity) {
  const floor = RARITY_FLOOR[rarity]
  const peak = pick(rng, STAT_NAMES)
  let dump = pick(rng, STAT_NAMES)
  while (dump === peak) dump = pick(rng, STAT_NAMES)
  const stats = {}
  for (const name of STAT_NAMES) {
    if (name === peak) stats[name] = Math.min(100, floor + 50 + Math.floor(rng() * 30))
    else if (name === dump) stats[name] = Math.max(1, floor - 10 + Math.floor(rng() * 15))
    else stats[name] = floor + Math.floor(rng() * 40)
  }
  return stats
}

function rollWithUserId(uid) {
  const rng = mulberry32(hashString(uid + SALT))
  const rarity = rollRarity(rng)
  return {
    rarity,
    species: pick(rng, SPECIES),
    eye: pick(rng, EYES),
    hat: rarity === 'common' ? 'none' : pick(rng, HATS),
    shiny: rng() < 0.01,
    stats: rollStats(rng, rarity),
  }
}

function randomUid() {
  return randomBytes(32).toString('hex')
}

// ─── Matching ─────────────────────────────────────────────────────────────────

function matches(bones, criteria) {
  if (criteria.rarity && bones.rarity !== criteria.rarity) return false
  if (criteria.species && bones.species !== criteria.species) return false
  if (criteria.eye && bones.eye !== criteria.eye) return false
  if (criteria.hat && bones.hat !== criteria.hat) return false
  if (criteria.shiny !== undefined && bones.shiny !== criteria.shiny) return false
  return true
}

function describeBones(bones) {
  const stars = RARITY_STARS[bones.rarity]
  const shiny = bones.shiny ? '✨ ' : ''
  const hat = bones.hat !== 'none' ? ` ${bones.hat}` : ''
  return `${stars} ${shiny}${bones.rarity} ${bones.species}${hat} eye=${bones.eye}`
}

// ─── Worker (child process) ────────────────────────────────────────────────────

function workerMain() {
  let criteria
  try {
    criteria = JSON.parse(process.env.BUDDY_CRITERIA || '{}')
  } catch (e) {
    console.error(`[worker] criteria parse error: ${e.message}`)
    process.exit(1)
  }
  const BATCH = 10000
  const found = []
  let attempts = 0
  while (found.length < 10) {
    for (let i = 0; i < BATCH; i++) {
      const uid = randomUid()
      const bones = rollWithUserId(uid)
      attempts++
      if (matches(bones, criteria)) found.push({ uid, bones })
    }
  }
  process.stdout.write(JSON.stringify({ found, attempts }))
  process.exit(0)
}

// ─── CLI ───────────────────────────────────────────────────────────────────────

const HELP = `Buddy Finder — search for a companion matching your criteria

Usage:
  buddy-finder [options]

Options:
  --species <name>   Species: ${SPECIES.join(', ')}
  --rarity <name>    Rarity: ${RARITIES.join(', ')}
  --eye <char>       Eye: ${EYES.join(', ')}
  --hat <name>       Hat: ${HATS.join(', ')}  (none for no hat)
  --shiny            Must be shiny
  --limit <N>        Stop after N matches (default: 1)
  --workers <N>      Parallel workers (default: CPU cores - 1)

Examples:
  buddy-finder --rarity legendary --species cat
  buddy-finder --rarity epic --shiny
  buddy-finder --rarity epic --hat crown --species dragon

After finding a uid, run:
  buddy-patch <uid>    # apply to ~/.claude.json
`

function parseArgs(argv) {
  const criteria = {}
  let limit = 1
  let workers = Math.max(1, os.cpus().length - 1)
  const args = argv.slice(2)

  while (args.length) {
    const opt = args.shift()
    switch (opt) {
      case '--species': criteria.species = args.shift(); break
      case '--rarity': criteria.rarity = args.shift(); break
      case '--eye': criteria.eye = args.shift(); break
      case '--hat': criteria.hat = args.shift(); break
      case '--shiny': criteria.shiny = true; break
      case '--limit': limit = parseInt(args.shift(), 10); break
      case '--workers': workers = parseInt(args.shift(), 10); break
      case '--help': case '-h': console.log(HELP); process.exit(0)
      default:
        if (opt.startsWith('--')) { console.error(`Unknown option: ${opt}`); process.exit(1) }
        // Non-option arguments are positional — stop parsing
        args.unshift(opt)
        break
    }
  }
  return { criteria, limit, workers }
}

function main() {
  const { criteria, limit, workers } = parseArgs(process.argv)

  if (!criteria.rarity && !criteria.species && !criteria.eye && !criteria.hat && criteria.shiny !== true) {
    console.error('Error: specify at least one filter (--rarity, --species, --eye, --hat, --shiny)')
    console.error('Run with --help for usage')
    process.exit(1)
  }

  for (const [type, val, valid] of [['rarity', criteria.rarity, RARITIES], ['species', criteria.species, SPECIES], ['eye', criteria.eye, EYES], ['hat', criteria.hat, HATS]]) {
    if (val && !valid.includes(val)) { console.error(`Error: unknown ${type} "${val}". Valid: ${valid.join(', ')}`); process.exit(1) }
  }

  const filterDesc = describeBones(criteria).replace(/^[★ ]+/g, '').trim()
  console.error(`[finder] Searching for: ${filterDesc}`)
  console.error(`[finder] Workers: ${workers}, limit: ${limit}`)

  const start = performance.now()
  const activeWorkers = new Set()
  let totalAttempts = 0
  let foundCount = 0
  const results = []

  function spawnWorker() {
    const child = spawn(process.execPath, [__filename, '--worker'], {
      stdio: ['ignore', 'pipe', 'inherit'],
      env: { ...process.env, BUDDY_CRITERIA: JSON.stringify(criteria) }
    })
    activeWorkers.add(child)

    let output = ''
    child.stdout.on('data', d => { output += d.toString() })
    child.on('error', e => { console.error(`[finder] worker error: ${e.message}`) })
    child.on('close', () => {
      activeWorkers.delete(child)
      try {
        const { found, attempts } = JSON.parse(output)
        totalAttempts += attempts
        for (const { uid, bones } of found) {
          if (foundCount >= limit) continue
          foundCount++
          const elapsed = ((performance.now() - start) / 1000).toFixed(1)
          const rate = Math.round(totalAttempts / (performance.now() - start) * 1000)
          console.log(`\n🎯 Found #${foundCount} after ${totalAttempts.toLocaleString()} attempts (${elapsed}s, ~${rate.toLocaleString()}/s)`)
          console.log(`   uid: ${uid}`)
          console.log(`   ${describeBones(bones)}`)
          console.log(`   stats: ${JSON.stringify(bones.stats)}`)
          results.push({ uid, bones })
          if (foundCount >= limit) {
            console.error(`\n[finder] Limit ${limit} reached`)
            for (const w of activeWorkers) w.kill()
            printSummary(results, totalAttempts, start)
            process.exit(0)
          }
        }
      } catch (e) { console.error(`[finder] worker parse error, respawning: ${e.message}`) }
      if (activeWorkers.size < workers) spawnWorker()
    })
  }

  function printSummary(results, totalAttempts, start) {
    const elapsed = ((performance.now() - start) / 1000).toFixed(1)
    console.log(`\n=== Summary ===`)
    console.log(`Total attempts: ${totalAttempts.toLocaleString()}`)
    console.log(`Time: ${elapsed}s`)
    console.log(`Found: ${results.length}`)
    if (results.length > 0) console.log(`\nFirst uid: ${results[0].uid}`)
  }

  for (let i = 0; i < workers; i++) spawnWorker()

  process.on('SIGINT', () => {
    for (const w of activeWorkers) w.kill()
    printSummary(results, totalAttempts, start)
    process.exit(0)
  })
}

if (process.argv[2] === '--worker') workerMain()
else main()
