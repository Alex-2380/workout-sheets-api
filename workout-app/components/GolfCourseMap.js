import { useRef, useState } from 'react';
import {
  CUP_MARKERS,
  MAP_VIEWBOX,
  formatDistance,
  getCup,
  getTee,
  holeFromPair,
} from '../utils/golfCourse';

const TURF_PATH = 'M 196 56 L 715 301 L 660 548 L 134 548 Z';
const HOUSE_PATH = 'M 457 398 L 542 398 L 542 377 L 605 377 L 605 398 L 688 398 L 688 418 L 786 462 L 1082 615 L 1082 1001 L 781 1001 L 781 685 L 457 685 Z';
const COURT_PATH = 'M 457 398 L 688 398 L 688 419 L 786 463 L 786 550 L 689 550 L 689 548 L 457 548 Z';
const GREEN_PATH = 'M 293 325 L 445 356 L 445 536 L 293 536 Z';
const HILL_PATH = 'M 295 534 C 300 469 321 393 376 384 C 392 381 405 388 416 401';

function Tree({ x, y, r }) {
  return (
    <g aria-label="Tree" className="site-tree">
      <circle cx={x} cy={y} r={r} fill="#234e2a" />
      <circle cx={x - r * 0.18} cy={y - r * 0.18} r={r * 0.72} fill="#2f6535" opacity=".75" />
      <circle cx={x + r * 0.2} cy={y + r * 0.12} r={r * 0.52} fill="#1f4827" opacity=".55" />
    </g>
  );
}

function CupMarker({ cup, selected, onSelect }) {
  return (
    <g
      className={`golf-cup-marker ${selected ? 'is-selected' : ''}`}
      role="button"
      tabIndex={0}
      aria-label={`${cup.id}, ${cup.name}, ${cup.tier} tier`}
      onClick={(event) => { event.stopPropagation(); onSelect?.(cup.id); }}
      onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') onSelect?.(cup.id); }}
    >
      <circle cx={cup.x} cy={cup.y} r="14" className="golf-cup-ring" />
      <circle cx={cup.x} cy={cup.y} r="7" className="golf-cup-center" />
      <path d={`M ${cup.x + 2} ${cup.y - 7} L ${cup.x + 2} ${cup.y - 32} L ${cup.x + 21} ${cup.y - 27} L ${cup.x + 2} ${cup.y - 21}`} className="golf-flag" />
      <text x={cup.x + 18} y={cup.y + 22} className="golf-marker-label">{cup.id}</text>
    </g>
  );
}

function TeeMarker({ tee, selected, onSelect, visible }) {
  if (!visible || tee.active === false) return null;
  return (
    <g
      className={`golf-tee-marker ${selected ? 'is-selected' : ''}`}
      role="button"
      tabIndex={0}
      aria-label={`${tee.id}, ${tee.name}, ${tee.surface}`}
      onClick={(event) => { event.stopPropagation(); onSelect?.(tee.id); }}
      onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') onSelect?.(tee.id); }}
    >
      <circle cx={tee.x} cy={tee.y} r="18" className="golf-tee-ring" />
      <circle cx={tee.x} cy={tee.y} r="10" className="golf-tee-center" />
      <path d={`M ${tee.x - 5} ${tee.y + 10} L ${tee.x + 5} ${tee.y + 10} L ${tee.x + 2} ${tee.y + 22} L ${tee.x - 2} ${tee.y + 22} Z`} className="golf-tee-stem" />
      <text x={tee.x + 23} y={tee.y + 5} className="golf-marker-label golf-tee-label">{tee.id}</text>
    </g>
  );
}

