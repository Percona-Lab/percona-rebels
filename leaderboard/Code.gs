/**
 * PERCONA REBELS world high-score table.
 *
 * A Google Apps Script web app bound to a Google Sheet. The game (a static page) calls it:
 *   GET  <exec URL>?action=top               -> { ok: true, top: [{ n, s, w }, ...] }                 (best 10 shown)
 *   GET  <exec URL>?action=start             -> { ok: true, ticket }                                  (when a game starts)
 *   Add &event=<id> to either for an event board (rows in the "events" tab). Competing on an event board needs a play
 *   code, &code=<digits>: a raffle ticket number or a Percona Community sign-up code. The event's ticket then carries
 *   the event and the code, so its score lands on that board only. A wrong code gets { ok: false, error: "code" }; if
 *   a sign-up code can't be checked with HubSpot right now, error "verify".
 *   POST <exec URL>?action=submit  (text)    -> { ok: true, rank, top, pending } or { ok: false, error }
 *        body: {"x":"<ticket>","n":"AAA","s":12340,"w":7,"t":415,"k":88,"v":2}
 *              ticket, initials, score, wave, seconds played, kills, game version
 *
 * Anti-cheat, in layers:
 *   1. Every submission needs a one-time ticket from action=start. The script times the run itself, so a score can't
 *      claim more play time than really passed since the ticket was issued, and each ticket is good for one score.
 *   2. The numbers must fit the game's rules: points per kill, kills per wave and per second, seconds per wave.
 *   3. Scores that are possible but unlike real play (SUSPECT_* below, measured against the game's autopilot over
 *      hundreds of games) arrive unticked, hidden, with the reason in the "why" column. Tick the box to show one.
 *   4. Everything else goes live at once, with its "approved" box ticked. Untick a row to hide it, or delete it.
 *      To hold big scores for review too, set REVIEW_ABOVE to a number.
 * None of this stops a patient cheater who plays along in real time with a doctored client; that's what 4 is for, and
 * at events, a playoff of the top few at the booth before prizes go out.
 *
 * Event boards: one row per event in the "events" tab, columns found by their header (see EVENTS_HEADER and SETUP.md).
 * Anyone can view an event board; competing needs a play code: a number from the event's raffle ticket roll (the
 * "tickets" ranges) or, with "signup codes" ticked, a Percona Community sign-up code: the HubSpot contact id in the
 * welcome email. Sign-up codes are checked with HubSpot (does that contact exist?), which needs a read-only HubSpot
 * token in the script properties as HUBSPOT_TOKEN; without one, sign-up codes are off. Nothing about the contact is
 * read or kept: codes hold no personal data here, and winners prove one is theirs with the ticket or the email. Event
 * scores never show on the world table: to move one there, clear its "event" cell. "closes" ends competing at that
 * time; "prize" is a line the game shows ("WINNERS AT THE BOOTH 15:00"); qr and logo are the sign-up link (shown as a
 * QR code) and the event's logo. The "winners" tab lists each event's best score per code.
 *
 * Stored per score: time, initials, score, wave, seconds, kills, version, approved, event, code, proof, why. Nothing
 * else: Apps Script never sees players' IP addresses, and the game sends no names. The spreadsheet can stay private.
 * Setup and redeploying: see SETUP.md next to this file.
 */

