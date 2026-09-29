/**
 * PERCONA REBELS world high-score table.
 *
 * A Google Apps Script web app bound to a Google Sheet. The game (a static page) calls it:
 *   GET  <exec URL>?action=top               -> { ok: true, top: [{ n, s, w }, ...] }                 (best 10 shown)
 *   GET  <exec URL>?action=start             -> { ok: true, ticket }                                  (when a game starts)
 *   POST <exec URL>?action=submit  (text)    -> { ok: true, rank, top, pending } or { ok: false, error }
 *        body: {"x":"<ticket>","n":"AAA","s":12340,"w":7,"t":415,"k":88,"v":2}
 *              ticket, initials, score, wave, seconds played, kills, game version
 *
 * Anti-cheat, in layers:
 *   1. Every submission needs a one-time ticket from action=start. The script times the run itself, so a score can't
 *      claim more play time than really passed since the ticket was issued, and each ticket is good for one score.
 *   2. The numbers must fit the game's rules: points per kill, kills per wave and per second, seconds per wave.
 *   3. Scores above REVIEW_ABOVE are stored with the "approved" box unticked and stay hidden until someone ticks it.
 *      Untick any row to hide it, or delete it.
 * None of this stops a patient cheater who plays along in real time with a doctored client; that's what 3 is for.
 *
 * Stored per score: time, initials, score, wave, seconds, kills, version, approved. Nothing else: Apps Script never
 * sees players' IP addresses, and the game sends no names or ids. The spreadsheet itself can stay private.
 * Setup and redeploying: see SETUP.md next to this file.
 */

const SHEET_NAME = "scores";
const HEADER = ["time", "initials", "score", "wave", "seconds", "kills", "version", "approved"];
const REVIEW_ABOVE = 100000;     // scores above this wait for a tick in the "approved" column
const KEEP_ROWS = 2000;          // the sheet is trimmed to the best KEEP_ROWS scores
const CACHE_SECONDS = 20;        // how long the top 10 is cached between reads
const TICKET_HOURS = 6;          // a ticket expires after this long (the cache maximum)
const MAX_STARTS_PER_MINUTE = 300;
const MAX_SUBMITS_PER_MINUTE = 60;
// Initials that are never accepted (an arcade tradition). Compared after removing anything that isn't a letter.
const BLOCKED = ["ASS", "CUM", "CNT", "DIK", "DIC", "FAG", "FCK", "FUC", "FUK", "FUX", "KKK", "KYS", "NAZ", "NIG", "PIS", "SEX", "SHT", "TIT", "XXX"];

function doGet(e) {
  const action = (e && e.parameter && e.parameter.action) || "top";
  const cache = CacheService.getScriptCache();
  if (action === "start") {
    if (!underLimit_(cache, "starts", MAX_STARTS_PER_MINUTE)) return json_({ ok: false, error: "busy" });
    const ticket = Utilities.getUuid();
    cache.put("tk:" + ticket, String(Date.now()), TICKET_HOURS * 3600);
    return json_({ ok: true, ticket: ticket });
  }
  if (action !== "top") return json_({ ok: false, error: "unknown action" });
  const hit = cache.get("top");
  if (hit) return json_({ ok: true, top: JSON.parse(hit) });
  const top = top_(rows_());
  cache.put("top", JSON.stringify(top), CACHE_SECONDS);
  return json_({ ok: true, top: top });
}

function doPost(e) {
  let d;
  try { d = JSON.parse((e && e.postData && e.postData.contents) || "{}"); } catch (err) { return json_({ ok: false, error: "bad request" }); }
  const entry = check_(d);
  if (typeof entry === "string") return json_({ ok: false, error: entry });

  const cache = CacheService.getScriptCache();
  if (!underLimit_(cache, "submits", MAX_SUBMITS_PER_MINUTE)) return json_({ ok: false, error: "busy" });
  const key = "tk:" + String(d.x || "").slice(0, 64);
  const started = Number(cache.get(key));
  if (!started) return json_({ ok: false, error: "ticket" });            // unknown, expired or already used
  cache.remove(key);                                                        // one score per ticket
  const elapsed = (Date.now() - started) / 1000;
  if (entry.t > elapsed + 10) return json_({ ok: false, error: "ticket" }); // claims more play time than really passed

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sheet = sheet_();
    const pending = entry.s > REVIEW_ABOVE;
    sheet.appendRow([new Date(), entry.n, entry.s, entry.w, entry.t, entry.k, entry.v, !pending]);
    checkbox_(sheet.getRange(sheet.getLastRow(), HEADER.length));
    const rows = rows_();
    // rank among the scores people can see (ties share a rank); a pending score is told where it would land
    const rank = 1 + rows.filter(function (r) { return r.s > entry.s; }).length;
    const top = top_(rows);
    cache.put("top", JSON.stringify(top), CACHE_SECONDS);
    if (sheet.getLastRow() > KEEP_ROWS + 100) trim_(sheet);
    return json_({ ok: true, rank: rank, top: top, pending: pending });
  } finally {
    lock.releaseLock();
  }
}

