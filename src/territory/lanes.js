// Fixed trade lanes: sea lanes as [lon, lat] waypoints, with the chokepoints
// they squeeze through. A nation whose coast touches a lane can open a trade
// route with another nation on it; whoever holds a chokepoint takes a toll.
export const LANES = [
  {
    id: "suez",
    name: "Mediterranean and Red Sea",
    value: 1.5,
    points: [[-5.6, 36], [3, 38], [15, 35], [25, 33.5], [32.5, 31], [33.5, 28], [38, 21], [43.3, 12.6], [50, 12.5], [58, 20]],
    chokes: [{ name: "Gibraltar", lon: -5.6, lat: 36 }, { name: "Suez", lon: 32.5, lat: 30.5 }, { name: "Bab-el-Mandeb", lon: 43.3, lat: 12.6 }],
  },
  {
    id: "hormuz",
    name: "Persian Gulf",
    value: 1.2,
    points: [[49, 29], [52, 27], [56.5, 26.5], [60, 23.5], [68, 19], [73, 12]],
    chokes: [{ name: "Hormuz", lon: 56.5, lat: 26.5 }],
  },
  {
    id: "indian",
    name: "Indian Ocean and Bay of Bengal",
    value: 1.3,
    points: [[58, 20], [68, 15], [73, 9], [78, 6], [80, 6.5], [86, 9], [92, 8], [97, 5]],
    chokes: [{ name: "Palk Strait", lon: 79.5, lat: 9.6 }],
  },
  {
    id: "malacca",
    name: "Malacca and South China Sea",
    value: 1.6,
    points: [[97, 5], [100, 3], [103.8, 1.2], [108, 6], [112, 12], [118, 16], [122, 22], [121, 29], [125, 35], [141, 35]],
    chokes: [{ name: "Malacca", lon: 101.5, lat: 2.8 }],
  },
  {
    id: "australasia",
    name: "Australia and the Spice Islands",
    value: 0.9,
    points: [[151, -34], [153, -25], [150, -15], [145, -10], [135, -9], [125, -9], [116, -8.7], [108, -6], [103.8, 1.2]],
    chokes: [{ name: "Lombok", lon: 116, lat: -8.7 }],
  },
  {
    id: "atlantic-n",
    name: "North Atlantic and the Channel",
    value: 1.3,
    points: [[-70, 38], [-50, 40], [-30, 42], [-10, 45], [-5, 48.5], [1.5, 50.5], [5, 54], [8, 57]],
    chokes: [{ name: "English Channel", lon: 1.5, lat: 50.5 }],
  },
  {
    id: "caribbean",
    name: "Gulf of Mexico and Caribbean",
    value: 1,
    points: [[-97, 26], [-90, 25], [-82, 24], [-80, 25], [-75, 35], [-70, 41]],
    chokes: [{ name: "Florida Strait", lon: -80, lat: 24.5 }],
  },
  {
    id: "panama",
    name: "Panama and the Pacific",
    value: 1,
    points: [[-75, 20], [-79.6, 10], [-79.9, 8.5], [-85, 6], [-95, 10], [-110, 20]],
    chokes: [{ name: "Panama", lon: -79.7, lat: 9.3 }],
  },
  {
    id: "cape",
    name: "Around Africa",
    value: 0.8,
    points: [[-10, 36], [-17, 20], [-15, 0], [0, -20], [12, -34], [18.5, -35], [30, -34], [40, -25], [45, -12], [52, -5], [60, 8]],
    chokes: [{ name: "Mozambique Channel", lon: 42, lat: -17 }],
  },
  {
    id: "black-sea",
    name: "Black Sea",
    value: 0.7,
    points: [[35, 43], [29.2, 41.2], [26, 40], [24, 37], [15, 35]],
    chokes: [{ name: "Bosphorus", lon: 29.2, lat: 41.2 }],
  },
  {
    id: "baltic",
    name: "Baltic",
    value: 0.7,
    points: [[22, 58], [18, 57], [12, 56], [8, 57.5], [4, 56]],
    chokes: [{ name: "Danish Straits", lon: 11, lat: 56 }],
  },
];

// Man-made crossings the ships use, drawn on the map: a short line from end to end.
export const CANALS = [
  { name: "Panama Canal", a: [-79.92, 9.36], b: [-79.52, 8.95] },
  { name: "Suez Canal", a: [32.3, 31.26], b: [32.55, 29.97] },
  { name: "Kiel Canal", a: [9.13, 54.37], b: [9.95, 54.33] },
];

// Narrow natural straits, marked with a ring and a name.
export const STRAITS = [
  { name: "Gibraltar", at: [-5.6, 35.95] },
  { name: "Bosphorus", at: [29.05, 41.1] },
  { name: "Dardanelles", at: [26.4, 40.2] },
  { name: "Bab-el-Mandeb", at: [43.4, 12.6] },
  { name: "Hormuz", at: [56.5, 26.5] },
  { name: "Malacca", at: [101.5, 2.5] },
  { name: "Danish Straits", at: [11, 55.6] },
  { name: "Dover", at: [1.4, 51] },
];