export default function GolfCourseMap({
  tees = [],
  cups = CUP_MARKERS,
  selectedTeeId,
  selectedCupId,
  onSelectTee,
  onSelectCup,
  showTees = true,
  showMeasurements = true,
  showOnlySelectedMarkers = false,
  units = 'yards',
  className = '',
}) {
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const svgRef = useRef(null);
  const mapContentRef = useRef(null);
  const dragRef = useRef(null);
  const pendingPanRef = useRef({ x: 0, y: 0 });

  const selectedTee = getTee(tees, selectedTeeId);
const selectedCup = getCup(selectedCupId, cups);

const selectedHole =
  selectedTee && selectedCup
    ? holeFromPair(
        tees,
        selectedTee.id,
        selectedCup.id,
        {},
        cups
      )
    : null;
  const buildTransform = (nextPan, nextZoom = zoom, nextRotation = rotation) =>
  `translate(${nextPan.x} ${nextPan.y}) translate(${MAP_VIEWBOX.width / 2} ${MAP_VIEWBOX.height / 2}) scale(${nextZoom}) rotate(${nextRotation}) translate(${-MAP_VIEWBOX.width / 2} ${-MAP_VIEWBOX.height / 2})`;

const transform = buildTransform(pan);

const pointerDown = (event) => {
  const rect = svgRef.current?.getBoundingClientRect();
  if (!rect) return;

  pendingPanRef.current = { ...pan };

  dragRef.current = {
    x: event.clientX,
    y: event.clientY,
    pan: { ...pan },
    rect,
    moved: false,
  };

  event.currentTarget.setPointerCapture?.(event.pointerId);
};

const pointerMove = (event) => {
  const drag = dragRef.current;
  if (!drag) return;

  const dx = event.clientX - drag.x;
  const dy = event.clientY - drag.y;

  if (Math.abs(dx) + Math.abs(dy) > 4) {
    drag.moved = true;
  }

  if (!drag.moved) return;

  const nextPan = {
    x: drag.pan.x + (dx * MAP_VIEWBOX.width) / drag.rect.width,
    y: drag.pan.y + (dy * MAP_VIEWBOX.height) / drag.rect.height,
  };

  pendingPanRef.current = nextPan;

  // Update the SVG directly instead of re-rendering the entire React component.
  if (mapContentRef.current) {
    mapContentRef.current.setAttribute(
      'transform',
      buildTransform(nextPan)
    );
  }
};

const pointerUp = () => {
  const drag = dragRef.current;
  if (!drag) return;

  if (drag.moved) {
    // Commit the final position to React once, when dragging ends.
    setPan(pendingPanRef.current);
  }

  dragRef.current = null;

  if (drag.moved) {
    // Prevent the drag from accidentally selecting a tee or cup.
    dragRef.current = { moved: true };

    setTimeout(() => {
      dragRef.current = null;
    }, 0);
  }
};

const selectTee = (id) => {
  if (dragRef.current?.moved) return;
  onSelectTee?.(id);
};

const selectCup = (id) => {
  if (dragRef.current?.moved) return;
  onSelectCup?.(id);
};
  const reset = () => { setZoom(1); setRotation(0); setPan({ x: 0, y: 0 }); };

  return (
    <div className={`golf-map-shell ${className}`}>
      <div className="golf-map-toolbar" aria-label="Map controls">
        <button type="button" className="golf-map-control" onClick={() => setZoom(value => Math.min(3, +(value + 0.25).toFixed(2)))} aria-label="Zoom in">+</button>
        <button type="button" className="golf-map-control" onClick={() => setZoom(value => Math.max(0.7, +(value - 0.25).toFixed(2)))} aria-label="Zoom out">−</button>
        <button type="button" className="golf-map-control golf-map-control-wide" onClick={() => setRotation(value => (value + 15) % 360)}>Rotate</button>
        <button type="button" className="golf-map-control golf-map-control-wide" onClick={reset}>Reset</button>
      </div>
      <svg
        ref={svgRef}
        className="golf-map"
        viewBox={`0 0 ${MAP_VIEWBOX.width} ${MAP_VIEWBOX.height}`}
        role="img"
        aria-label="Interactive vector site plan of the backyard golf course"
        onPointerDown={pointerDown}
        onPointerMove={pointerMove}
        onPointerUp={pointerUp}
        onPointerCancel={pointerUp}
      >
        <defs>
          <pattern id="turf-stripe" width="34" height="34" patternUnits="userSpaceOnUse" patternTransform="rotate(18)">
            <rect width="34" height="34" fill="#4f8e37" />
            <rect width="17" height="34" fill="#579b3b" opacity=".34" />
          </pattern>
          <pattern id="concrete-dot" width="18" height="18" patternUnits="userSpaceOnUse">
            <rect width="18" height="18" fill="#d1d1ce" />
            <circle cx="4" cy="5" r=".8" fill="#b8b8b2" opacity=".35" />
          </pattern>
          <filter id="plan-shadow" x="-10%" y="-10%" width="120%" height="120%"><feDropShadow dx="0" dy="8" stdDeviation="10" floodOpacity=".19" /></filter>
        </defs>
        <rect width="1178" height="1266" fill="#353940" />
        <g ref={mapContentRef} transform={transform}>
          {/* Property and landscape: traced from the provided mockup rather than generated imagery. */}
          <path d="M 54 22 L 190 20 L 1139 480 L 1134 1218 L 532 1218 L 84 1218 L 84 786 Z" fill="#ded7c8" stroke="#b5ad9d" strokeWidth="7" />
          <path d="M 84 50 L 190 50 L 196 56 L 134 548 L 94 548 Z" fill="#353940" opacity=".75" />
          <path d={TURF_PATH} fill="url(#turf-stripe)" stroke="#2d672d" strokeWidth="7" />
          <path d={HOUSE_PATH} fill="url(#concrete-dot)" stroke="#92979a" strokeWidth="6" />
          <path d={COURT_PATH} fill="#c7c8c7" stroke="#a7aaa9" strokeWidth="4" />
          <path d="M 688 463 L 786 463 L 786 550 L 688 550 Z" fill="#a0a5b2" stroke="#818897" strokeWidth="4" />
          <rect x="841" y="624" width="122" height="277" rx="2" fill="#4a6aa8" stroke="#2e4d84" strokeWidth="6" />
          <path d="M 457 685 L 781 685 L 781 1001 L 980 1001 L 980 1150 L 430 1150 L 430 900 L 250 900 L 250 550 L 457 550 Z" fill="#ad7964" />
          <path d="M 95 970 L 400 980 L 400 1200 L 95 1200  Z" fill="url(#turf-stripe)" stroke="#2d672d" strokeWidth="7" />
          <path d={GREEN_PATH} fill="#9ed68c" stroke="#2d672d" strokeWidth="5" />
          <path d="M 293 325 L 445 356" stroke="#2d672d" strokeWidth="5" opacity=".75" />

          <path d="M 205 900 C 298 980 343 920 427 950" fill="none" stroke="#beb29e" strokeWidth="30" />
          <Tree x="347" y="128" r="65" />
          <Tree x="207" y="505" r="66" />
          <Tree x="1068" y="1056" r="85" />
	  <Tree x="150" y="980" r="85" />
	  <Tree x="350" y="1100" r="50" />
          <Tree x="770" y="350" r="25" />
          <Tree x="860" y="400" r="34" />
          <Tree x="1000" y="500" r="25" />
          <Tree x="1110" y="850" r="25" />

          {selectedHole && (
            <g className="golf-shot-line">
              <line x1={selectedTee.x} y1={selectedTee.y} x2={selectedCup.x} y2={selectedCup.y} />
              {showMeasurements && (
                <g transform={`translate(${(selectedTee.x + selectedCup.x) / 2} ${(selectedTee.y + selectedCup.y) / 2})`}>
                  <rect x="-47" y="-23" width="94" height="36" rx="18" className="golf-distance-pill" />
                  <text y="1" textAnchor="middle" className="golf-distance-text">{formatDistance(selectedHole.distanceFeet, units)}</text>
                  <text y="26" textAnchor="middle" className="golf-distance-source">EST.</text>
                </g>
              )}
            </g>
          )}
         {(showOnlySelectedMarkers
  ? cups.filter(cup => cup.id === selectedCupId)
  : cups
).map(cup => (
  <CupMarker
    key={cup.id}
    cup={cup}
    selected={selectedCupId === cup.id}
    onSelect={selectCup}
  />
))}

{(showOnlySelectedMarkers
  ? tees.filter(tee => tee.id === selectedTeeId)
  : tees
).map(tee => (
  <TeeMarker
    key={tee.id}
    tee={tee}
    selected={selectedTeeId === tee.id}
    onSelect={selectTee}
    visible={showTees}
  />
))}
        </g>
      </svg>
      <div className="golf-map-key" aria-label="Map legend">
        <span><i className="key-tee" /> Tee</span><span><i className="key-cup" /> Hole</span>
      </div>
    </div>
  );
}