/** Validates one submission against the game's rules. Returns a clean entry, or a short error string. Pure. */
function check_(d) {
  if (!d || typeof d !== "object") return "bad request";
  const n = String(d.n || "").toUpperCase();
  if (!/^[A-Z0-9.!\- ]{3}$/.test(n) || !n.trim()) return "initials";
  if (BLOCKED.indexOf(n.replace(/[^A-Z]/g, "")) >= 0) return "initials";
  const s = Number(d.s), w = Number(d.w), t = Number(d.t), k = Number(d.k), v = Number(d.v || 0);
  if (!Number.isInteger(s) || s <= 0 || s > 5000000) return "score";
  if (s % 10 !== 0) return "score";                            // every way to score in the game gives multiples of 10
  if (!Number.isInteger(w) || w < 1 || w > 500) return "wave";
  if (!isFinite(t) || t < 10 || t > TICKET_HOURS * 3600) return "time";
  if (!Number.isInteger(k) || k < 1) return "kills";
  if (t < 15 * (w - 1)) return "implausible";                  // a wave takes more than 15 seconds
  if (k > 70 * w || k > 3 * t) return "implausible";           // at most ~60 enemies a wave, and not 3 a second
  if (s > 1600 * k + 6000 * w + 3000) return "implausible";    // generous points per kill, plus boss and wave bonuses
  return { n: n, s: s, w: w, t: Math.round(t), k: k, v: v };
}

function underLimit_(cache, name, max) {
  const key = name + ":" + Math.floor(Date.now() / 60000);
  const count = Number(cache.get(key) || 0);
  if (count >= max) return false;
  cache.put(key, String(count + 1), 120);
  return true;
}

/** Visible rows: approved, or from before the approved column existed. */
function rows_() {
  const values = sheet_().getDataRange().getValues();
  const out = [];
  for (let i = 1; i < values.length; i++) {                   // row 0 is the header
    const r = values[i];
    const s = Number(r[2]);
    const approved = r[7] === true || r[7] === "" || r[7] === undefined || String(r[7]).toUpperCase() === "TRUE";
    if (r[1] && s > 0 && approved) out.push({ n: String(r[1]).slice(0, 3), s: s, w: Number(r[3]) || 0 });
  }
  return out;
}

function top_(rows) {
  return rows.slice().sort(function (a, b) { return b.s - a.s; }).slice(0, 10);
}

function trim_(sheet) {
  const values = sheet.getDataRange().getValues();
  const body = values.slice(1).sort(function (a, b) { return Number(b[2]) - Number(a[2]); }).slice(0, KEEP_ROWS);
  sheet.clearContents();
  sheet.getRange(1, 1, 1, HEADER.length).setValues([HEADER]);
  if (body.length) {
    sheet.getRange(2, 1, body.length, HEADER.length).setValues(body.map(function (r) { const row = r.slice(0, HEADER.length); while (row.length < HEADER.length) row.push(""); return row; }));
    checkbox_(sheet.getRange(2, HEADER.length, body.length, 1));
  }
}

function sheet_() {
  const book = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = book.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = book.insertSheet(SHEET_NAME);
    sheet.appendRow(HEADER);
    sheet.setFrozenRows(1);
  } else if (sheet.getRange(1, HEADER.length).getValue() !== HEADER[HEADER.length - 1]) {
    sheet.getRange(1, 1, 1, HEADER.length).setValues([HEADER]);   // add the "approved" column to an older sheet
  }
  return sheet;
}

/** Shows a column as tick boxes without changing the values in it. */
function checkbox_(range) {
  range.setDataValidation(SpreadsheetApp.newDataValidation().requireCheckbox().build());
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/**
 * Run once from the editor (Run ▶ setup): creates or upgrades the sheet and grants permissions before deploying.
 * Scores saved before the "approved" column existed are approved if they're at or below REVIEW_ABOVE and left
 * unticked (hidden) if they're above it, so they get the same review as new ones.
 */
function setup() {
  const sheet = sheet_();
  const last = sheet.getLastRow();
  if (last < 2) return;
  const range = sheet.getRange(2, HEADER.length, last - 1, 1);
  const scores = sheet.getRange(2, 3, last - 1, 1).getValues();
  const flags = range.getValues().map(function (r, i) { return [r[0] === "" ? Number(scores[i][0]) <= REVIEW_ABOVE : r[0]]; });
  range.setValues(flags);
  checkbox_(range);
}
