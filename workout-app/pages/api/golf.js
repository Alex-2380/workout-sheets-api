import { google } from 'googleapis';

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];
const ROUNDS_TAB = 'GolfRounds';
const ROUNDS_HEADER = ['RoundId', 'Owner', 'Status', 'CourseId', 'CourseName', 'CreatedAt', 'UpdatedAt', 'CompletedAt', 'PayloadJson'];
const SETUP_TABS = [
  ['GolfSettings', ['Key', 'Value']],
  ['GolfTees', ['TeeId', 'Name', 'X', 'Y', 'Surface', 'BallType', 'PermittedCupIds', 'Active', 'UpdatedAt']],
  ['GolfHoles', ['CupId', 'Name', 'X', 'Y', 'Tier', 'Verified', 'UpdatedAt']],
  ['GolfCourses', ['CourseId', 'Name', 'Description', 'UpdatedAt']],
  ['GolfCourseHoles', ['CourseHoleId', 'CourseId', 'HoleNumber', 'TeeId', 'CupId', 'Par', 'UpdatedAt']],
  [ROUNDS_TAB, ROUNDS_HEADER],
];

function parseCredentials() {
  if (process.env.GOOGLE_CREDENTIALS) {
    return typeof process.env.GOOGLE_CREDENTIALS === 'string'
      ? JSON.parse(process.env.GOOGLE_CREDENTIALS)
      : process.env.GOOGLE_CREDENTIALS;
  }
  if (process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_PRIVATE_KEY) {
    return {
      type: 'service_account',
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    };
  }
  throw new Error('Google Sheets credentials are not configured.');
}

async function client() {
  const spreadsheetId = process.env.GOOGLE_SHEETS_ID || process.env.SPREADSHEET_ID;
  if (!spreadsheetId) throw new Error('GOOGLE_SHEETS_ID (or SPREADSHEET_ID) is not configured.');
  const auth = new google.auth.GoogleAuth({ credentials: parseCredentials(), scopes: SCOPES });
  return { spreadsheetId, sheets: google.sheets({ version: 'v4', auth }) };
}

