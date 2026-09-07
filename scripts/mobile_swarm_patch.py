"""Deprecated compatibility check.

The active deck-guard source is maintained directly in the repository root.
GitHub Pages no longer runs this script and this file intentionally does not
rewrite index.html, guard.js or style.css.
"""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
guard = (ROOT / 'guard.js').read_text(encoding='utf-8')
index = (ROOT / 'index.html').read_text(encoding='utf-8')

required = [
    'ALLIED_SHOOTERS=60',
    'ALLIED_DEFENDERS=60',
    'C.guardApproachSpeed(ship.type,d)',
    'function updateEnemyCrewMotion(',
]
missing = [token for token in required if token not in guard]
if missing:
    raise SystemExit('canonical deck guard source is missing: ' + ', '.join(missing))
if 'deck-guard-ranged-approach-2026-09-07' not in index:
    raise SystemExit('unexpected index.html build marker')

print('canonical deck guard source check: PASS (no files modified)')
