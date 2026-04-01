#!/usr/bin/env node
// patcher.js - Patch ~/.claude.json with a found uid
// Clears companion to force re-hatch on next /buddy

const path = require('path')
const fs = require('fs')

const CONFIG_PATH = path.join(process.env.HOME, '.claude.json')

const HELP = `Buddy Patcher — apply a found uid to ~/.claude.json

Usage:
  buddy-patch <uid> [--dry-run]

Arguments:
  <uid>         64-char hex uid from buddy-finder

Options:
  --dry-run     Show what would be changed, no files modified

Examples:
  buddy-patch cb2f9a9b197266d8b3ca943dbb4e57547a7c4dab23713e1aadb35bd7774b800c
  buddy-patch <uid> --dry-run

After patching:
  1. Restart Claude Code (full restart, not just new session)
  2. Run /buddy
  3. If no new hatch, Claude Code may cache companion — close all windows

To restore the original config:
  cp ~/.claude.json.bak ~/.claude.json
`

function main() {
  const args = process.argv.slice(2)
  const dryRun = args.includes('--dry-run')
  const uid = args.find(a => !a.startsWith('--'))

  if (!uid) {
    console.error(HELP)
    process.exit(1)
  }

  if (!/^[0-9a-f]{64}$/i.test(uid)) {
    console.error(`Error: uid must be 64 hex chars, got "${uid}" (${uid.length} chars)`)
    process.exit(1)
  }

  console.error(`Config: ${CONFIG_PATH}`)

  let config = {}
  if (fs.existsSync(CONFIG_PATH)) {
    try {
      config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'))
    } catch (e) {
      console.error(`Error reading ${CONFIG_PATH}: ${e.message}`)
      process.exit(1)
    }
  } else {
    console.error('Config file does not exist, will create new one')
  }

  const backupPath = CONFIG_PATH + '.bak'
  const tmpPath = CONFIG_PATH + '.tmp'

  const oldUid = config.userID
  const oldCompanion = config.companion

  console.error('\n--- Current State ---')
  console.error(`userID:    ${oldUid || '(not set)'}`)
  if (oldCompanion) {
    const dt = new Date(oldCompanion.hatchedAt)
    const dtStr = isNaN(dt.getTime()) ? '(invalid date)' : dt.toISOString()
    console.error(`companion: ${oldCompanion.name} (hatched ${dtStr})`)
  } else {
    console.error('companion: (not set)')
  }

  console.error('\n--- Patch ---')
  console.error(`userID → ${uid}`)
  console.error('companion → (cleared, will re-hatch)')
  console.error(`backup → ${backupPath}`)

  if (dryRun) {
    console.error('\n[dry-run] No changes written')
    return
  }

  // Atomic write: backup first, then write to tmp, then rename
  if (fs.existsSync(CONFIG_PATH)) {
    fs.copyFileSync(CONFIG_PATH, backupPath)
    console.error(`\n✓ Backed up to ${backupPath}`)
  }

  // Clear companion key entirely, set new userID
  delete config.companion
  config.userID = uid

  // Write to temp file first, then atomic rename
  fs.writeFileSync(tmpPath, JSON.stringify(config, null, 2) + '\n')
  fs.renameSync(tmpPath, CONFIG_PATH)
  console.error(`\n✓ Patched ${CONFIG_PATH}`)
  console.error('\nNext steps:')
  console.error('  1. Restart Claude Code completely')
  console.error('  2. Run /buddy')
}

main()
