// api/sheets.js

export default function handler(req, res) {
  const { tab } = req.query;

  if (!tab) {
    return res.status(400).json({ error: "Missing 'tab' query parameter" });
  }

  // Dummy data for example — replace this with your Google Sheets logic later
  const dummyData = {
    Routines: [
      { Routine: "MAX 30 (PHASE 1)", Day: 1, Exercise: "ROMANIAN DEADLIFT", Sets: 3, "Target Reps": 10 },
      { Routine: "MAX 30 (PHASE 1)", Day: 1, Exercise: "EZ BAR CURLS", Sets: 3, "Target Reps": 10 },
      { Routine: "MAX 30 (PHASE 1)", Day: 1, Exercise: "REVERSE CRUNCH", Sets: 3, "Target Reps": 15 },
    ],
    Users: [
      { Users: "Alex", "Current Routine": "BULKY" },
      { Users: "Cait", "Current Routine": "CALI-BROS (PHASE 2)" },
    ],
    Data: [
      { User: "Alex", Routine: "STACKED", Day: 1, Exercise: "ALTERNATING DUMBBELL CURL", Weight: 20, Set: 1, Reps: 25, Date: "8/31/2023" },
      { User: "Alex", Routine: "STACKED", Day: 1, Exercise: "ALTERNATING DUMBBELL CURL", Weight: 30, Set: 2, Reps: 11, Date: "9/4/2023" },
    ],
  };

  if (!dummyData[tab]) {
    return res.status(404).json({ error: `No data found for tab '${tab}'` });
  }

  res.status(200).json(dummyData[tab]);
}