const SHEET_NAME = "scores";
const HEADER = ["time", "initials", "score", "wave", "seconds", "kills", "version", "approved", "event", "code", "proof", "why"];
const FORMATS = ["yyyy-mm-dd hh:mm:ss", "@", "0", "0", "0", "0", "0", "General", "@", "@", "@", "@"];
const APPROVED_COL = 8;          // 1-based column of the "approved" tick box
const EVENTS_SHEET = "events";
const EVENTS_HEADER = ["event", "name", "open", "qr", "logo", "tickets", "signup codes", "prize", "closes"];
const COMMUNITY_SIGNUP = "https://percona.community/contribute/newsletter/";
const WINNERS_SHEET = "winners";
const WINNERS_HEADER = ["event", "place", "initials", "score", "wave", "code", "proof", "time", "notes"];   // notes: the only column to type in
const WINNERS_PER_EVENT = 10;
// Suspicion lines. The game's autopilot, over 300 games (2026-10-13), never went past: 26.5 s a wave on average,
// 1.66 kills a second, 891 points a kill, 1,024 points a second (scoring 449,530 at best, champion level). The lines
// sit well beyond that, so a strong human doesn't trip them.
const SUSPECT_SECS_PER_WAVE = 18;      // average, from wave 4
const SUSPECT_KILLS_PER_SEC = 2.2;     // over a game of a minute or more
const SUSPECT_POINTS_PER_KILL = 1250;  // over 40 kills or more
const SUSPECT_POINTS_PER_SEC = 1400;   // over a game of a minute or more
const SUSPECT_ABOVE_BEST = 2.5;        // times the board's best so far, once it has 10 scores
const PGCONFEU_LOGO = "https://2026.pgconf.eu/static/2494bba3/img/logo/logo.svg";
const REVIEW_ABOVE = Infinity;   // no review: every score shows at once (set e.g. 100000 to hold bigger ones back)
const KEEP_ROWS = 2000;          // the sheet is trimmed to the best KEEP_ROWS scores
const CACHE_SECONDS = 20;        // how long the top 10 is cached between reads
const TICKET_HOURS = 6;          // a ticket expires after this long (the cache maximum)
const MAX_STARTS_PER_MINUTE = 300;
const MAX_SUBMITS_PER_MINUTE = 60;
const HUBSPOT_CONTACT = "https://api.hubapi.com/crm/v3/objects/contacts/";   // + id: 200 if the contact exists, 404 if not
// Initials that are never accepted (an arcade tradition). Compared after removing anything that isn't a letter.
const BLOCKED = ["ASS", "CUM", "CNT", "DIK", "DIC", "FAG", "FCK", "FUC", "FUK", "FUX", "KKK", "KYS", "NAZ", "NIG", "PIS", "SEX", "SHT", "TIT", "XXX"];

function doGet(e) {
  const p = (e && e.parameter) || {};
  const action = p.action || "top";
  const cache = CacheService.getScriptCache();
  let ev = null;
  if (p.event) {
    ev = events_()[String(p.event).toLowerCase().trim()];
    if (!ev) return json_({ ok: false, error: "event" });
  }
  if (action === "start") {
    let code = null;
    if (ev) {
      if (!live_(ev)) return json_({ ok: false, error: "closed" });
      code = code_(ev, p.code);
      if (typeof code === "string") return json_({ ok: false, error: code });
    }
    if (!underLimit_(cache, "starts", MAX_STARTS_PER_MINUTE)) return json_({ ok: false, error: "busy" });
    const ticket = Utilities.getUuid();
    cache.put("tk:" + ticket, JSON.stringify({ t: Date.now(), e: ev ? ev.id : "", c: code ? code.code : "", p: code ? code.proof : "" }), TICKET_HOURS * 3600);
    return json_(code ? { ok: true, ticket: ticket, proof: code.proof } : { ok: true, ticket: ticket });
  }
  if (action !== "top") return json_({ ok: false, error: "unknown action" });
  const info = ev ? { id: ev.id, name: ev.name, open: live_(ev), qr: ev.qr, logo: ev.logo, prize: ev.prize, codes: { tickets: ev.tickets.length > 0, signup: ev.signup && !!hubspotToken_() } } : undefined;
  const board = "top:" + (ev ? ev.id : "*");
  const hit = cache.get(board);
  if (hit) return json_({ ok: true, top: JSON.parse(hit), event: info });
  const top = top_(rows_(ev ? ev.id : ""));
  cache.put(board, JSON.stringify(top), CACHE_SECONDS);
  return json_({ ok: true, top: top, event: info });
}

