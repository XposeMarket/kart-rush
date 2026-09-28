'use strict';
// ---------- constants ----------
const SEG = 200, ROADW = 2000, DRAW = 260, CAMH = 1000, FOV = 100, LAPS = 3;
const CAMD = 1 / Math.tan((FOV / 2) * Math.PI / 180);
const PLAYERZ = CAMH * CAMD;
const MAXSP_BASE = SEG * 60;

// ---------- roster (all original) ----------
const CHARS = [
  { id: 'rusty', name: 'Rusty', kind: 'Fox', color: '#f28a1c', alt: '#fff3d6', spd: 3, acc: 3, han: 4, wgt: 2, bio: 'Quick on his feet. Great in corners.' },
  { id: 'luna',  name: 'Luna',  kind: 'Cat', color: '#8c7bff', alt: '#ffe9f4', spd: 2, acc: 5, han: 4, wgt: 1, bio: 'Explosive off the line. Featherweight.' },
  { id: 'bolt',  name: 'Bolt',  kind: 'Robot', color: '#4ad0e8', alt: '#e8f7ff', spd: 4, acc: 3, han: 3, wgt: 3, bio: 'Balanced circuits. No weak spots.' },
  { id: 'pip',   name: 'Pip',   kind: 'Frog', color: '#5bd45b', alt: '#fffbb0', spd: 3, acc: 4, han: 3, wgt: 2, bio: 'Bouncy and unpredictable.' },
  { id: 'zed',   name: 'Zed',   kind: 'Wizard', color: '#d94f9a', alt: '#ffe4a8', spd: 4, acc: 2, han: 3, wgt: 3, bio: 'Slow to start, scary at top speed.' },
  { id: 'coco',  name: 'Coco',  kind: 'Panda', color: '#e9e9e9', alt: '#222', spd: 2, acc: 3, han: 5, wgt: 4, bio: 'Glued to the road. Hard to bump.' },
  { id: 'blaze', name: 'Blaze', kind: 'Dragon', color: '#e8432f', alt: '#ffd166', spd: 5, acc: 2, han: 2, wgt: 5, bio: 'Heavy hitter. Top speed king.' },
  { id: 'ivy',   name: 'Ivy',   kind: 'Elf', color: '#2fa36b', alt: '#e8ffd6', spd: 3, acc: 4, han: 4, wgt: 1, bio: 'Agile all-rounder.' }
];

const VEHICLES = [
  { id: 'kart',  name: 'Classic Kart', spd: 3, acc: 3, han: 3, wgt: 3, w: 0.34, desc: 'Balanced and reliable.' },
  { id: 'bike',  name: 'Speed Bike',   spd: 2, acc: 5, han: 5, wgt: 1, w: 0.2,  desc: 'Snappy handling, drifts hard.' },
  { id: 'truck', name: 'Monster Truck', spd: 5, acc: 2, han: 1, wgt: 5, w: 0.42, desc: 'Huge top speed. Bulldozes rivals.' },
  { id: 'pod',   name: 'Hover Pod',    spd: 4, acc: 4, han: 2, wgt: 2, w: 0.3,  desc: 'Fast and floaty. Slides a lot.' }
];

const ITEMS = {
  mushroom: { name: 'Turbo', icon: '🍄' },
  mushroom3: { name: 'Triple Turbo', icon: '🍄' },
  banana: { name: 'Banana', icon: '🍌' },
  gshell: { name: 'Green Shell', icon: '🟢' },
  rshell: { name: 'Homing Shell', icon: '🔴' },
  star: { name: 'Star', icon: '⭐' },
  bolt: { name: 'Lightning', icon: '⚡' },
  oil: { name: 'Oil Slick', icon: '🛢️' }
};

