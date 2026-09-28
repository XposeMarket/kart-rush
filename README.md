# Kart Rush · Pocket Grand Prix

An original, actual 3D WebGL kart racer built with Three.js. Eight racers, four distinct vehicles, four sculpted 3D tracks, seven computer-controlled rivals, three-lap Grand Prix, power-ups, drifting and mini-turbos, procedural sound, and local best times. All characters, environments and meshes are procedural originals; no Nintendo assets or trademarks are used.

## Play

Open `index.html` in a browser, or serve this folder with `npx serve .` and visit the URL shown. Desktop: **W / Up** accelerate, **A/D or Left/Right** steer, **S / Down** brake, **Shift** drift, **Space** use item, **P/Escape** pause, **M** sound. On touch devices, acceleration is automatic; steering, drift and item buttons appear on screen.

## Deployment

This repository is a zero-build static site, deployed from the repository root to Vercel. No environment variables required. Opponents are seven local CPU racers; there is **no online multiplayer** or server-backed rooms.

All source code and artwork are original; optional fonts load from Google Fonts with local fallbacks.

## 3D implementation

The browser renders a genuine WebGL scene with a chase camera, 3D track ribbons and elevation, dynamic karts/characters, scenery and item meshes. `js/vendor/three.module.js` is a locally vendored copy of Three.js r170 (MIT); the game works without a JavaScript CDN or a build step. Requires WebGL. Built for phone-sized landscape viewports as well as desktop browsers.