function doPost(e) {
  let d;
  try { d = JSON.parse((e && e.postData && e.postData.contents) || "{}"); } catch (err) { return json_({ ok: false, error: "bad request" }); }
  const entry = check_(d);
  if (typeof entry === "string") return json_({ ok: false, error: entry });

  const cache = CacheService.getScriptCache();
  if (!underLimit_(cache, "submits", MAX_SUBMITS_PER_MINUTE)) return json_({ ok: false, error: "busy" });
  const key = "tk:" + String(d.x || "").slice(0, 64);
  const ticket = ticket_(cache.get(key));
  if (!ticket) return json_({ ok: false, error: "ticket" });             // unknown, expired or already used
  cache.remove(key);                                                        // one score per ticket
  const started = ticket.t, event = ticket.e, code = ticket.c, proof = ticket.p;
  const elapsed = (Date.now() - started) / 1000;
  if (entry.t > elapsed + 10) return json_({ ok: false, error: "ticket" }); // claims more play time than really passed

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sheet = sheet_();
    // two games running at once on one code: a script, or a code being passed around
    const runKey = "run:" + event + ":" + code, prev = code ? Number(cache.get(runKey) || 0) : 0;
    const why = suspect_(entry, rows_(event), code && prev && started < prev - 5000 ? code : "");
    const pending = entry.s > REVIEW_ABOVE || why !== "";
    if (code) cache.put(runKey, String(Date.now()), TICKET_HOURS * 3600);
    // explicit formats first: a date-formatted cell would hand numbers back as dates, and "007" would become 7
    const row = sheet.getRange(sheet.getLastRow() + 1, 1, 1, HEADER.length);
    row.setNumberFormats([FORMATS]);
    row.setValues([[new Date(), entry.n, entry.s, entry.w, entry.t, entry.k, entry.v, !pending, event, code, proof, why]]);
    checkbox_(sheet.getRange(row.getRow(), APPROVED_COL));
    const rows = rows_(event);
    // rank among the scores people can see (ties share a rank); a pending score is told where it would land
    const rank = 1 + rows.filter(function (r) { return r.s > entry.s; }).length;
    const top = top_(rows);
    cache.put("top:" + (event || "*"), JSON.stringify(top), CACHE_SECONDS);
    if (sheet.getLastRow() > KEEP_ROWS + 100) trim_(sheet);
    if (event) winners();
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

/** A ticket from the cache: {t: start time, e: event id, c: play code, p: proof}. The first tickets were plain start times. */
function ticket_(raw) {
  if (!raw) return null;
  let v; try { v = JSON.parse(raw); } catch (err) { return null; }
  if (typeof v === "number") return v > 0 ? { t: v, e: "", c: "", p: "" } : null;
  return v && v.t > 0 ? { t: Number(v.t), e: String(v.e || ""), c: String(v.c || ""), p: String(v.p || "") } : null;
}

/**
 * The events tab as { id: { id, name, open, qr, logo, tickets, signup, prize, closes } }. Columns are found by their
 * header, so they can be in any order and extra columns are ignored. Links that aren't https are dropped.
 */
function events_() {
  const out = {};
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(EVENTS_SHEET);
  if (!sheet) return out;
  const values = sheet.getDataRange().getValues();
  const col = {};
  (values[0] || []).forEach(function (h, i) { col[String(h).toLowerCase().trim()] = i; });
  const get = function (r, name) { return col[name] === undefined || r[col[name]] === undefined ? "" : r[col[name]]; };
  const yes = function (v) { return v === true || String(v).toUpperCase() === "TRUE"; };
  for (let i = 1; i < values.length; i++) {
    const r = values[i], id = String(get(r, "event")).toLowerCase().trim();
    if (!/^[a-z0-9-]{1,32}$/.test(id)) continue;
    out[id] = {
      id: id, name: String(get(r, "name") || id).slice(0, 24), open: yes(get(r, "open")), qr: https_(get(r, "qr")), logo: https_(get(r, "logo")),
      tickets: ranges_(get(r, "tickets")), signup: yes(get(r, "signup codes")), prize: String(get(r, "prize")).trim().slice(0, 40), closes: when_(get(r, "closes")),
    };
  }
  return out;
}

/** Ticket ranges from a cell like "457001-458000, 460001-460500" (single numbers too): [[from, to], ...]. */
function ranges_(v) {
  return String(v || "").split(/[,;\n]/).map(function (part) {
    const m = part.replace(/\s/g, "").match(/^(\d{1,15})(?:-(\d{1,15}))?$/);
    if (!m) return null;
    const a = Number(m[1]), b = Number(m[2] || m[1]);
    return [Math.min(a, b), Math.max(a, b)];
  }).filter(Boolean);
}

/** A time from a cell (a date-time cell, or text like "2026-10-23 14:45" in the script's time zone) in ms, or 0. */
function when_(v) {
  if (v instanceof Date) return v.getTime() || 0;
  const s = String(v || "").trim();
  if (!s) return 0;
  const t = new Date(s.replace(" ", "T")).getTime();
  return isFinite(t) ? t : 0;
}

/** An https link from a cell, or "". */
function https_(v) {
  const s = String(v || "").trim();
  return /^https:\/\/[^\s"'<>]{1,500}$/.test(s) ? s : "";
}

/** A number from a cell, even if the sheet formatted it as a date (Sheets then returns a Date for it). */
function num_(v) {
  if (v instanceof Date) return Math.round((v.getTime() - new Date(1899, 11, 30).getTime()) / 86400000);
  return Number(v);
}

/** Visible rows on one board ("" = the world table): approved (or older than that column) and within the game's limits. */
function rows_(event) {
  const values = sheet_().getDataRange().getValues();
  const out = [];
  for (let i = 1; i < values.length; i++) {                   // row 0 is the header
    const r = values[i];
    const n = String(r[1] || "").toUpperCase().slice(0, 3), s = num_(r[2]), w = house_(r) && !(num_(r[3]) >= 1) ? 1 : num_(r[3]);
    const approved = r[7] === true || r[7] === "" || r[7] === undefined || String(r[7]).toUpperCase() === "TRUE";
    const sane = n.trim().length > 0 && Number.isInteger(s) && s > 0 && s <= 5000000 && Number.isInteger(w) && w >= 1 && w <= 500;
    const board = String(r[8] === undefined ? "" : r[8]).toLowerCase().trim();
    if (approved && sane && board === (event || "")) out.push({ n: n, s: s, w: w });
  }
  return out;
}

function top_(rows) {
  return rows.slice().sort(function (a, b) { return b.s - a.s; }).slice(0, 10);
}

/**
 * A play code for an event: { code, proof }, or the error "code" (not valid) or "verify" (HubSpot can't be asked right
 * now). A number on the event's ticket roll is a "ticket" (the winner shows the ticket). With sign-up codes on, another
 * number is an "email" code if HubSpot has a contact with that id (the Percona Community welcome email carries it; the
 * winner shows the email). Spaces and dashes are ignored, so are leading zeros.
 */
function code_(ev, raw) {
  const c = String(raw || "").replace(/[\s-]/g, "");
  if (!/^\d{1,15}$/.test(c)) return "code";
  const n = Number(c), code = String(n);
  if (ev.tickets.some(function (r) { return n >= r[0] && n <= r[1]; })) return { code: code, proof: "ticket" };
  if (!ev.signup || code.length < 5) return "code";
  const known = contact_(code);
  return known === true ? { code: code, proof: "email" } : known === false ? "code" : "verify";
}

function hubspotToken_() {
  return String(PropertiesService.getScriptProperties().getProperty("HUBSPOT_TOKEN") || "");
}

/** Whether HubSpot has a contact with this id: true, false, or null if it can't be asked. Answers are cached. */
function contact_(id) {
  const token = hubspotToken_();
  if (!token) return false;
  const cache = CacheService.getScriptCache(), hit = cache.get("hs:" + id);
  if (hit) return hit === "1";
  let status;
  try {
    status = UrlFetchApp.fetch(HUBSPOT_CONTACT + encodeURIComponent(id) + "?properties=hs_object_id", { headers: { Authorization: "Bearer " + token }, muteHttpExceptions: true }).getResponseCode();
  } catch (err) { return null; }
  if (status === 200) { cache.put("hs:" + id, "1", TICKET_HOURS * 3600); return true; }
  if (status === 404) { cache.put("hs:" + id, "0", 600); return false; }   // someone who signs up a minute later gets in within 10 min
  return null;                                                              // 401/403 (token), 429 (busy), 5xx
}

/** Whether an event takes games now: its "open" box is ticked and its closing time, if any, hasn't passed. */
function live_(ev) {
  return ev.open && !(ev.closes && Date.now() >= ev.closes);
}

/**
 * Why a score that fits the rules still looks unlike real play, or "" if it doesn't. `board` is the board's visible
 * scores before this one; `overlap` is the code if this game started while another game on it was running.
 */
function suspect_(e, board, overlap) {
  const fmt = function (x, d) { const p = x.toFixed(d).split("."); return p[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",") + (p[1] ? "." + p[1] : ""); };
  if (overlap) return "started while another game on code " + overlap + " was still running";
  if (e.w >= 4 && e.t / (e.w - 1) < SUSPECT_SECS_PER_WAVE) return "wave " + e.w + " in " + e.t + " s: " + fmt(e.t / (e.w - 1), 1) + " s a wave (strong players take 26 s or more)";
  if (e.t >= 60 && e.k / e.t > SUSPECT_KILLS_PER_SEC) return e.k + " kills in " + e.t + " s: " + fmt(e.k / e.t, 2) + " a second (strong players reach about 1.7)";
  if (e.k >= 40 && e.s / e.k > SUSPECT_POINTS_PER_KILL) return fmt(e.s / e.k, 0) + " points a kill (strong players reach about 900)";
  if (e.t >= 60 && e.s / e.t > SUSPECT_POINTS_PER_SEC) return fmt(e.s / e.t, 0) + " points a second (strong players reach about 1,000)";
  const best = board.reduce(function (m, r) { return Math.max(m, r.s); }, 0);
  if (board.length >= 10 && e.s > SUSPECT_ABOVE_BEST * best) return fmt(e.s / best, 1) + " times the best score on this board so far (" + fmt(best, 0) + ")";
  return "";
}

/**
 * Rewrites the "winners" tab: each event's best approved scores, one per play code, with the code and the proof to ask
 * for (the ticket, or the welcome email); on a tie the earlier score places higher. Runs after every event score; use
 * REBELS → Update winners (or Run ▶ winners) after ticking, unticking or deleting rows. Everything but the notes column
 * is rewritten each time, and the tab warns anyone who types elsewhere. Notes ("collected", "called at 15:00") are kept
 * per event and code, so they stay with the player when the list re-sorts, and come back if a code drops out and returns.
 */
function winners() {
  const book = SpreadsheetApp.getActiveSpreadsheet();
  const tab = book.getSheetByName(WINNERS_SHEET) || book.insertSheet(WINNERS_SHEET);
  guard_(tab);
  // the notes typed in the tab now, merged into the ones kept from before
  const props = PropertiesService.getDocumentProperties(), NOTE = WINNERS_HEADER.length - 1;
  let notes = {};
  try { notes = JSON.parse(props.getProperty("winnerNotes") || "{}") || {}; } catch (err) { notes = {}; }
  const shown = tab.getDataRange().getValues();
  if (shown.length && String(shown[0][NOTE]).toLowerCase().trim() === "notes") {
    shown.slice(1).forEach(function (r) {
      const key = noteKey_(r[0], r[5], r[2], r[3]), note = String(r[NOTE] === undefined ? "" : r[NOTE]).trim();
      if (!key) return;
      if (note) notes[key] = note; else delete notes[key];
    });
  }
  const ids = Object.keys(events_());
  const byEvent = {};
  sheet_().getDataRange().getValues().slice(1).forEach(function (r) {
    const ev = String(r[8] || "").toLowerCase().trim(), approved = r[7] === true || r[7] === "" || String(r[7]).toUpperCase() === "TRUE";
    if (ids.indexOf(ev) < 0 || !approved || !(num_(r[2]) > 0)) return;
    (byEvent[ev] = byEvent[ev] || []).push(r);
  });
  const out = [WINNERS_HEADER];
  const line = function (ev, place, r) {
    const code = String(r[9] || ""), n = String(r[1]), sc = num_(r[2]);
    return [ev, place, n, sc, num_(r[3]) || "", code, String(r[10] || ""), r[0], notes[noteKey_(ev, code, n, sc)] || ""];
  };
  ids.forEach(function (ev) {
    const seen = {}, rows = (byEvent[ev] || []).sort(function (a, b) { return num_(b[2]) - num_(a[2]) || new Date(a[0]) - new Date(b[0]); });
    rows.filter(house_).forEach(function (r) { out.push(line(ev, "to beat", r)); });   // scores to beat first, without a place
    rows.filter(function (r) { return !house_(r); })
      .filter(function (r) { const c = String(r[9] || ""); if (!c) return true; if (seen[c]) return false; seen[c] = true; return true; })   // each code's best
      .slice(0, WINNERS_PER_EVENT)
      .forEach(function (r, i) { out.push(line(ev, i + 1, r)); });
  });
  props.setProperty("winnerNotes", JSON.stringify(notes));
  tab.clearContents();
  tab.getRange(1, 1, out.length, WINNERS_HEADER.length).setValues(out);
  tab.setFrozenRows(1);
}

/**
 * A score typed in by hand to beat ("house" in its proof column), like an arcade's preset high scores: it shows on its
 * board like any other, but never takes a prize place in the winners tab. The wave can be left empty.
 */
function house_(r) {
  return String(r[10] === undefined ? "" : r[10]).toLowerCase().trim() === "house";
}

/** What a note belongs to: the event and the play code (or, for a score without one, its initials and score). */
function noteKey_(ev, code, initials, score) {
  ev = String(ev || "").toLowerCase().trim();
  if (!ev || ev === "event") return "";
  return ev + "|" + (String(code || "") || "~" + String(initials || "") + "|" + String(score || ""));
}

/** Makes the winners tab warn anyone who types outside the notes column: the script rewrites the rest. */
function guard_(tab) {
  try {
    if (tab.getProtections(SpreadsheetApp.ProtectionType.SHEET).length) return;
    const p = tab.protect().setDescription("Rewritten by the script after every event score. Type only in the notes column; test scores go in the scores tab.");
    p.setWarningOnly(true);
    p.setUnprotectedRanges([tab.getRange(2, WINNERS_HEADER.length, 1000, 1)]);
  } catch (err) { /* no protection: the tab still works */ }
}

/** Adds the REBELS menu to the sheet (runs when the sheet is opened). */
function onOpen() {
  SpreadsheetApp.getUi().createMenu("REBELS").addItem("Update winners", "winners").addToUi();
}

/** Keeps the best KEEP_ROWS scores of each board (the world table and every event), so busy boards can't crowd out others. */
function trim_(sheet) {
  const values = sheet.getDataRange().getValues();
  const count = {};
  const body = values.slice(1).sort(function (a, b) { return Number(b[2]) - Number(a[2]); })
    .filter(function (r) { const k = String(r[8] || ""); count[k] = (count[k] || 0) + 1; return count[k] <= KEEP_ROWS; });
  sheet.clearContents();
  sheet.getRange(1, 1, 1, HEADER.length).setValues([HEADER]);
  if (body.length) {
    sheet.getRange(2, 1, body.length, HEADER.length).setValues(body.map(function (r) { const row = r.slice(0, HEADER.length); while (row.length < HEADER.length) row.push(""); return row; }));
    checkbox_(sheet.getRange(2, APPROVED_COL, body.length, 1));
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
    sheet.getRange(1, 1, 1, HEADER.length).setValues([HEADER]);   // add newer columns ("approved", "event") to an older sheet
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
 * unticked (hidden) if they're above it, so they get the same review as new ones. It also repairs cells that the
 * sheet formatted as dates (they make scores read back as huge numbers). It creates the "events" tab with an example
 * event (PGConf.EU, with a random booth key) the first time, and the "winners" tab. Safe to run again at any time.
 */
function setup() {
  const book = SpreadsheetApp.getActiveSpreadsheet();
  if (!book.getSheetByName(EVENTS_SHEET)) {
    const ev = book.insertSheet(EVENTS_SHEET);
    ev.appendRow(EVENTS_HEADER);
    ev.appendRow(["pgconfeu", "PGConf.EU", true, COMMUNITY_SIGNUP, PGCONFEU_LOGO, "", true, "", ""]);
    ev.setFrozenRows(1);
  } else {
    // events tabs made before a column existed get it, at the end; existing rows get sign-up codes on
    const evs = book.getSheetByName(EVENTS_SHEET), values = evs.getDataRange().getValues();
    const have = (values[0] || []).map(function (h) { return String(h).toLowerCase().trim(); });
    EVENTS_HEADER.forEach(function (h) {
      if (have.indexOf(h) >= 0) return;
      have.push(h);
      evs.getRange(1, have.length).setValue(h);
      if (h === "signup codes" && values.length > 1) evs.getRange(2, have.length, values.length - 1, 1).setValues(values.slice(1).map(function () { return [true]; }));
    });
  }
  const evs = book.getSheetByName(EVENTS_SHEET), heads = evs.getDataRange().getValues()[0].map(function (h) { return String(h).toLowerCase().trim(); });
  ["open", "signup codes"].forEach(function (h) { const i = heads.indexOf(h); if (i >= 0) checkbox_(evs.getRange(2, i + 1, 200, 1)); });
  const sheet = sheet_();
  winners();
  const last = sheet.getLastRow();
  if (last < 2) return;
  // repair formats: numbers written into date-formatted cells read back as dates; convert them and fix the formats
  const body = sheet.getRange(2, 1, last - 1, 7);
  const fixed = body.getValues().map(function (r) { return [r[0], String(r[1]), num_(r[2]), num_(r[3]), num_(r[4]), num_(r[5]), num_(r[6])]; });
  body.setNumberFormats(fixed.map(function () { return FORMATS.slice(0, 7); }));
  body.setValues(fixed);
  const range = sheet.getRange(2, APPROVED_COL, last - 1, 1);
  const scores = sheet.getRange(2, 3, last - 1, 1).getValues();
  const flags = range.getValues().map(function (r, i) { return [r[0] === "" ? Number(scores[i][0]) <= REVIEW_ABOVE : r[0]]; });
  range.setValues(flags);
  checkbox_(range);
}
