// Backyard Golf course geometry and course-generation helpers.
//
// Coordinates are intentionally kept separate from rendering. They use the
// supplied aerial mockup's 1178 × 1266 reference plane. Distance estimates are
// calculated from a two-axis calibration of the known 66 ft turf span and
// 50 ft turf depth. They are estimates until field-verified measurements are
// entered for a tee/cup pair.

export const MAP_VIEWBOX = { width: 1178, height: 1266 };

export const SITE_CALIBRATION = {
  source: 'Scaled from supplied backyard mockup',
  turfWidthFeet: 66,
  turfDepthFeet: 50,
  // Top-left turf corner, followed by the two measured directions in image space.
  // The source image is not orthographic, so this is a best-fit planar estimate.
  origin: { x: 196, y: 56 },
  widthVector: { x: 519, y: 245 },
  depthVector: { x: -62, y: 492 },
  verified: false,
};

export const CUP_MARKERS = [
  { id: 'H1', name: 'Lower left', tier: 'lower', x: 323, y: 516, note: 'Fixed cup · lower tier' },
  { id: 'H2', name: 'Lower right', tier: 'lower', x: 414, y: 516, note: 'Fixed cup · lower tier' },
  { id: 'H3', name: 'Lower east', tier: 'lower', x: 414, y: 424, note: 'Fixed cup · lower tier' },
  { id: 'H4', name: 'Upper tier', tier: 'upper', x: 323, y: 352, note: 'Fixed cup · upper tier' },
];

// The positions deliberately use hardscape around the court/patio and pool
// as well as the main turf. No marker is placed in the house, pool, or trees.
export const INITIAL_TEES = [
  { id: 'T01', name: 'South turf', x: 219, y: 478, surface: 'artificial turf', ballType: 'real', permittedCupIds: ['H1', 'H2', 'H3'] },
  { id: 'T02', name: 'West turf', x: 224, y: 402, surface: 'artificial turf', ballType: 'real', permittedCupIds: ['H1', 'H2', 'H4'] },
  { id: 'T03', name: 'North-west turf', x: 241, y: 303, surface: 'artificial turf', ballType: 'real', permittedCupIds: ['H1', 'H2', 'H3', 'H4'] },
  { id: 'T04', name: 'North turf edge', x: 288, y: 205, surface: 'artificial turf', ballType: 'both', permittedCupIds: ['H2', 'H3', 'H4'] },
  { id: 'T05', name: 'Center turf', x: 391, y: 233, surface: 'artificial turf', ballType: 'both', permittedCupIds: ['H1', 'H2', 'H3', 'H4'] },
  { id: 'T06', name: 'East turf edge', x: 513, y: 272, surface: 'artificial turf', ballType: 'foam', permittedCupIds: ['H1', 'H2', 'H3', 'H4'] },
  { id: 'T07', name: 'Upper east turf', x: 614, y: 314, surface: 'artificial turf', ballType: 'foam', permittedCupIds: ['H1', 'H2', 'H3', 'H4'] },
  { id: 'T08', name: 'Court north', x: 629, y: 366, surface: 'court edge', ballType: 'both', permittedCupIds: ['H1', 'H2', 'H3', 'H4'] },
  { id: 'T09', name: 'Court east', x: 662, y: 442, surface: 'basketball court', ballType: 'both', permittedCupIds: ['H1', 'H2', 'H3'] },
  { id: 'T10', name: 'Court south', x: 528, y: 461, surface: 'basketball court', ballType: 'real', permittedCupIds: ['H1', 'H2', 'H3', 'H4'] },
  { id: 'T11', name: 'Court west', x: 477, y: 510, surface: 'court edge', ballType: 'real', permittedCupIds: ['H1', 'H2', 'H3'] },
  { id: 'T12', name: 'Patio transition', x: 452, y: 587, surface: 'hardscape', ballType: 'foam', permittedCupIds: ['H1', 'H2', 'H3', 'H4'] },
  { id: 'T13', name: 'Pergola approach', x: 706, y: 578, surface: 'hardscape', ballType: 'foam', permittedCupIds: ['H1', 'H2', 'H3'] },
  { id: 'T14', name: 'Pool north deck', x: 788, y: 576, surface: 'pool deck', ballType: 'foam', permittedCupIds: ['H1', 'H2', 'H3', 'H4'] },
  { id: 'T15', name: 'Pool east deck', x: 1002, y: 656, surface: 'pool deck', ballType: 'foam', permittedCupIds: ['H1', 'H2', 'H3'] },
  { id: 'T16', name: 'Pool south deck', x: 1005, y: 793, surface: 'pool deck', ballType: 'foam', permittedCupIds: ['H1', 'H2', 'H3', 'H4'] },
  { id: 'T17', name: 'Pool west deck', x: 790, y: 920, surface: 'pool deck', ballType: 'foam', permittedCupIds: ['H1', 'H2', 'H3'] },
  { id: 'T18', name: 'South-east hardscape', x: 954, y: 914, surface: 'hardscape', ballType: 'foam', permittedCupIds: ['H1', 'H2', 'H3', 'H4'] },
].map(tee => ({ ...tee, active: true, distanceSource: 'estimated' }));