function columnName(index) {
  let value = index + 1;
  let result = '';
  while (value > 0) {
    const remainder = (value - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    value = Math.floor((value - 1) / 26);
  }
  return result;
}

async function ensureTabs(sheets, spreadsheetId, definitions = SETUP_TABS) {
  const metadata = await sheets.spreadsheets.get({ spreadsheetId, fields: 'sheets.properties' });
  const existing = new Set((metadata.data.sheets || []).map(sheet => sheet.properties.title));
  const missing = definitions.filter(([title]) => !existing.has(title));
  if (missing.length) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests: missing.map(([title]) => ({ addSheet: { properties: { title } } })) },
    });
  }

  // A header is written only into a completely empty tab. Existing data is
  // never reset, replaced, or reordered by initialization.
  await Promise.all(definitions.map(async ([title, header]) => {
    const response = await sheets.spreadsheets.values.get({ spreadsheetId, range: `${title}!A1:Z1` });
    const existingHeader = response.data.values?.[0] || [];
    if (!existingHeader.length) {
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${title}!A1:${columnName(header.length - 1)}1`,
        valueInputOption: 'RAW',
        requestBody: { values: [header] },
      });
    } else if (String(existingHeader[0] || '').trim() !== header[0]) {
      throw new Error(`${title} already exists with an unexpected header. It was left unchanged; use a new golf tab or migrate it explicitly.`);
    }
  }));
}

async function readRows(sheets, spreadsheetId, title) {
  const response = await sheets.spreadsheets.values.get({ spreadsheetId, range: `${title}!A:Z` });
  return response.data.values || [];
}

async function cancelOtherActiveRounds(
  sheets,
  spreadsheetId,
  owner,
  exceptRoundId
) {
  const rows = await readRows(sheets, spreadsheetId, ROUNDS_TAB);
  const now = new Date().toISOString();
  const updates = [];

  rows.slice(1).forEach((row, index) => {
    const roundId = String(row[0] || '');
    const rowOwner = String(row[1] || '');
    const status = String(row[2] || '').toLowerCase();

    if (
      !roundId ||
      roundId === String(exceptRoundId) ||
      rowOwner !== String(owner || '') ||
      status !== 'active'
    ) {
      return;
    }

    let previousRound;

    try {
      previousRound = JSON.parse(row[8] || '{}');
    } catch {
      previousRound = {};
    }

    const cancelledRound = {
      ...previousRound,
      status: 'cancelled',
      cancelledAt: now,
      updatedAt: now,
    };

    updates.push({
      range: `${ROUNDS_TAB}!A${index + 2}:I${index + 2}`,
      values: [[
        roundId,
        rowOwner,
        'cancelled',
        row[3] || '',
        row[4] || '',
        row[5] || '',
        now,
        row[7] || '',
        JSON.stringify(cancelledRound),
      ]],
    });
  });

  if (updates.length) {
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId,
      requestBody: {
        valueInputOption: 'RAW',
        data: updates,
      },
    });
  }
}

async function upsertRound(sheets, spreadsheetId, owner, round) {
  await ensureTabs(sheets, spreadsheetId, [[ROUNDS_TAB, ROUNDS_HEADER]]);

  if (round.status === 'active') {
    await cancelOtherActiveRounds(
      sheets,
      spreadsheetId,
      owner,
      round.id
    );
  }
  const rows = await readRows(sheets, spreadsheetId, ROUNDS_TAB);
  const data = rows.slice(1);
  const serialized = JSON.stringify(round);
  const values = [[
    round.id,
    owner || '',
    round.status || 'active',
    round.courseId || 'custom',
    round.courseName || 'Custom course',
    round.createdAt || '',
    round.updatedAt || new Date().toISOString(),
    round.completedAt || '',
    serialized,
  ]];
  const existingIndex = data.findIndex(row => String(row[0] || '') === String(round.id));
  if (existingIndex >= 0) {
    const rowNumber = existingIndex + 2;
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${ROUNDS_TAB}!A${rowNumber}:I${rowNumber}`,
      valueInputOption: 'RAW',
      requestBody: { values },
    });
  } else {
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: ROUNDS_TAB,
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values },
    });
  }
}

async function upsertManyById(sheets, spreadsheetId, title, rows) {
  const existing = await readRows(sheets, spreadsheetId, title);
  const rowById = new Map(existing.slice(1).map((row, index) => [String(row[0] || ''), index + 2]));
  const updates = [];
  const additions = [];
  rows.forEach(values => {
    const rowNumber = rowById.get(String(values[0]));
    if (rowNumber) {
      updates.push({ range: `${title}!A${rowNumber}:${columnName(values.length - 1)}${rowNumber}`, values: [values] });
    } else {
      additions.push(values);
    }
  });
  if (updates.length) {
    await sheets.spreadsheets.values.batchUpdate({ spreadsheetId, requestBody: { valueInputOption: 'RAW', data: updates } });
  }
  if (additions.length) {
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: title,
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values: additions },
    });
  }
}

