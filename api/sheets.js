import { google } from "googleapis";

function withTimeout(promise, ms = 8000) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Sheets request timed out")), ms)
    ),
  ]);
}

export default async function handler(req, res) {
  try {
    const { tab } = req.query;

    if (!tab) return res.status(400).json({ error: "Missing 'tab'" });

    const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
    });

    // Disable retries
    google.options({ retry: false });

    const sheets = google.sheets({ version: "v4", auth });
    const spreadsheetId = process.env.SPREADSHEET_ID;

    const response = await withTimeout(
      sheets.spreadsheets.values.get({ spreadsheetId, range: tab }),
      8000
    );

    return res.status(200).json(response.data.values ?? []);
  } catch (err) {
    console.error("Sheets API error:", err.message);
    return res.status(503).json({ error: "Sheet data temporarily unavailable" });
  }
}
