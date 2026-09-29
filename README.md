# Kart Rush Grand Prix

A Mario Kart-style 3D kart racer for the browser, built with Three.js. No build step and no asset downloads: every model, texture, sound and song is generated in code.

**Play:** https://kart-rush-rho.vercel.app/

## What's in it
- **Modes:** Grand Prix (cups with points and trophies), Single Race, Time Trial (3 mushrooms, no rivals)
- **Engine classes:** 50cc / 100cc / 150cc (CPU skill and speed scale up)
- **8 drivers** in light/medium/heavy weight classes, each with speed/accel/handling/weight stats
- **4 karts:** Standard, Zoomer, Sport Bike, Monster (off-road)
- **4 courses in 3 cups:** Sunny Circuit, Frosty Peaks (ice patch), Bowser Keep (lava), Rainbow Road (no guardrails, fall off)
- **Driving:** hop-drift with 3 mini-turbo tiers (blue, orange, purple sparks), rocket start, dash panels, ramps with trick boosts, banked turns, off-road slowdown, walls, weight-based bumping, coins raise top speed (max 10)
- **Items:** Banana, Green Shell (bounces), Red Shell (homing), Mushroom, Triple Mushrooms, Star, Lightning, Spiny Shell, Coin. Odds depend on your position. Throw items backward by holding back.
- **CPU racers:** racing lines, drift for mini-turbos, dodge hazards, use items tactically, mild rubber-banding
- **Presentation:** start lights, lap and final-lap banners, minimap, item roulette, results and standings, procedural music per course

## Controls
| | Keyboard | Gamepad | Touch |
|---|---|---|---|
| Gas | ↑ / W | A / RT | automatic |
| Steer | ← → / A D | stick / d-pad | steer pad |
| Brake / reverse | ↓ / S | B / LT | BRAKE |
| Hop / drift | Space / Shift | RB / Y | DRIFT |
| Item (hold back to throw backward) | E / X | LB / X | ITEM |
| Look back | C | | |
| Pause | P / Esc | Start | ❚❚ |

## Structure
`js/main.js` race loop and flow · `track.js` course mesh and queries · `kart.js` physics · `ai.js` CPU · `items.js` · `models.js` · `scenery.js` · `fx.js` particles · `audio.js` · `ui.js` menus/HUD · `input.js` · `data.js` content.