async function saveLayout(sheets, spreadsheetId, owner, layout) {
  if (!layout?.tees || !layout?.courses) return;
  await ensureTabs(sheets, spreadsheetId);
  const stamp = layout.updatedAt || new Date().toISOString();
  await upsertManyById(sheets, spreadsheetId, 'GolfTees', (layout.tees || []).map(tee => [
    tee.id, tee.name, tee.x, tee.y, tee.surface, tee.ballType, (tee.permittedCupIds || []).join(','), tee.active === false ? 'false' : 'true', stamp,
  ]));
  await upsertManyById(sheets, spreadsheetId, 'GolfHoles', (layout.cups || []).map(cup => [
    cup.id, cup.name, cup.x, cup.y, cup.tier, cup.verified ? 'true' : 'false', stamp,
  ]));
  await upsertManyById(sheets, spreadsheetId, 'GolfCourses', (layout.courses || []).map(course => [course.id, course.name, course.description || '', stamp]));
  const courseHoles = [];
  for (const course of layout.courses || []) {
    for (let index = 0; index < (course.holes || []).length; index += 1) {
      const item = course.holes[index];
      const [teeId, cupId] = Array.isArray(item) ? item : [item.teeId, item.cupId];
      courseHoles.push([
        `${course.id}:${index + 1}`, course.id, index + 1, teeId, cupId, item.par || 3, stamp,
      ]);
    }
  }
  await upsertManyById(sheets, spreadsheetId, 'GolfCourseHoles', courseHoles);
  // This per-owner snapshot lets the app restore an exact editable layout
  // without using row numbers or inferring state from deleted/archived rows.
  await upsertManyById(sheets, spreadsheetId, 'GolfSettings', [[
    `Layout:${owner || 'local-player'}`, JSON.stringify({ ...layout, updatedAt: stamp }),
  ]]);
}

async function layoutForOwner(sheets, spreadsheetId, owner) {
  try {
    const rows = await readRows(sheets, spreadsheetId, 'GolfSettings');
    const row = rows.slice(1).find(item => String(item[0] || '') === `Layout:${owner || 'local-player'}`);
    return row?.[1] ? JSON.parse(row[1]) : null;
  } catch (error) {
    if (error?.code === 400 || error?.code === 404 || error?.response?.status === 400 || error?.response?.status === 404) return null;
    throw error;
  }
}

async function safeReadRows(sheets, spreadsheetId, title) {
  try {
    return await readRows(sheets, spreadsheetId, title);
  } catch (error) {
    if (
      error?.code === 400 ||
      error?.code === 404 ||
      error?.response?.status === 400 ||
      error?.response?.status === 404
    ) {
      return [];
    }

    throw error;
  }
}

function parseSheetBoolean(value, defaultValue = true) {
  if (value === undefined || value === null || value === '') {
    return defaultValue;
  }

  return String(value).trim().toLowerCase() !== 'false';
}

function parsePermittedCupIds(value) {
  return String(value || '')
    .split(',')
    .map(id => id.trim())
    .filter(Boolean);
}

async function layoutFromTabs(sheets, spreadsheetId, owner) {
  const [
    snapshot,
    teeRows,
    cupRows,
    courseRows,
    courseHoleRows,
  ] = await Promise.all([
    layoutForOwner(sheets, spreadsheetId, owner),
    safeReadRows(sheets, spreadsheetId, 'GolfTees'),
    safeReadRows(sheets, spreadsheetId, 'GolfHoles'),
    safeReadRows(sheets, spreadsheetId, 'GolfCourses'),
    safeReadRows(sheets, spreadsheetId, 'GolfCourseHoles'),
  ]);

  const sheetTees = teeRows.slice(1);
  const sheetCups = cupRows.slice(1);
  const sheetCourses = courseRows.slice(1);
  const sheetCourseHoles = courseHoleRows.slice(1);

  const tees = sheetTees.length
    ? sheetTees
        .filter(row => row[0])
        .map(row => ({
          id: String(row[0]),
          name: String(row[1] || row[0]),
          x: Number(row[2]),
          y: Number(row[3]),
          surface: String(row[4] || ''),
          ballType: String(row[5] || 'both'),
          permittedCupIds: parsePermittedCupIds(row[6]),
          active: parseSheetBoolean(row[7], true),
          distanceSource: 'estimated',
        }))
        .filter(tee =>
          Number.isFinite(tee.x) &&
          Number.isFinite(tee.y)
        )
    : snapshot?.tees || [];

  const cups = sheetCups.length
    ? sheetCups
        .filter(row => row[0])
        .map(row => ({
          id: String(row[0]),
          name: String(row[1] || row[0]),
          x: Number(row[2]),
          y: Number(row[3]),
          tier: String(row[4] || 'lower'),
          verified: parseSheetBoolean(row[5], false),
        }))
        .filter(cup =>
          Number.isFinite(cup.x) &&
          Number.isFinite(cup.y)
        )
    : snapshot?.cups || [];

  const courseHoleMap = new Map();

  sheetCourseHoles
    .filter(row => row[1] && row[3] && row[4])
    .forEach(row => {
      const courseId = String(row[1]);

      if (!courseHoleMap.has(courseId)) {
        courseHoleMap.set(courseId, []);
      }

      courseHoleMap.get(courseId).push({
        number: Number(row[2]) || 0,
        teeId: String(row[3]),
        cupId: String(row[4]),
        par: Number(row[5]) || 3,
      });
    });

  courseHoleMap.forEach(holes => {
    holes.sort((a, b) => a.number - b.number);
  });

  const courses = sheetCourses.length
    ? sheetCourses
        .filter(row => row[0])
        .map(row => ({
          id: String(row[0]),
          name: String(row[1] || row[0]),
          description: String(row[2] || ''),
          holes: (courseHoleMap.get(String(row[0])) || []).map(hole => ({
            teeId: hole.teeId,
            cupId: hole.cupId,
            par: hole.par,
          })),
        }))
    : snapshot?.courses || [];

  return {
    tees,
    cups,
    courses,
    updatedAt: new Date().toISOString(),
  };
}

