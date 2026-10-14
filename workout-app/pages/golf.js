import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import GolfCourseMap from '../components/GolfCourseMap';
import GolfScorecard from '../components/GolfScorecard';
import { golfStorage, makeId } from '../utils/golfStorage';
import { golfSheets } from '../utils/golfSheets';
import {
  CUP_MARKERS,
  coursePar,
  formatDistance,
  generateRoundHoles,
  getCup,
  getTee,
  isBallAllowed,
  materializeCourse,
  relativeToPar,
  scoreTotal,
  shortBallLabel,
} from '../utils/golfCourse';
import { storage } from '../utils/storage';

const tabs = [
  ['home', 'Home'], ['play', 'Play'], ['courses', 'Courses'], ['map', 'Course Map'], ['leaderboard', 'Leaderboards'],
];

function displayDate(value) {
  if (!value) return '—';
  try { return new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }); } catch { return value; }
}

function roundFromHoles({ courseId, courseName, source, holes, players, ballType, generatorSeed }) {
  const now = new Date().toISOString();
  return {
    id: makeId('round'),
    courseId,
    courseName,
    source,
    ballType,
    generatorSeed: generatorSeed || null,
    createdAt: now,
    updatedAt: now,
    completedAt: null,
    status: 'active',
    holes: holes.map((hole, index) => ({ ...hole, number: index + 1 })),
    players: players.map(name => ({ id: makeId('player'), name, scores: Array(holes.length).fill('') })),
  };
}

function ballTypesCompatible(holes, tees, ballType) {
  return ballType === 'any' || holes.every(hole => isBallAllowed(getTee(tees, hole.teeId), ballType));
}

