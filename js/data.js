// Kart Rush data: racers, rides, cups, courses, items. All art is procedural.
export const CHARACTERS = [
  { id: 'rico', name: 'Rico', cls: 'Medium', body: '#e5322d', pants: '#2649b8', skin: '#f6c89c', hat: 'cap', hatColor: '#e5322d', emblem: 'R', speed: 3, accel: 3, handling: 3, weight: 3 },
  { id: 'gino', name: 'Gino', cls: 'Medium', body: '#2fae3f', pants: '#2649b8', skin: '#f6c89c', hat: 'cap', hatColor: '#2fae3f', emblem: 'G', speed: 3, accel: 3, handling: 4, weight: 3 },
  { id: 'peach', name: 'Rosa', cls: 'Light', body: '#ff7fb7', pants: '#ff7fb7', skin: '#fcd9bd', hat: 'crown', hatColor: '#ffd23f', hair: '#ffd23f', speed: 2, accel: 5, handling: 4, weight: 1 },
  { id: 'pip', name: 'Pip', cls: 'Light', body: '#3d6bff', pants: '#ffffff', skin: '#fce3c8', hat: 'shroom', hatColor: '#ffffff', spots: '#e5322d', speed: 2, accel: 5, handling: 5, weight: 1 },
  { id: 'dino', name: 'Dino', cls: 'Medium', body: '#6bd13b', pants: '#ffffff', skin: '#6bd13b', hat: 'dino', hatColor: '#e5322d', speed: 3, accel: 4, handling: 3, weight: 2 },
  { id: 'bruno', name: 'Bruno', cls: 'Heavy', body: '#f0a020', pants: '#3f8f2a', skin: '#f5c542', hat: 'horns', hatColor: '#fff6d8', hair: '#e2462a', speed: 5, accel: 1, handling: 2, weight: 5 },
  { id: 'moko', name: 'Moko', cls: 'Heavy', body: '#8a4b22', pants: '#8a4b22', skin: '#e2b27f', hat: 'tie', hatColor: '#e5322d', speed: 4, accel: 2, handling: 2, weight: 5 },
  { id: 'vex', name: 'Vex', cls: 'Heavy', body: '#f5d10c', pants: '#6a2fa0', skin: '#f6c89c', hat: 'cap', hatColor: '#f5d10c', emblem: 'V', speed: 4, accel: 2, handling: 3, weight: 4 }
];

export const KARTS = [
  { id: 'standard', name: 'Standard', desc: 'Balanced all-rounder', speed: 3, accel: 3, handling: 3, weight: 3, offroad: 3, wheel: 0.62, color: null },
  { id: 'zoomer', name: 'Zoomer', desc: 'Top speed, slow launch', speed: 5, accel: 2, handling: 2, weight: 3, offroad: 2, wheel: 0.55, color: null },
  { id: 'bike', name: 'Sport Bike', desc: 'Tight drifts, light', speed: 3, accel: 4, handling: 5, weight: 1, offroad: 3, wheel: 0.7, bike: true },
  { id: 'monster', name: 'Monster', desc: 'Heavy, eats off-road', speed: 4, accel: 2, handling: 2, weight: 5, offroad: 5, wheel: 0.95 }
];

export const CLASSES = [
  { id: '50', name: '50cc', top: 44, ai: 0.86 },
  { id: '100', name: '100cc', top: 54, ai: 0.94 },
  { id: '150', name: '150cc', top: 64, ai: 1.0 }
];