async function roundsForOwner(sheets, spreadsheetId, owner) {
  let rows;
  try {
    rows = await readRows(sheets, spreadsheetId, ROUNDS_TAB);
  } catch (error) {
    // A first visit before setup is a normal local-first state.
    if (error?.code === 400 || error?.code === 404 || error?.response?.status === 400 || error?.response?.status === 404) return [];
    throw error;
  }
  return rows.slice(1)
    .filter(row => !owner || String(row[1] || '') === String(owner))
    .map(row => {
      try { return JSON.parse(row[8]); } catch { return null; }
    })
    .filter(Boolean);
}

export default async function handler(req, res) {
  try {
    const { sheets, spreadsheetId } = await client();
    if (req.method === 'GET') {
      const [rounds, layout] = await Promise.all([
  roundsForOwner(sheets, spreadsheetId, req.query.owner),
  layoutFromTabs(sheets, spreadsheetId, req.query.owner),
]);
      return res.status(200).json({ rounds, layout });
    }
    if (req.method === 'POST') {
      const { action, owner, round, layout } = req.body || {};
      if (action === 'initialize') {
  await ensureTabs(sheets, spreadsheetId);

  const [tees, cups, courses] = await Promise.all([
    safeReadRows(sheets, spreadsheetId, 'GolfTees'),
    safeReadRows(sheets, spreadsheetId, 'GolfHoles'),
    safeReadRows(sheets, spreadsheetId, 'GolfCourses'),
  ]);

  const hasExistingLayout =
    tees.length > 1 ||
    cups.length > 1 ||
    courses.length > 1;

  // Seed the initial layout only when the layout tabs are empty.
  // Never overwrite an existing Google Sheets layout during initialization.
  if (!hasExistingLayout && layout) {
    await saveLayout(sheets, spreadsheetId, owner, layout);
  }

  return res.status(200).json({
    ok: true,
    initializedWithDefaults: !hasExistingLayout,
    tabs: SETUP_TABS.map(([title]) => title),
  });
}
      if (action === 'saveRound' && round?.id) {
        await upsertRound(sheets, spreadsheetId, owner, round);
        return res.status(200).json({ ok: true });
      }
      if (action === 'saveLayout' && layout) {
        await saveLayout(sheets, spreadsheetId, owner, layout);
        return res.status(200).json({ ok: true });
      }
      return res.status(400).json({ error: 'Expected initialize, saveLayout, or saveRound with a stable round id.' });
    }
    res.setHeader('Allow', ['GET', 'POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  } catch (error) {
    console.error('API /api/golf error:', error);
    return res.status(500).json({ error: error.message || String(error) });
  }
}
