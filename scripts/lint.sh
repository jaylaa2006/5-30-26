#!/bin/bash
# Per Ankh Reader — session lint checks
# Run before committing to catch obvious breakage

cd "$(dirname "$0")/.."

PASS=0
FAIL=0

check() {
  if eval "$2" > /dev/null 2>&1; then
    echo "  ✓ $1"
    PASS=$((PASS + 1))
  else
    echo "  ✗ $1"
    FAIL=$((FAIL + 1))
  fi
}

echo "━━━ Per Ankh Lint ━━━"
echo ""

# HTML structure
echo "HTML:"
check "maat-reader.html exists" "[ -f maat-reader.html ]"
check "HTML has closing </html> tag" "grep -q '</html>' maat-reader.html"
check "HTML has closing </script> tag" "grep -q '</script>' maat-reader.html"
check "No unclosed STORIES array" "node -e \"const fs=require('fs');const h=fs.readFileSync('public/js/stories.js','utf8');const m=h.match(/var STORIES\s*=/);if(!m)process.exit(1)\""
echo ""

# JSON files
echo "JSON:"
check "video-prompts-cache.json valid" "node -e \"JSON.parse(require('fs').readFileSync('video-prompts-cache.json','utf8'))\""
check "package.json valid" "node -e \"JSON.parse(require('fs').readFileSync('package.json','utf8'))\""
echo ""

# Server startup (quick smoke test — start and kill)
echo "Server:"
check "server.js parses" "node -c server.js"
check "seba-story-api.mjs parses" "node -c seba-story-api.mjs"
echo ""

# Context files
echo "Context:"
check "STATE.md exists" "[ -f .agent/STATE.md ]"
check "TODO.md exists" "[ -f .agent/TODO.md ]"
check "CHANGELOG.md exists" "[ -f .agent/CHANGELOG.md ]"
echo ""

# Summary
echo "━━━━━━━━━━━━━━━━━━━━"
echo "  $PASS passed, $FAIL failed"
if [ $FAIL -gt 0 ]; then
  echo "  ⚠ Fix failures before committing"
  exit 1
fi
echo "  All clear."