// ---------- maps ----------
// section: [enter, hold, leave, curve, hill]  (lengths multiplied by map.scale)
const MAPS = [
  {
    id: 'meadows', name: 'Sunny Meadows', diff: 'Easy', scale: 3, grip: 9, decor: 'tree', theme: 'day',
    desc: 'Rolling hills, gentle bends. Perfect warm-up.',
    sky: ['#4fb3ff', '#cdeeff'], hills: ['#7fd0a0', '#4fae76'], road: ['#6d6d7a', '#64646f'],
    grass: ['#4cc35a', '#43b451'], rumble: ['#e63946', '#ffffff'], lane: '#ffffff', fog: '#cdeeff', music: [0, 2, 4, 7, 9], tempo: 132,
    spec: [[10,20,10,0,0],[15,25,15,3,0],[10,15,10,0,20],[10,20,10,0,-20],[15,30,15,-4,0],[10,20,10,0,0],[20,30,20,4,10],
      [10,20,10,-3,-10],[15,25,15,-5,0],[10,30,10,0,20],[10,30,10,0,-20],[20,30,20,5,0],[10,20,10,0,0],[15,25,15,-3,0],[10,15,10,3,0],[10,20,10,0,0]],
    pads: [30, 260, 520, 700], boxes: [90, 320, 560, 780]
  },
  {
    id: 'frost', name: 'Frost Peak Run', diff: 'Medium', scale: 3, grip: 2.6, decor: 'pine', theme: 'snow',
    desc: 'Icy switchbacks. Grip? What grip?',
    sky: ['#7ea6d4', '#eaf5ff'], hills: ['#d5e6f7', '#aac6e4'], road: ['#8a99b0', '#8391a8'],
    grass: ['#f6fbff', '#e2eef8'], rumble: ['#2b7de9', '#ffffff'], lane: '#e8f4ff', fog: '#eaf5ff', music: [0, 3, 5, 7, 10], tempo: 118,
    spec: [[10,20,10,0,0],[15,20,15,4,0],[10,25,10,-5,0],[10,15,10,0,-25],[15,25,15,5,0],[10,10,10,0,25],[15,20,15,-6,0],
      [10,20,10,0,0],[20,25,20,-4,15],[10,20,10,4,-15],[15,25,15,6,0],[10,25,10,0,0],[15,20,15,-5,0],[10,20,10,3,0],[10,20,10,0,0]],
    pads: [110, 380, 640], boxes: [70, 300, 520, 730]
  },
  {
    id: 'ember', name: 'Ember Canyon', diff: 'Hard', scale: 3, grip: 8, decor: 'rock', theme: 'lava',
    desc: 'Big hills over the lava flow. Hold on.',
    sky: ['#2a0c0e', '#ff8a3d'], hills: ['#5a2018', '#3a120e'], road: ['#4d4356', '#463d4f'],
    grass: ['#5a2e22', '#4e271d'], rumble: ['#ff7b00', '#2b2b2b'], lane: '#ffcf6a', fog: '#a33a1a', music: [0, 1, 4, 5, 8], tempo: 148,
    spec: [[10,20,10,0,0],[10,20,10,0,40],[10,20,10,0,-40],[15,25,15,5,0],[10,20,10,0,30],[10,20,10,-4,-30],[15,20,15,-6,0],
      [10,25,10,0,50],[10,20,10,0,-50],[20,25,20,6,0],[10,15,10,0,0],[15,25,15,-5,20],[10,20,10,4,-20],[15,20,15,-6,0],[10,20,10,0,0]],
    pads: [60, 340, 590, 720], boxes: [40, 260, 470, 690]
  },
  {
    id: 'neon', name: 'Neon Nights City', diff: 'Expert', scale: 2.6, grip: 8, decor: 'city', theme: 'night',
    desc: 'Tight downtown turns under the skyline.',
    sky: ['#04060f', '#1b3a5c'], hills: ['#0d2036', '#122c48'], road: ['#3b3f4d', '#353947'],
    grass: ['#10141f', '#0c1019'], rumble: ['#ff2d95', '#00e5ff'], lane: '#ffe45e', fog: '#12243b', music: [0, 3, 7, 8, 10], tempo: 140,
    spec: [[10,15,10,0,0],[10,20,10,6,0],[10,10,10,-6,0],[10,20,10,6,0],[15,15,15,0,15],[10,15,10,-6,-15],[10,20,10,5,0],
      [10,15,10,-5,0],[15,20,15,0,0],[10,20,10,6,10],[10,15,10,-6,-10],[10,20,10,4,0],[15,20,15,-4,0],[10,15,10,6,0],[10,20,10,0,0]],
    pads: [50, 240, 420, 600], boxes: [30, 200, 380, 560]
  }
];

const BOT_NAMES = ['Dash', 'Turbo', 'Sprocket', 'Nova', 'Gizmo', 'Rocket', 'Vex', 'Mango', 'Pixel', 'Ziggy', 'Comet', 'Torque'];