export const PRESET_COURSES = [
  {
    id: 'backyard-classic',
    name: 'Backyard Classic',
    description: 'A balanced nine-hole loop across turf and the court.',
    holes: [
      ['T01', 'H2'], ['T04', 'H4'], ['T08', 'H1'], ['T10', 'H3'], ['T02', 'H2'],
      ['T05', 'H1'], ['T11', 'H3'], ['T03', 'H4'], ['T09', 'H1'],
    ],
  },
  {
    id: 'backyard-championship',
    name: 'Backyard Championship',
    description: 'Eighteen varied, longer shots including approved foam-ball positions.',
    holes: [
      ['T03', 'H3'], ['T06', 'H1'], ['T08', 'H4'], ['T10', 'H2'], ['T01', 'H3'], ['T07', 'H1'],
      ['T04', 'H2'], ['T09', 'H3'], ['T02', 'H4'], ['T11', 'H2'], ['T05', 'H1'], ['T12', 'H4'],
      ['T13', 'H2'], ['T14', 'H4'], ['T15', 'H1'], ['T16', 'H3'], ['T17', 'H2'], ['T18', 'H4'],
    ],
  },
  {
    id: 'short-game-challenge',
    name: 'Short Game Challenge',
    description: 'Nine precision-focused approaches around the green and court.',
    holes: [
      ['T01', 'H1'], ['T02', 'H4'], ['T10', 'H1'], ['T11', 'H2'], ['T03', 'H4'],
      ['T08', 'H3'], ['T05', 'H2'], ['T09', 'H1'], ['T04', 'H3'],
    ],
  },
];

const clone = value => JSON.parse(JSON.stringify(value));

export function defaultCups() {
  return clone(CUP_MARKERS);
}

export function defaultTees() {
  return clone(INITIAL_TEES);
}

export function defaultCourses() {
  return clone(PRESET_COURSES);
}

export function getCup(id, cups = CUP_MARKERS) {
  return (cups || []).find(cup => cup.id === id) || null;
}

export function getTee(tees, id) {
  return (tees || []).find(tee => tee.id === id) || null;
}

// Converts source-image position to feet in the calibrated turf basis. This is
// an affine estimate, not a survey. It remains stable when the map is panned or
// rotated because rendering transforms never alter this data.
export function toGroundFeet(point) {
  const { origin, widthVector, depthVector, turfWidthFeet, turfDepthFeet } = SITE_CALIBRATION;
  const dx = point.x - origin.x;
  const dy = point.y - origin.y;
  const determinant = widthVector.x * depthVector.y - widthVector.y * depthVector.x;
  if (!determinant) return { x: 0, y: 0 };
  const acrossFraction = (dx * depthVector.y - dy * depthVector.x) / determinant;
  const depthFraction = (widthVector.x * dy - widthVector.y * dx) / determinant;
  return { x: acrossFraction * turfWidthFeet, y: depthFraction * turfDepthFeet };
}

export function estimatedDistanceFeet(a, b) {
  if (!a || !b) return 0;
  const p1 = toGroundFeet(a);
  const p2 = toGroundFeet(b);
  return Math.hypot(p2.x - p1.x, p2.y - p1.y);
}

