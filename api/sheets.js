export default function handler(req, res) {
  const { tab } = req.query;

  if (!tab) {
    return res.status(400).json({ error: "Missing 'tab' query parameter" });
  }

  if (tab === "Routines") {
    return res.status(200).json([
      { Routine: "MAX 30 (PHASE 1)", Day: 1, Exercise: "ROMANIAN DEADLIFT", Sets: 3, "Target Reps": 10 },
      { Routine: "MAX 30 (PHASE 1)", Day: 1, Exercise: "EZ BAR CURLS", Sets: 3, "Target Reps": 10 },
      { Routine: "MAX 30 (PHASE 1)", Day: 1, Exercise: "REVERSE CRUNCH", Sets: 3, "Target Reps": 15 },
    ]);
  } else {
    return res.status(404).json({ error: `No data for tab ${tab}` });
  }
}
