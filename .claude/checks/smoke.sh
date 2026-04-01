#!/bin/bash
set -e

echo "=== Claude Buddy Finder Smoke Test ==="

# Check Node.js version
node --version > /dev/null || { echo "Node.js required"; exit 1; }

# Validate JSON syntax of key files
echo "Checking JSON files..."
python3 -m json.tool .claude/task.json > /dev/null && echo "  ✓ .claude/task.json"
python3 -m json.tool .claude/settings.json > /dev/null && echo "  ✓ .claude/settings.json"

# Basic syntax check on JS files
echo "Checking JS syntax..."
node --check src/finder.js && echo "  ✓ src/finder.js"
node --check src/patcher.js && echo "  ✓ src/patcher.js"

echo "=== All checks passed ==="
exit 0