export function formatDistance(feet, units = 'yards') {
  if (!Number.isFinite(feet)) return '—';
  if (units === 'feet') return `${Math.round(feet)} ft`;
  const yards = feet / 3;
  return `${yards >= 10 ? Math.round(yards) : yards.toFixed(1)} yd`;
}

export function holeFromPair(
  tees,
  teeId,
  cupId,
  overrides = {},
  cups = CUP_MARKERS
) {
  const tee = getTee(tees, teeId);
  const cup = getCup(cupId, cups);

  const distanceFeet =
    overrides.distanceFeet ?? estimatedDistanceFeet(tee, cup);

  return {
    id: overrides.id || `${teeId}-${cupId}`,
    teeId,
    cupId,
    teeName: tee?.name || teeId,
    cupName: cup?.name || cupId,
    par: overrides.par ?? 3,
    distanceFeet: Number(distanceFeet.toFixed(1)),
    distanceSource:
      overrides.distanceSource || tee?.distanceSource || 'estimated',
  };
}

export function materializeCourse(course, tees, cups = CUP_MARKERS) {
  return (course?.holes || []).map((entry, index) => {
    const [teeId, cupId] = Array.isArray(entry)
      ? entry
      : [entry.teeId, entry.cupId];

    return {
      number: index + 1,
      ...holeFromPair(tees, teeId, cupId, entry, cups),
    };
  });
}

export function isBallAllowed(tee, ballType = 'any') {
  if (!tee || tee.active === false) return false;
  return ballType === 'any' || tee.ballType === 'both' || tee.ballType === ballType;
}

export function validCombinations(
  tees,
  ballType = 'any',
  cups = CUP_MARKERS
) {
  return (tees || [])
    .filter(tee => isBallAllowed(tee, ballType))
    .flatMap(tee =>
      (tee.permittedCupIds || [])
        .filter(cupId => getCup(cupId, cups))
        .map(cupId => holeFromPair(tees, tee.id, cupId, {}, cups))
    );
}

function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function pick(items, random) {
  return items.length ? items[Math.floor(random() * items.length)] : null;
}

export function generateRoundHoles(
  tees,
  length,
  ballType = 'any',
  seed = Date.now(),
  cups = CUP_MARKERS
) {
  const combinations = validCombinations(tees, ballType, cups);
  if (combinations.length < length) {
    throw new Error(`Only ${combinations.length} approved tee-to-cup combinations are available for this ball type; ${length} unique holes were requested.`);
  }

  const sorted = [...combinations].sort((a, b) => a.distanceFeet - b.distanceFeet);
  const third = Math.max(1, Math.floor(sorted.length / 3));
  const buckets = {
    short: sorted.slice(0, third),
    medium: sorted.slice(third, third * 2),
    long: sorted.slice(third * 2),
  };
  const random = seededRandom(seed);
  const used = new Set();
  const holes = [];
  const bucketOrder = ['short', 'medium', 'long'];

  for (let index = 0; index < length; index += 1) {
    const preferredBucket = buckets[bucketOrder[index % bucketOrder.length]];
    const preferredCup = cups.length
  ? cups[index % cups.length].id
  : null;
    const unused = list => list.filter(hole => !used.has(`${hole.teeId}-${hole.cupId}`));
    let options = unused(preferredBucket.filter(hole => hole.cupId === preferredCup));
    if (!options.length) options = unused(preferredBucket);
    if (!options.length) options = unused(combinations.filter(hole => hole.cupId === preferredCup));
    if (!options.length) options = unused(combinations);
    const selected = pick(options, random);
    used.add(`${selected.teeId}-${selected.cupId}`);
    holes.push({ number: index + 1, ...selected });
  }

  return holes;
}

export function coursePar(holes) {
  return (holes || []).reduce((total, hole) => total + Number(hole.par || 3), 0);
}

export function scoreTotal(player) {
  return (player?.scores || []).reduce((total, score) => total + (Number.isFinite(Number(score)) ? Number(score) : 0), 0);
}

export function relativeToPar(player, holes) {
  return scoreTotal(player) - coursePar(holes);
}

export function shortBallLabel(ballType) {
  return ({ real: 'Real ball', foam: 'Foam ball', both: 'Both', any: 'Any approved ball' })[ballType] || ballType;
}