export default function GolfPage() {
  const [username, setUsername] = useState('');
  const [profile, setProfile] = useState(null);
  const [tab, setTab] = useState('home');
  const [selectedTeeId, setSelectedTeeId] = useState('T01');
  const [selectedCupId, setSelectedCupId] = useState('H1');
  const [showTees, setShowTees] = useState(true);
  const [showMeasurements, setShowMeasurements] = useState(true);
  const [units, setUnits] = useState('yards');
  const [message, setMessage] = useState('');
  const [syncStatus, setSyncStatus] = useState('Local-first');
  const [selectedCourseId, setSelectedCourseId] = useState('backyard-classic');
  const [ballType, setBallType] = useState('any');
  const [roundLength, setRoundLength] = useState(9);
  const [playerNames, setPlayerNames] = useState(['']);
  const [randomPreview, setRandomPreview] = useState(null);
  const [activeHoleIndex, setActiveHoleIndex] = useState(0);
  const [courseDraft, setCourseDraft] = useState(null);
  const [teeDraft, setTeeDraft] = useState(null);
  const [historyRoundId, setHistoryRoundId] = useState(null);
  const [leaderboardCourseId, setLeaderboardCourseId] = useState('backyard-classic');

  useEffect(() => {
    const user = storage.getUser();
    if (!user?.name) { window.location.href = '/'; return; }
    setUsername(user.name);
    setPlayerNames([user.name]);
    const local = golfStorage.load(user.name);
    setProfile(local);
    golfSheets.loadRounds(user.name)
      .then(remote => {
        let merged = local;

if (remote.layout) {
  merged = golfStorage.save(user.name, {
    ...local,
    tees:
      Array.isArray(remote.layout.tees)
        ? remote.layout.tees
        : local.tees,
    cups:
      Array.isArray(remote.layout.cups)
        ? remote.layout.cups
        : local.cups,
    courses:
      Array.isArray(remote.layout.courses)
        ? remote.layout.courses
        : local.courses,
    updatedAt: remote.layout.updatedAt || new Date().toISOString(),
  });
}

if (Array.isArray(remote.rounds)) {
  merged = golfStorage.mergeRemoteRounds(user.name, remote.rounds);
}

setProfile(merged);
setSyncStatus('Google Sheets connected');
      })
      .catch(() => setSyncStatus('Saved on this device'));
  }, []);

  useEffect(() => {
    if (!profile) return;
    const tee = getTee(profile.tees, selectedTeeId);
    if (tee) setTeeDraft({ ...tee, permitted: (tee.permittedCupIds || []).join(', ') });
  }, [profile, selectedTeeId]);

  const activeRound = useMemo(() => profile?.rounds.find(round => round.id === profile.activeRoundId && round.status === 'active') || null, [profile]);
  const selectedTee = useMemo(() => getTee(profile?.tees, selectedTeeId), [profile, selectedTeeId]);
  const selectedCup = useMemo(
  () => getCup(selectedCupId, profile?.cups || CUP_MARKERS),
  [selectedCupId, profile?.cups]
);

const selectedMapHole =
  profile && selectedTee && selectedCup
    ? materializeCourse(
        { holes: [[selectedTee.id, selectedCup.id]] },
        profile.tees,
        profile.cups || CUP_MARKERS
      )[0]
    : null;

  const saveRound = (round, mirror = true) => {
    const saved = golfStorage.saveRound(username, round);
    setProfile(saved);
    if (mirror) {
      setSyncStatus('Saving to Google Sheets…');
      golfSheets.saveRound(username, round)
        .then(() => setSyncStatus('Google Sheets connected'))
        .catch(() => setSyncStatus('Saved on this device · Google sync pending'));
    }
    return saved;
  };

const layoutSnapshot = state => ({
  tees: state.tees,
  cups: state.cups || CUP_MARKERS,
  courses: state.courses,
  updatedAt: state.updatedAt || new Date().toISOString(),
});

  const mirrorLayout = state => {
    setSyncStatus('Saving layout to Google Sheets…');
    golfSheets.saveLayout(username, layoutSnapshot(state))
      .then(() => setSyncStatus('Google Sheets connected'))
      .catch(() => setSyncStatus('Saved on this device · Google sync pending'));
  };

  const choosePlayerCount = count => {
    setPlayerNames(current => Array.from({ length: count }, (_, index) => current[index] || (index === 0 ? username : '')));
  };

  const validPlayers = () => playerNames.map(name => name.trim()).filter(Boolean);

  const startRound = ({ holes, courseId, courseName, source, seed }) => {
    const players = validPlayers();
    if (!players.length) { setMessage('Add at least one player before starting.'); return; }
    if (!holes.length) { setMessage('This course does not have any holes yet.'); return; }
    if (!ballTypesCompatible(holes, profile.tees, ballType)) {
      setMessage(`${shortBallLabel(ballType)} is not approved for every tee in this round. Choose “Any approved ball,” foam, or a different course.`);
      return;
    }
    const round = roundFromHoles({ courseId, courseName, source, holes, players, ballType, generatorSeed: seed });
    saveRound(round);
    setActiveHoleIndex(0);
    setTab('round');
    setMessage('Round started. Scores are saved after every change.');
  };

  const previewRandom = () => {
    try {
      const seed = Date.now();
      const holes = generateRoundHoles(
  profile.tees,
  Number(roundLength),
  ballType,
  seed,
  profile.cups || CUP_MARKERS
);
      setRandomPreview({ holes, seed });
      setMessage(`Generated ${roundLength} unique, approved holes. Review them below or generate another.`);
    } catch (error) {
      setMessage(error.message);
      setRandomPreview(null);
    }
  };

  const startPreset = course => {
    const holes = materializeCourse(course, profile.tees, profile.cups || CUP_MARKERS);
    if (holes.some(hole => !getTee(profile.tees, hole.teeId) || !getCup(hole.cupId))) {
      setMessage('This course references an archived tee or missing cup. Edit the course before play.');
      return;
    }
    startRound({ holes, courseId: course.id, courseName: course.name, source: 'preset' });
  };

  const updateScore = (playerIndex, holeIndex, value) => {
    if (!activeRound) return;
    const players = activeRound.players.map((player, index) => {
      if (index !== playerIndex) return player;
      const scores = [...player.scores];
      scores[holeIndex] = value === '' ? '' : Math.max(1, Number(value));
      return { ...player, scores };
    });
    saveRound({ ...activeRound, players, updatedAt: new Date().toISOString() });
  };

  const completeRound = () => {
    if (!activeRound) return;
    const unfinished = activeRound.players.some(player => player.scores.some(score => score === '' || !Number.isFinite(Number(score))));
    if (unfinished) { setMessage('Enter a score for every player on every hole before completing the round.'); return; }
    const finished = { ...activeRound, status: 'completed', completedAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    saveRound(finished);
    setTab('leaderboard');
    setLeaderboardCourseId(finished.courseId);
    setMessage('Round complete. Your scorecard is now in course history.');
  };

const cancelRound = () => {
  if (!activeRound) return;

  const now = new Date().toISOString();

  const cancelled = {
    ...activeRound,
    status: 'cancelled',
    cancelledAt: now,
    updatedAt: now,
  };

  const saved = golfStorage.saveRound(username, cancelled);

  setProfile(saved);
  setTab('home');
  setActiveHoleIndex(0);
  setMessage('Round cancelled. Its history has been retained.');

  setSyncStatus('Cancelling round in Google Sheets…');

  golfSheets.saveRound(username, cancelled)
    .then(() => setSyncStatus('Google Sheets connected'))
    .catch(() => {
      setSyncStatus('Saved on this device · Google sync pending');
    });
};

  const updateTee = () => {
    if (!teeDraft) return;
const permittedCupIds = teeDraft.permitted
  .split(',')
  .map(id => id.trim().toUpperCase())
  .filter(id =>
    (profile.cups || CUP_MARKERS).some(cup => cup.id === id)
  );
    if (!teeDraft.name.trim() || !permittedCupIds.length || !Number.isFinite(Number(teeDraft.x)) || !Number.isFinite(Number(teeDraft.y))) {
      setMessage('A tee needs a name, map X/Y values, and at least one valid permitted cup.'); return;
    }
    const tees = profile.tees.map(tee => tee.id === teeDraft.id ? {
      ...tee,
      name: teeDraft.name.trim(), x: Number(teeDraft.x), y: Number(teeDraft.y), surface: teeDraft.surface,
      ballType: teeDraft.ballType, permittedCupIds, active: teeDraft.active !== false,
    } : tee);
    const saved = golfStorage.replaceTees(username, tees);
    setProfile(saved);
    mirrorLayout(saved);
    setMessage(`${teeDraft.id} updated locally. Existing rounds retain their original hole snapshots.`);
  };

  const addTee = () => {
    const ids = profile.tees.map(tee => Number(String(tee.id).replace(/\D/g, '')) || 0);
    const id = `T${String(Math.max(...ids, 0) + 1).padStart(2, '0')}`;
    const tee = { id, name: 'New tee', x: 630, y: 350, surface: 'artificial turf', ballType: 'both', permittedCupIds: ['H1', 'H2'], active: true, distanceSource: 'estimated' };
    const saved = golfStorage.replaceTees(username, [...profile.tees, tee]);
    setProfile(saved);
    mirrorLayout(saved);
    setSelectedTeeId(id);
    setMessage(`${id} added at a safe, editable starting position near the turf/court edge.`);
  };

  const archiveTee = () => {
    if (!selectedTee) return;
    const tees = profile.tees.map(tee => tee.id === selectedTee.id ? { ...tee, active: false } : tee);
    const saved = golfStorage.replaceTees(username, tees);
    setProfile(saved);
    mirrorLayout(saved);
    setMessage(`${selectedTee.id} was archived. It remains in historical rounds but cannot be chosen for new play.`);
    const next = tees.find(tee => tee.active !== false);
    if (next) setSelectedTeeId(next.id);
  };

  const openCourseEditor = course => {
    setCourseDraft({ ...course, holes: course.holes.map(hole => Array.isArray(hole) ? [...hole] : [hole.teeId, hole.cupId]) });
    setSelectedCourseId(course.id);
  };

  const newCourse = () => {
    setCourseDraft({ id: makeId('course'), name: 'New backyard course', description: 'Custom course', holes: [] });
  };

  const saveCourse = () => {
    if (!courseDraft?.name?.trim() || !courseDraft.holes.length) { setMessage('A course needs a name and at least one tee-to-cup hole.'); return; }
    const courses = profile.courses.some(course => course.id === courseDraft.id)
      ? profile.courses.map(course => course.id === courseDraft.id ? { ...courseDraft, name: courseDraft.name.trim() } : course)
      : [...profile.courses, { ...courseDraft, name: courseDraft.name.trim() }];
    const saved = golfStorage.replaceCourses(username, courses);
    setProfile(saved);
    mirrorLayout(saved);
    setSelectedCourseId(courseDraft.id);
    setLeaderboardCourseId(courseDraft.id);
    setMessage('Course saved. Its holes will be snapshotted when a round starts.');
  };

  const duplicateCourse = course => {
    const copy = { ...course, id: makeId('course'), name: `${course.name} copy`, holes: course.holes.map(hole => Array.isArray(hole) ? [...hole] : [hole.teeId, hole.cupId]) };
    const saved = golfStorage.replaceCourses(username, [...profile.courses, copy]);
    setProfile(saved);
    mirrorLayout(saved);
    setCourseDraft(copy);
    setSelectedCourseId(copy.id);
    setMessage('Course duplicated. Rename or adjust its holes, then save.');
  };

  const deleteCourse = course => {
    const courses = profile.courses.filter(item => item.id !== course.id);
    const saved = golfStorage.replaceCourses(username, courses);
    setProfile(saved);
    mirrorLayout(saved);
    setCourseDraft(null);
    setSelectedCourseId(courses[0]?.id || '');
    setMessage(`${course.name} was removed from future play. Historical rounds remain unchanged.`);
  };

  const initializeSheets = () => {
    setSyncStatus('Setting up Google Sheets…');
    golfSheets.initialize(username, layoutSnapshot(profile))
      .then(() => setSyncStatus('Google Sheets ready'))
      .catch(() => setSyncStatus('Could not set up Google Sheets — your device copy is safe'));
  };

  if (!profile) return null;

  const currentCourse = profile.courses.find(course => course.id === selectedCourseId) || profile.courses[0];
  const completedRounds = profile.rounds.filter(round => round.status === 'completed');
  const historyRound = profile.rounds.find(round => round.id === historyRoundId) || null;
  const leaderboardRows = completedRounds
    .filter(round => round.courseId === leaderboardCourseId)
    .flatMap(round => round.players.map(player => ({
      key: `${round.id}-${player.id}`, name: player.name, total: scoreTotal(player), relative: relativeToPar(player, round.holes), date: round.completedAt, round,
    })))
    .sort((a, b) => a.total - b.total || new Date(a.date) - new Date(b.date));

const map = (extra = {}) => (
  <GolfCourseMap
    tees={profile.tees}
    cups={profile.cups || CUP_MARKERS}
    selectedTeeId={extra.teeId || selectedTeeId}
    selectedCupId={extra.cupId || selectedCupId}
    onSelectTee={setSelectedTeeId}
    onSelectCup={setSelectedCupId}
    showTees={showTees}
    showMeasurements={showMeasurements}
    showOnlySelectedMarkers={Boolean(extra.onlySelectedMarkers)}
    units={units}
  />
);

  const playerFields = (
    <div className="golf-player-fields">
      <div className="golf-choice-row" aria-label="Number of players">
        {[1, 2, 3, 4].map(count => <button key={count} type="button" className={playerNames.length === count ? 'golf-choice is-active' : 'golf-choice'} onClick={() => choosePlayerCount(count)}>{count} {count === 1 ? 'player' : 'players'}</button>)}
      </div>
      {playerNames.map((name, index) => (
        <input key={index} value={name} placeholder={`Player ${index + 1} name`} onChange={event => setPlayerNames(current => current.map((item, itemIndex) => itemIndex === index ? event.target.value : item))} />
      ))}
    </div>
  );

  return (
    <div className="golf-page fade-in">
      <section className="golf-hero card">
        <div>
          <div className="golf-eyebrow">MAXLIFT · BACKYARD GOLF</div>
          <h1>Backyard Golf</h1>
        </div>
        <div className="golf-hero-status"><span className="badge">{syncStatus}</span><span className="golf-user">{username}</span></div>
      </section>

      <nav className="golf-tabs" aria-label="Golf sections">
        {tabs.map(([id, label]) => <button key={id} type="button" className={tab === id ? 'is-active' : ''} onClick={() => { setTab(id); setMessage(''); }}>{label}</button>)}
      </nav>

      {message && <div className="golf-notice" role="status">{message}</div>}

      {tab === 'home' && (
        <div className="grid golf-home-grid">
          {activeRound ? (
            <section className="card golf-resume-card">
              <div><div className="golf-eyebrow">ROUND IN PROGRESS</div><h2>{activeRound.courseName}</h2><p>{activeRound.players.map(player => player.name).join(' · ')} · {activeRound.holes.length} holes</p></div>
              <button className="primary" onClick={() => setTab('round')}>Resume round</button>
            </section>
          ) : (
            <section className="golf-action-grid">
              <button className="golf-action-card" onClick={() => setTab('play')}><strong>Play a round</strong><span>Preset or random course</span></button>
              <button className="golf-action-card" onClick={() => setTab('courses')}><strong>Courses</strong><span>{profile.courses.length} available layouts</span></button>
              <button className="golf-action-card" onClick={() => setTab('map')}><strong>Course map</strong><span>Explore tees and fixed cups</span></button>
              <button className="golf-action-card" onClick={() => setTab('leaderboard')}><strong>Leaderboards</strong><span>{completedRounds.length} completed rounds</span></button>
            </section>
          )}
        </div>
      )}

      {tab === 'play' && (
        <div className="grid">
          <section className="card">
            <div className="golf-section-heading"><div><div className="golf-eyebrow">START A ROUND</div><h2>Players and ball</h2></div><span className="badge">Scores auto-save</span></div>
            {playerFields}
            <label className="golf-field-label">Ball type
              <select value={ballType} onChange={event => { setBallType(event.target.value); setRandomPreview(null); }}>
                <option value="any">Any approved ball</option><option value="real">Real ball</option><option value="foam">Foam ball</option>
              </select>
            </label>
          </section>
          <section className="card">
            <div className="golf-section-heading"><div><div className="golf-eyebrow">PRESET COURSE</div><h2>Play a saved layout</h2></div></div>
            <div className="golf-course-play-list">
              {profile.courses.map(course => {
                const holes = materializeCourse(course, profile.tees, profile.cups || CUP_MARKERS);
                return <article key={course.id} className="golf-course-row"><div><strong>{course.name}</strong><span>{holes.length} holes · Par {coursePar(holes)}</span><p>{course.description}</p></div><button type="button" className="action" onClick={() => startPreset(course)}>Play</button></article>;
              })}
            </div>
          </section>
          <section className="card">
            <div className="golf-section-heading"><div><div className="golf-eyebrow">RANDOM ROUND</div><h2>Generate random round</h2></div></div>
            <div className="golf-choice-row">
              {[3, 6, 9, 18].map(length => <button key={length} type="button" className={Number(roundLength) === length ? 'golf-choice is-active' : 'golf-choice'} onClick={() => { setRoundLength(length); setRandomPreview(null); }}>{length} holes</button>)}
              <button type="button" className="secondary" onClick={previewRandom}>Generate</button>
            </div>
            {randomPreview && <div className="golf-preview"><div className="golf-preview-list">{randomPreview.holes.map(hole => <span key={hole.number}><b>{hole.number}.</b> {hole.teeId} → {hole.cupId} <em>{formatDistance(hole.distanceFeet, units)}</em></span>)}</div><button className="primary" onClick={() => startRound({ holes: randomPreview.holes, courseId: 'random', courseName: `Random ${roundLength}`, source: 'random', seed: randomPreview.seed })}>Accept round</button></div>}
          </section>
        </div>
      )}

      {tab === 'round' && activeRound && (
        <div className="grid">
          <section className="card golf-round-header">
            <div><div className="golf-eyebrow">{activeRound.courseName}</div><h2>Hole {activeHoleIndex + 1} of {activeRound.holes.length}</h2><p>{activeRound.players.map(player => player.name).join(' · ')} · {shortBallLabel(activeRound.ballType)}</p></div>
           <div className="golf-hole-nav">
  <button
    type="button"
    className="ghost"
    disabled={activeHoleIndex === 0}
    onClick={() =>
      setActiveHoleIndex(value => Math.max(0, value - 1))
    }
  >
    Previous
  </button>

  <button
    type="button"
    className="ghost"
    disabled={activeHoleIndex === activeRound.holes.length - 1}
    onClick={() =>
      setActiveHoleIndex(value =>
        Math.min(activeRound.holes.length - 1, value + 1)
      )
    }
  >
    Next
  </button>

  <button
    type="button"
    className="golf-danger-button"
    onClick={cancelRound}
  >
    Cancel round
  </button>
</div>
          </section>
          {(() => {
            const hole = activeRound.holes[activeHoleIndex];
            return <section className="golf-active-hole"><div className="card golf-hole-details"><div className="golf-eyebrow">TEE → CUP</div><h2>{hole.teeId} → {hole.cupId}</h2><div className="golf-distance-large">{formatDistance(hole.distanceFeet, units)}</div><p><span className="badge">Par {hole.par}</span> <span className="badge">{hole.distanceSource === 'verified' ? 'Verified' : 'Estimated from map'}</span></p><p className="muted">{hole.teeName} to {hole.cupName}</p></div>{map({
  teeId: hole.teeId,
  cupId: hole.cupId,
  onlySelectedMarkers: true,
})}</section>;
          })()}
          <section className="card"><div className="golf-section-heading"><div><div className="golf-eyebrow">SCORECARD</div><h2>Enter or edit strokes</h2></div><button type="button" className="primary" onClick={completeRound}>Complete round</button></div><GolfScorecard round={activeRound} editable activeHoleIndex={activeHoleIndex} onScoreChange={updateScore} /></section>
        </div>
      )}

      {tab === 'round' && !activeRound && <section className="card golf-empty-state"><h2>No active round</h2><p>Choose a preset course or generate a random round to begin.</p><button className="primary" onClick={() => setTab('play')}>Play a round</button></section>}

      {tab === 'courses' && (
        <div className="grid">
          <section className="card"><div className="golf-section-heading"><div><div className="golf-eyebrow">COURSE LIBRARY</div><h2>Saved courses</h2></div><button type="button" className="action" onClick={newCourse}>New course</button></div><div className="golf-course-grid">{profile.courses.map(course => { const holes = materializeCourse(course, profile.tees, profile.cups || CUP_MARKERS); return <article key={course.id} className="golf-course-card"><div><span className="badge">{holes.length} holes</span><h3>{course.name}</h3><p>{course.description}</p><p className="muted">Par {coursePar(holes)}</p></div><div className="golf-course-card-actions"><button className="ghost" onClick={() => openCourseEditor(course)}>Edit</button><button className="ghost" onClick={() => duplicateCourse(course)}>Duplicate</button><button className="action" onClick={() => { setSelectedCourseId(course.id); setTab('play'); }}>Play</button></div></article>; })}</div></section>
          {courseDraft && <section className="card"><div className="golf-section-heading"><div><div className="golf-eyebrow">COURSE BUILDER</div><h2>{courseDraft.name || 'Untitled course'}</h2></div><button className="primary" onClick={saveCourse}>Save course</button></div><div className="golf-form-grid"><label>Course name<input value={courseDraft.name} onChange={event => setCourseDraft(draft => ({ ...draft, name: event.target.value }))} /></label><label>Description<input value={courseDraft.description || ''} onChange={event => setCourseDraft(draft => ({ ...draft, description: event.target.value }))} /></label></div><div className="golf-builder-add"><select value={selectedTeeId} onChange={event => setSelectedTeeId(event.target.value)}>{profile.tees.filter(tee => tee.active !== false).map(tee => <option key={tee.id} value={tee.id}>{tee.id} · {tee.name}</option>)}</select><select value={selectedCupId} onChange={event => setSelectedCupId(event.target.value)}>{(profile.cups || CUP_MARKERS).map(cup => (
  <option key={cup.id} value={cup.id}>
    {cup.id} · {cup.name}
  </option>
))}</select><button className="action" onClick={() => setCourseDraft(draft => ({ ...draft, holes: [...draft.holes, [selectedTeeId, selectedCupId]] }))}>Add hole</button></div><ol className="golf-builder-holes">{courseDraft.holes.map((hole, index) => <li key={`${hole[0]}-${hole[1]}-${index}`}><span>Hole {index + 1}: <strong>{hole[0]} → {hole[1]}</strong></span><button className="golf-text-button" onClick={() => setCourseDraft(draft => ({ ...draft, holes: draft.holes.filter((_, itemIndex) => itemIndex !== index) }))}>Remove</button></li>)}</ol>{profile.courses.some(course => course.id === courseDraft.id) && <button className="golf-danger-button" onClick={() => deleteCourse(courseDraft)}>Delete course</button>}</section>}
        </div>
      )}

      {tab === 'map' && (
        <div className="grid golf-map-page-grid">
          {map()}
          <section className="card golf-map-inspector"><div className="golf-section-heading"><div><div className="golf-eyebrow">MAP INSPECTOR</div><h2>{selectedTeeId} → {selectedCupId}</h2></div><span className="badge">{selectedMapHole?.distanceSource === 'verified' ? 'Verified' : 'Estimated'}</span></div><div className="golf-map-selects"><label>Tee<select value={selectedTeeId} onChange={event => setSelectedTeeId(event.target.value)}>{profile.tees.filter(tee => tee.active !== false).map(tee => <option key={tee.id} value={tee.id}>{tee.id} · {tee.name}</option>)}</select></label><label>Cup<select value={selectedCupId} onChange={event => setSelectedCupId(event.target.value)}>{(profile.cups || CUP_MARKERS).map(cup => (
  <option key={cup.id} value={cup.id}>
    {cup.id} · {cup.name}
  </option>
))}</select></label></div><div className="golf-distance-large">{selectedMapHole ? formatDistance(selectedMapHole.distanceFeet, units) : '—'}</div><p className="muted">Straight-line estimate based on the 66′ × 50′ turf calibration. Measure each tee-to-cup pair in the yard to mark it verified.</p><div className="golf-choice-row"><button className={units === 'yards' ? 'golf-choice is-active' : 'golf-choice'} onClick={() => setUnits('yards')}>Yards</button><button className={units === 'feet' ? 'golf-choice is-active' : 'golf-choice'} onClick={() => setUnits('feet')}>Feet</button><button className={showTees ? 'golf-choice is-active' : 'golf-choice'} onClick={() => setShowTees(value => !value)}>Tees</button><button className={showMeasurements ? 'golf-choice is-active' : 'golf-choice'} onClick={() => setShowMeasurements(value => !value)}>Measure</button></div></section>
          {teeDraft && <section className="card"><div className="golf-section-heading"><div><div className="golf-eyebrow">TEE EDITOR</div><h2>{teeDraft.id}</h2></div><button className="action" onClick={addTee}>Add tee</button></div><div className="golf-form-grid"><label>Name<input value={teeDraft.name} onChange={event => setTeeDraft(draft => ({ ...draft, name: event.target.value }))} /></label><label>Surface<input value={teeDraft.surface} onChange={event => setTeeDraft(draft => ({ ...draft, surface: event.target.value }))} /></label><label>Map X<input type="number" value={teeDraft.x} onChange={event => setTeeDraft(draft => ({ ...draft, x: event.target.value }))} /></label><label>Map Y<input type="number" value={teeDraft.y} onChange={event => setTeeDraft(draft => ({ ...draft, y: event.target.value }))} /></label><label>Ball approval<select value={teeDraft.ballType} onChange={event => setTeeDraft(draft => ({ ...draft, ballType: event.target.value }))}><option value="real">Real ball</option><option value="foam">Foam ball</option><option value="both">Both</option></select></label><label>Permitted cups<input value={teeDraft.permitted} placeholder="H1, H2" onChange={event => setTeeDraft(draft => ({ ...draft, permitted: event.target.value }))} /></label></div><div className="golf-editor-actions"><button className="primary" onClick={updateTee}>Save tee</button><button className="golf-danger-button" onClick={archiveTee}>Archive tee</button></div></section>}
        </div>
      )}

      {tab === 'leaderboard' && (
        <div className="grid">
          <section className="card"><div className="golf-section-heading"><div><div className="golf-eyebrow">LEADERBOARD</div><h2>Best completed scores</h2></div><label className="golf-inline-select">Course<select value={leaderboardCourseId} onChange={event => setLeaderboardCourseId(event.target.value)}>{profile.courses.map(course => <option key={course.id} value={course.id}>{course.name}</option>)}<option value="random">Random rounds</option></select></label></div>{leaderboardCourseId === 'random' && <p className="golf-notice">Random layouts are shown only as history; scores from different random layouts are not ranked together.</p>}{leaderboardCourseId !== 'random' && <div className="golf-leaderboard">{leaderboardRows.length ? leaderboardRows.map((row, index) => <div key={row.key} className="golf-leaderboard-row"><span className="golf-rank">{index + 1}</span><strong>{row.name}</strong><span>{row.total} <em>{row.relative > 0 ? '+' : ''}{row.relative}</em></span><span className="muted">{displayDate(row.date)}</span></div>) : <p className="muted">No completed rounds on this course yet.</p>}</div>}</section>
          <section className="card"><div className="golf-section-heading"><div><div className="golf-eyebrow">ROUND HISTORY</div><h2>Previous scorecards</h2></div></div><div className="golf-history-list">{completedRounds.length ? completedRounds.map(round => <button key={round.id} className="golf-history-row" onClick={() => setHistoryRoundId(round.id)}><span><strong>{round.courseName}</strong><small>{displayDate(round.completedAt)} · {round.players.map(player => player.name).join(', ')}</small></span><span>{round.players.map(player => `${player.name}: ${scoreTotal(player)}`).join(' · ')}</span></button>) : <p className="muted">Finish a round to build your history.</p>}</div>{historyRound && <div className="golf-history-score"><div className="divider" /><h3>{historyRound.courseName} · {displayDate(historyRound.completedAt)}</h3><GolfScorecard round={historyRound} /></div>}</section>
        </div>
      )}

      <div className="golf-back-link"><Link href="/dashboard">← Back to MaxLift dashboard</Link></div>
    </div>
  );
}
