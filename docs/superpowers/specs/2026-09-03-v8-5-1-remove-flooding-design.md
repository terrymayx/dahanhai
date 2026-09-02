# V8.5.1 Remove Flooding Design

## Goal
Completely remove the V8.5 flooding subsystem while preserving the block-damage combat model.

## Required behavior
- No runtime `ship.leaks`, `ship.flooding`, or `ship.draft` fields are created or consumed.
- Destroyed waterline hull cells do not create leaks.
- Flooding cannot slow ships, change draft, or sink ships.
- Sinking remains governed by existing structural/integrity destruction behavior in V8 battle logic.
- Preserve per-cell durability and damage stages: intact, cracked, critical, destroyed.
- Preserve armor-gated penetration: an intact surviving cell stops the shot; a destroyed/penetrated cell allows remaining penetration to continue.
- Preserve beam/core structural rupture and coherent debris clusters.
- Preserve powder explosions, projectile water splash/ripple effects, debris water interaction, low-frequency 2-shot fire, and no camera/ship hit recoil.

## File boundaries
- Replace `js/v8/36_damage_flooding.js` with focused `js/v8/36_damage_model.js` containing damage-stage export and battle hook for immediate no-shake + structure rupture only.
- Update `js/v8/45_damage_overlay.js` to draw only block damage overlays and structural HUD; remove draft offset, leak graphics, flooding percentage, and flooding copy.
- Update `index.html` to load `36_damage_model.js`, use cache key `8.5.1`, and identify the build as `V8.5.1 · 船体损伤与破甲`.
- Remove flooding-specific regression tests and replace them with a no-hidden-flooding contract.

## Explicit non-goals
- No fire system.
- No compartment flooding replacement.
- No new ship types, levels, boarding, weapons, or UI systems.
- Do not remove projectile/debris water splash visuals; those are visual water interactions, not flooding.

## Acceptance criteria
1. New game player/enemy ships do not own `leaks`, `flooding`, or `draft` properties.
2. Destroying waterline hull cells still damages structure and can detach debris, but never creates flooding state or speed penalties.
3. Damage stages, penetration gating, beam rupture, calm-fire/no-recoil behavior remain covered by regression tests.
4. HUD contains no Chinese or English flooding/leak wording.
5. No active V8 entry loads `36_damage_flooding.js`.
6. Full V8.5.1→V8.0 regressions, V8 JS syntax checks, and V6/V7 legacy regressions pass before release.
