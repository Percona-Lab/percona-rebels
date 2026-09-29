# World high scores: setup (about 5 minutes)

The game on GitHub Pages is static, so the shared table lives in a Google Sheet behind a small Google Apps Script web app
(`Code.gs`). The script checks every score before it's saved and hands the top 10 back to the game. The sheet itself
can stay private: only the script touches it.

## 1. Create the sheet and paste the script

1. Create a Google Sheet, for example **PERCONA REBELS high scores**, in the Google account that should own the table.
   Use an account whose admin lets you publish Apps Script web apps to "Anyone" (see Troubleshooting).
2. In the sheet: **Extensions → Apps Script**.
3. Replace everything in `Code.gs` with the contents of this folder's `Code.gs`, then **Save**.
4. In the function menu next to ▶ Run, pick **setup** and click **Run**. Google asks you to authorise the script for
   this spreadsheet; allow it. A `scores` sheet with a header row appears.

## 2. Deploy it as a web app

1. **Deploy → New deployment**, gear icon → **Web app**.
2. Description: `PERCONA REBELS world table`. **Execute as: Me**. **Who has access: Anyone**.
3. **Deploy**, then copy the **Web app URL**. It ends in `/exec`.

"Anyone" means anyone can call the script, not that anyone can open the sheet. The sheet keeps its own sharing settings.

## 3. Point the game at it

**In the public repository** (github.com/Percona-Lab/percona-rebels, or your fork): set the URL in `index.html`,

```html
<script>…window.REBELS_LEADERBOARD="https://script.google.com/macros/s/…/exec";</script>
```

then commit and push. GitHub Pages redeploys in about a minute.

**At Percona**, where the game is generated from the internal ARCADE project: put the URL in `leaderboard/config.json`
there, run `python3 scripts/export_rebels_repo.py ../percona-rebels`, then commit and push in `../percona-rebels`.

The attract mode then shows **WORLD TOP 10**, and after a game you see your world rank.

## Running it

* **Review:** scores above `REVIEW_ABOVE` (100,000 to start) are saved with the **approved** box unticked and stay
  hidden until you tick it. Untick any row to hide it, or delete the row. Changes show in the game within 20 seconds.
* **What's stored:** time, initials, score, wave, seconds played, kills, game version, approved. Apps Script never sees
  players' IP addresses, and the game sends no names or ids.
* **Anti-cheat:** every game gets a one-time ticket when it starts, and the script times the run itself: a score can't
  claim more play time than really passed, and each ticket gives one score. The numbers must also fit the game (points
  per kill, kills per wave and per second, seconds per wave, multiples of 10), initials are filtered, and starts and
  scores are rate-limited. Tune the constants at the top of `Code.gs`. A patient cheater who plays along in real time
  with a doctored game can still get a plausible score in; that's what the review threshold is for.
* **Changing the script:** after editing, use **Deploy → Manage deployments → edit (pencil) → Version: New version →
  Deploy**. The URL stays the same.
* **Turning it off:** empty the URL in `leaderboard/config.json` and export again, or archive the deployment. The game
  falls back to its per-browser table.

## Upgrading from the first version (no tickets)

1. Paste the new `Code.gs` over the old one and **Save**.
2. Run **setup** once. It adds the **approved** column: existing scores at or below `REVIEW_ABOVE` are ticked, higher
   ones are left unticked for you to check.
3. **Deploy → Manage deployments →** edit (pencil) **→ Version: New version → Deploy**. The URL stays the same.
4. Update every copy of the game that talks to the table (GitHub Pages, and the CHAOS page at Percona). Older copies
   don't ask for tickets, so after the upgrade their scores stay local.

## Troubleshooting

* **"Who has access: Anyone" is missing, or players get a Google sign-in page:** the Google Workspace admin restricts
  web apps to the organisation. Ask the admin to allow it for this script, or own the sheet with an account outside the
  Workspace, for example a team or marketing account.
* **The game says OFFLINE RIGHT NOW:** open the `/exec` URL with `?action=top` in a private browser window. You should
  see `{"ok":true,"top":[...]}`. A sign-in page means the access setting above; an error means the script needs the
  `setup` authorisation step again.
