# Kart Rush Grand Prix

An original 3D arcade kart racer for the browser, built with Three.js. No build step, no server.

## What's in it

- **8 racers** with weight classes (light / medium / heavy), each with their own stats, driving **6 karts and bikes**.
- **4 courses** across 2 cups plus an all-course Star Cup: Sunshine Circuit, Frosty Peaks (ice patches), Bowser Keep (lava edges), and Rainbow Road (no rails, fall off and respawn).
- **Grand Prix** (points and trophies), **Single Race** and **Time Trial** (3 mushrooms, ghost-free).
- **Driving**: hop-drift, 3 mini-turbo tiers (blue, orange, purple sparks), a rocket start, ramps with trick boosts, dash pads, off-road slowdown, and walls.
- **Items**, weighted by position: banana, green shell, homing red shell, triple mushrooms, star, lightning, spiny shell, and coins (coins add top speed).
- **CPU rivals** take racing lines, drift corners for mini-turbos, dodge hazards and use items, with mild rubber-banding.
- Procedural toon models, particles, per-course music, engine and drift sound, a minimap, and saved best times and trophies.

## Controls

Desktop: **↑/W** gas · **←→/AD** steer · **↓/S** brake · hold **Space/Shift** while turning to drift, release for mini-turbo · **E/X** item (hold ↓ to throw backwards) · **C** look back · **P** pause. Gamepads work.

Touch: auto-gas, analog steer pad, DRIFT / ITEM / BRAKE buttons. Tap DRIFT mid-air off a ramp to do a trick.

## Run / deploy

Serve the folder (`npx serve .`) or deploy the repo root to Vercel as a static site. Opponents are local CPU racers; there is no online multiplayer.
