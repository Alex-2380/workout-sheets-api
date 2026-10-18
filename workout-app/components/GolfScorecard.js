import { formatDistance, relativeToPar, scoreTotal } from '../utils/golfCourse';

function scoreLabel(value) {
  const score = Number(value);
  if (!Number.isFinite(score)) return '—';
  return score;
}

export default function GolfScorecard({
  round,
  editable = false,
  activeHoleIndex,
  onScoreChange,
  onHoleSelect,
}) {
  if (!round) return null;

  const holes = round.holes || [];

  return (
    <div
      className="golf-scorecard-wrap"
      aria-label={`${round.courseName} scorecard`}
    >
      <table className="golf-scorecard">
        <thead>
          <tr>
            <th scope="col">Hole</th>

            {holes.map((hole, index) => (
              <th
                scope="col"
                key={hole.id || index}
                className={activeHoleIndex === index ? 'is-current' : ''}
              >
                {editable ? (
                  <button
                    type="button"
                    className={`golf-scorecard-hole-button ${
                      activeHoleIndex === index ? 'is-current' : ''
                    }`}
                    onClick={() => onHoleSelect?.(index)}
                    aria-label={`Select hole ${index + 1}`}
                    aria-pressed={activeHoleIndex === index}
                  >
                    {index + 1}
                  </button>
                ) : (
                  index + 1
                )}
              </th>
            ))}

            <th scope="col">Total</th>
            <th scope="col">+/−</th>
          </tr>
        </thead>

        <tbody>
          <tr className="golf-scorecard-detail-row">
            <th scope="row">Par</th>

            {holes.map((hole, index) => (
              <td
                key={hole.id || index}
                className={activeHoleIndex === index ? 'is-current' : ''}
              >
                {hole.par || 3}
              </td>
            ))}

            <td>
              {holes.reduce(
                (sum, hole) => sum + Number(hole.par || 3),
                0
              )}
            </td>
            <td>—</td>
          </tr>

          <tr className="golf-scorecard-detail-row golf-scorecard-distance-row">
            <th scope="row">Yards</th>

            {holes.map((hole, index) => (
              <td
                key={hole.id || index}
                className={activeHoleIndex === index ? 'is-current' : ''}
              >
                {formatDistance(hole.distanceFeet)}
              </td>
            ))}

            <td>—</td>
            <td>—</td>
          </tr>

          {(round.players || []).map((player, playerIndex) => (
            <tr key={`${player.name}-${playerIndex}`}>
              <th scope="row">{player.name}</th>

              {holes.map((hole, index) => (
                <td
                  key={hole.id || index}
                  className={activeHoleIndex === index ? 'is-current' : ''}
                >
                  {editable ? (
                    <input
                      className="golf-score-input"
                      aria-label={`${player.name}, hole ${index + 1} strokes`}
                      type="number"
                      min="1"
                      inputMode="numeric"
                      value={player.scores?.[index] ?? ''}
                      onChange={(event) =>
                        onScoreChange?.(
                          playerIndex,
                          index,
                          event.target.value
                        )
                      }
                    />
                  ) : (
                    scoreLabel(player.scores?.[index])
                  )}
                </td>
              ))}

              <td className="golf-score-total">
                {scoreTotal(player)}
              </td>

              <td
                className={
                  relativeToPar(player, holes) <= 0
                    ? 'golf-under-par'
                    : 'golf-over-par'
                }
              >
                {relativeToPar(player, holes) > 0 ? '+' : ''}
                {relativeToPar(player, holes)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