// Courses: closed Catmull-Rom loops through [x, y, z]. y is elevation.
// open: [t0, t1, side] ranges without barrier (-1 left, 1 right) -> grass shortcuts.
// ramps / pads / boxes / coins are track fractions t in [0,1). l is lateral offset (-1..1 of half width).
export const TRACKS = [
  {
    id: 'sunny', name: 'Sunny Circuit', cup: 'Mushroom', theme: 'meadow', width: 22, laps: 3,
    pts: [[0,0,0],[0,0,-140],[20,0,-230],[90,4,-270],[170,10,-250],[210,14,-190],[200,12,-120],[150,6,-90],[120,2,-40],[160,0,20],[240,0,40],[300,0,110],[270,0,190],[180,0,210],[80,0,180],[20,0,110]],
    open: [[0.73, 0.86, -1]], ramps: [0.08, [0.3, 'boost'], 0.6, [0.88, 'boost']], pads: [[0.04, 0], [0.2, -0.45], [0.2, 0.45], [0.52, 0], [0.68, -0.4], [0.72, 0.4], [0.94, 0]], boxes: [0.13, 0.46, 0.77], coins: [[0.18, -0.5, 5], [0.36, 0.5, 5], [0.56, 0, 6], [0.8, -0.4, 5], [0.97, 0.4, 4]],
    hazards: [['goomba', 0.24], ['goomba', 0.41], ['goomba', 0.64], ['piranha', 0.55, 1], ['piranha', 0.83, -1]],
    sky: ['#4aa8ff', '#cfeeff'], fog: '#cfeeff', ground: '#5cc84a', ground2: '#4db53d', road: '#5f6470', rumble: ['#e5322d', '#ffffff'], wall: 'tires', music: { scale: [0, 2, 4, 7, 9], tempo: 138, root: 262 }
  },
  {
    id: 'frost', name: 'Frosty Peaks', cup: 'Mushroom', theme: 'snow', width: 20, laps: 3,
    pts: [[0,0,0],[0,6,-120],[-40,16,-220],[-130,24,-250],[-220,20,-200],[-240,12,-110],[-190,6,-40],[-120,2,-30],[-80,0,40],[-120,0,120],[-60,4,190],[40,8,190],[110,6,120],[90,2,40],[40,0,40]],
    open: [], ramps: [0.14, [0.28, 'boost'], 0.48, [0.72, 'boost'], 0.8], pads: [[0.1, 0], [0.22, -0.4], [0.36, 0.4], [0.52, 0.3], [0.58, -0.3], [0.86, -0.3], [0.9, 0.3]], boxes: [0.06, 0.4, 0.7], coins: [[0.24, 0, 6], [0.55, -0.5, 5], [0.9, 0.5, 5], [0.76, 0, 4]],
    hazards: [['snowball', 0.19], ['snowball', 0.34], ['snowball', 0.74], ['penguin', 0.46], ['penguin', 0.52]],
    ice: [[0.44, 0.56]], sky: ['#6c8fc7', '#e8f2ff'], fog: '#e8f2ff', ground: '#f4f8ff', ground2: '#e3ecf8', road: '#7d8aa0', rumble: ['#2b7de9', '#ffffff'], wall: 'snow', music: { scale: [0, 3, 5, 7, 10], tempo: 124, root: 220 }
  },
  {
    id: 'lava', name: 'Bowser Keep', cup: 'Flower', theme: 'lava', width: 18, laps: 3,
    pts: [[0,0,0],[0,0,-100],[-60,0,-160],[-150,6,-160],[-190,12,-90],[-150,16,-20],[-60,16,0],[-20,10,70],[-80,4,140],[-10,0,200],[90,0,190],[140,4,110],[110,8,40],[60,6,20]],
    open: [], ramps: [[0.1, 'boost'], 0.22, 0.49, [0.68, 'boost'], 0.86], pads: [[0.03, 0], [0.3, 0], [0.56, -0.3], [0.76, 0.5], [0.94, 0]], boxes: [0.16, 0.42, 0.8], coins: [[0.2, 0, 5], [0.6, 0, 6], [0.9, -0.4, 4]],
    hazards: [['thwomp', 0.34, -0.45], ['thwomp', 0.36, 0.45], ['thwomp', 0.62, 0], ['firebar', 0.27], ['firebar', 0.74], ['thwomp', 0.92, 0.4]],
    lavaEdge: true, sky: ['#1a0a0a', '#6b1a0c'], fog: '#3a0e08', ground: '#3b2622', ground2: '#2e1c19', road: '#7a6e6a', rumble: ['#ff7b00', '#222222'], wall: 'castle', music: { scale: [0, 1, 4, 5, 7, 8], tempo: 150, root: 196 }
  },
  {
    id: 'rainbow', name: 'Rainbow Road', cup: 'Flower', theme: 'rainbow', width: 20, laps: 3,
    pts: [[0,40,0],[0,44,-150],[60,54,-240],[170,64,-240],[230,56,-160],[190,44,-70],[110,40,-60],[70,46,20],[120,54,100],[60,60,180],[-60,54,190],[-130,46,120],[-110,40,40],[-50,36,30]],
    open: [], noWalls: [[0.3, 0.42], [0.72, 0.8]], ramps: [[0.12, 'boost'], 0.26, 0.43, [0.575, 'boost'], 0.81, [0.95, 'boost']], pads: [[0.06, 0], [0.22, -0.4], [0.22, 0.4], [0.36, 0], [0.56, 0], [0.7, -0.4], [0.9, 0]], boxes: [0.18, 0.5, 0.86], coins: [[0.09, 0, 6], [0.33, 0, 6], [0.65, 0.4, 5]],
    hazards: [['bumper', 0.47, -0.4], ['bumper', 0.53, 0.4], ['bumper', 0.76, 0], ['chomp', 0.66]],
    fall: true, sky: ['#05010f', '#1b0b3a'], fog: '#0d0520', ground: null, road: 'rainbow', rumble: ['#ffffff', '#ffe066'], wall: 'neon', music: { scale: [0, 2, 4, 7, 11], tempo: 146, root: 294 }
  }
];

export const CUPS = [
  { id: 'Mushroom', name: 'Mushroom Cup', icon: '🍄', tracks: ['sunny', 'frost'] },
  { id: 'Flower', name: 'Flower Cup', icon: '🌸', tracks: ['lava', 'rainbow'] },
  { id: 'Special', name: 'Star Cup', icon: '⭐', tracks: ['sunny', 'frost', 'lava', 'rainbow'] }
];

export const ITEMS = {
  banana: { name: 'Banana', icon: '🍌' },
  green: { name: 'Green Shell', icon: '🟢' },
  red: { name: 'Red Shell', icon: '🔴' },
  triple: { name: 'Triple Shrooms', icon: '🍄' },
  mushroom: { name: 'Mushroom', icon: '🍄' },
  star: { name: 'Star', icon: '⭐' },
  bolt: { name: 'Lightning', icon: '⚡' },
  blue: { name: 'Spiny Shell', icon: '🔵' },
  coin: { name: 'Coin', icon: '🪙' }
};

// Item odds by race position bucket (front -> back), weights per item.
export const ODDS = [
  { banana: 40, green: 30, coin: 20, mushroom: 10 },
  { banana: 20, green: 25, red: 25, mushroom: 20, coin: 10 },
  { green: 15, red: 30, mushroom: 25, triple: 20, star: 5, blue: 5 },
  { red: 20, triple: 35, star: 20, bolt: 10, blue: 10, mushroom: 5 }
];

export const POINTS = [15, 12, 10, 8, 6, 4, 2, 1];
