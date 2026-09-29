/**
 * PERCONA REBELS world high-score table.
 *
 * A Google Apps Script web app bound to a Google Sheet. The game (a static page on GitHub Pages) calls it:
 *   GET  <exec URL>?action=top              -> { ok: true, top: [{ n, s, w }, ...] }        (best 10)
 *   POST <exec URL>?action=submit  (text)   -> { ok: true, rank, top } or { ok: false, error }
 *        body: {"n":"AAA","s":12340,"w":7,"t":415,"k":88,"v":1}   initials, score, wave, seconds played, kills
 *
 * Stored per score: time, initials, score, wave, seconds, kills, version. Nothing else: Apps Script never sees the
 * player's IP address, and the game sends no names or ids. The spreadsheet itself can stay private.
 * Moderation: delete a row in the "scores" sheet; it drops out of the table within CACHE_SECONDS.
 * Setup: see SETUP.md next to this file.
 */

const SHEET_NAME = "scores";
const KEEP_ROWS = 2000;          // the sheet is trimmed to the best KEEP_ROWS scores
const CACHE_SECONDS = 20;        // how long the top 10 is cached between reads
const MAX_PER_MINUTE = 30;       // submissions accepted per minute, across all players
// Initials that are never shown (an arcade tradition). Compared after removing anything that isn't a letter.
const BLOCKED = ["ASS", "CUM", "CNT", "DIK", "DIC", "FAG", "FCK", "FUC", "FUK", "FUX", "KKK", "KYS", "NAZ", "NIG", "PIS", "SEX", "SHT", "TIT", "XXX"];

function doGet(e) {
  const action = (e && e.parameter && e.parameter.action) || "top";
  if (action !== "top") return json_({ ok: false, error: "unknown action" });
  const cache = CacheService.getScriptCache();
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
  const minute = "rate:" + Math.floor(Date.now() / 60000);
  const count = Number(cache.get(minute) || 0);
  if (count >= MAX_PER_MINUTE) return json_({ ok: false, error: "busy" });
  cache.put(minute, String(count + 1), 120);
  const dup = "dup:" + entry.n + ":" + entry.s + ":" + entry.w;
  if (cache.get(dup)) return json_({ ok: false, error: "duplicate" });
  cache.put(dup, "1", 300);

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sheet = sheet_();
    sheet.appendRow([new Date(), entry.n, entry.s, entry.w, entry.t, entry.k, entry.v]);
    const rows = rows_();
    // rank = 1 + number of strictly better scores (ties share a rank)
    const rank = 1 + rows.filter(function (r) { return r.s > entry.s; }).length;
    const top = top_(rows);
    cache.put("top", JSON.stringify(top), CACHE_SECONDS);
    if (rows.length > KEEP_ROWS + 100) trim_(sheet);
    return json_({ ok: true, rank: rank, top: top });
  } finally {
    lock.releaseLock();
  }
}

/** Validates one submission. Returns a clean entry, or a short error string. Pure: no Apps Script services. */
function check_(d) {
  if (!d || typeof d !== "object") return "bad request";
  const n = String(d.n || "").toUpperCase();
  if (!/^[A-Z0-9.!\- ]{3}$/.test(n) || !n.trim()) return "initials";
  if (BLOCKED.indexOf(n.replace(/[^A-Z]/g, "")) >= 0) return "initials";
  const s = Number(d.s), w = Number(d.w), t = Number(d.t), k = Number(d.k || 0), v = Number(d.v || 0);
  if (!Number.isInteger(s) || s <= 0 || s > 5000000) return "score";
  if (s % 10 !== 0) return "score";                            // every way to score in the game gives multiples of 10
  if (!Number.isInteger(w) || w < 1 || w > 500) return "wave";
  if (!isFinite(t) || t < 10 || t > 6 * 3600) return "time";
  if (!Number.isInteger(k) || k < 0 || k > 100000) return "kills";
  if (s > 900 * t + 3000) return "implausible";                // faster than any real player
  if (t < (w - 1) * 12) return "implausible";                  // a wave takes more than 12 seconds
  if (s > 60000 * w) return "implausible";                     // more points than a wave can give
  return { n: n, s: s, w: w, t: Math.round(t), k: k, v: v };
}

function rows_() {
  const values = sheet_().getDataRange().getValues();
  const out = [];
  for (let i = 1; i < values.length; i++) {                   // row 0 is the header
    const r = values[i];
    const s = Number(r[2]);
    if (r[1] && s > 0) out.push({ n: String(r[1]).slice(0, 3), s: s, w: Number(r[3]) || 0 });
  }
  return out;
}

function top_(rows) {
  return rows.slice().sort(function (a, b) { return b.s - a.s; }).slice(0, 10);
}

function trim_(sheet) {
  const values = sheet.getDataRange().getValues();
  const header = values[0];
  const body = values.slice(1).sort(function (a, b) { return Number(b[2]) - Number(a[2]); }).slice(0, KEEP_ROWS);
  sheet.clearContents();
  sheet.getRange(1, 1, 1, header.length).setValues([header]);
  if (body.length) sheet.getRange(2, 1, body.length, header.length).setValues(body);
}

function sheet_() {
  const book = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = book.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = book.insertSheet(SHEET_NAME);
    sheet.appendRow(["time", "initials", "score", "wave", "seconds", "kills", "version"]);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/** Run once from the editor (Run ▶ setup) to create the sheet and grant permissions before deploying. */
function setup() {
  sheet_();
}
