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
   this spreadsheet; allow it. A `scores` sheet with a header row appears, and an `events` sheet (see Event boards).

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

* **Moderation:** every score goes live at once, with its **approved** box ticked, unless it looks suspicious (see
  Suspicious scores below). If one looks off, untick it to hide
  it, or delete the row. Changes show in the game within 20 seconds. To hold big scores back for review instead, set
  `REVIEW_ABOVE` in `Code.gs` to a number (for example 100000): scores above it then arrive unticked.
* **What's stored:** time, initials, score, wave, seconds played, kills, game version, approved, event, play code,
  proof (ticket or email) and why (a suspicion reason). Apps Script never sees
  players' IP addresses, and the game sends no names or ids.
* **Anti-cheat:** every game gets a one-time ticket when it starts, and the script times the run itself: a score can't
  claim more play time than really passed, and each ticket gives one score. The numbers must also fit the game (points
  per kill, kills per wave and per second, seconds per wave, multiples of 10), initials are filtered, and starts and
  scores are rate-limited. Tune the constants at the top of `Code.gs`. A patient cheater who plays along in real time
  with a doctored game can still get a plausible score in; untick or delete it when you spot it.
* **Changing the script:** after editing, use **Deploy → Manage deployments → edit (pencil) → Version: New version →
  Deploy**. The URL stays the same.
* **Turning it off:** empty the URL in `leaderboard/config.json` and export again, or archive the deployment. The game
  falls back to its per-browser table.

## Event boards (booths at conferences)

An event gets its own TOP 10, kept apart from the world table. Playing it takes a **play code**, the arcade token: a
raffle ticket number, or the code in the Percona Community welcome email. The code is how winners are found among
hundreds of players without the game collecting any names or emails. Adding an event is adding a row: no redeploy.

### The events tab

Setup creates it with a PGConf.EU row. Columns are found by their header, in any order:

| column | what it is |
|---|---|
| event | the id in the link: lowercase letters, digits and `-`, for example `pgconfeu` |
| name | shown in the game: `LIVE AT PGCONF.EU`, `PGCONF.EU TOP 10` (keep it under 17 characters) |
| open | tick box: unticked, no code is accepted and nobody can start a game on the event page |
| qr | the Percona Community sign-up link, shown as a QR code (https only) |
| logo | an https link to the event's logo, shown next to the game on that event's page only |
| tickets | the raffle ticket roll's numbers: `457001-458000`, several rolls with commas: `457001-458000, 460001-460500` |
| signup codes | tick box: also accept Percona Community sign-up codes (needs the HubSpot token below) |
| prize | a line the game shows on the title and code screens, for example `WINNERS AT THE BOOTH 15:00` |
| closes | when the board stops taking codes, for example `2026-10-23 14:45` (the sheet's time zone: File → Settings) |

A **key** column from the first version of event boards isn't used any more; delete it or leave it.

### Play codes

* **Raffle tickets:** buy a roll of numbered tickets and type its first and last number in **tickets**. At the
  booth, scan a badge and hand over a ticket: its number is the player's code, and the ticket is their proof at prize
  time. The script accepts numbers on the roll and nothing else. A single roll is enough; a double roll's stubs are
  only needed if you also want a lucky draw among everyone who got a ticket.
* **Sign-up codes:** the Percona Community welcome email (a HubSpot form) carries the contact's record id as the
  code. The script checks with HubSpot that the contact exists, so a mistyped code is refused. Set it up once:
  1. In HubSpot (a super admin): create a private app (**Settings → Integrations → Private apps**; in newer accounts
     **Development → Legacy apps → Create → Private**), name `PERCONA REBELS`, scope **crm.objects.contacts.read**
     only. Copy its access token.
  2. In the Apps Script editor: **Project Settings → Script properties → Add**, property `HUBSPOT_TOKEN`, value the
     token. Run **setup** once more so Google asks for permission to call HubSpot.
  3. In the welcome email for the newsletter form: add the personalisation token **Record ID** with a line like
     "Your PERCONA REBELS play code: 12345678". Let contacts re-enrol in the workflow, so existing subscribers who
     fill in the form at the event get the email too.
  4. Tick **signup codes** for the event. The game only mentions sign-up codes once the token is set.
  The script only asks HubSpot whether a contact id exists: it reads nothing else and stores nothing about it.

Every code is checked when it's entered, and the player then confirms the number on screen before it counts: a
typo would put a high score on a code they can't claim the prize with.

### Links

* **Everyone:** `https://percona-lab.github.io/percona-rebels/?event=pgconfeu`. Share it anywhere: on slides, social,
  the QR code on a sign. A phone or laptop keeps the code after the first time and plays free on it (5 on the keyboard
  changes the code).
* **The booth's own machine:** add `&booth`: `…/?event=pgconfeu&booth`. Every game takes a code and the machine keeps
  none, so each player enters their own. Not a secret: it only changes what the machine remembers.
* `&code=457123` fills a code in, for example in a link in the welcome email.
* **The leaderboard screen** for a second monitor: add `&board`: `…/?event=pgconfeu&board`. The event's TOP 10, big and
  refreshing every 15 seconds (new scores flash), with the event logo, the prize line, and QR codes to get a play code
  and to play on your phone. Click once for fullscreen; it keeps the screen awake. `?board` alone shows the world's.

### On the page

With a wide enough window the event logo sits left of the game and a large sign-up QR code right of it. The title
says `LIVE AT <NAME>` and `INSERT TOKEN`, the attract loop and the end of every game show the QR code, the HUD's
CHAMP is the event's leader, and the prize line shows on the title screen.

### Winners

* The **winners** tab lists each event's top 10, one line per code (its best score), with the **proof** to ask for:
  `ticket` (they show their half of the ticket) or `email` (they show the welcome email with the code). It updates
  after every event score; after ticking, unticking or deleting rows, use **REBELS → Update winners** in the sheet's
  menu bar.
* At prize time, read out initials and scores; whoever holds the matching ticket or email collects. Not there? The
  next one down.
* Consider a playoff for the top few at the booth before prizes go out: a modified game can't play live in front of
  you.
* Colleagues' scores: untick them, or let Kyle skip @percona.com contacts when looking up sign-up codes.

### Suspicious scores

Scores that are possible but unlike real play arrive **unticked** (hidden), with the reason in the **why** column,
for example `wave 10 in 150 s: 16.7 s a wave (strong players take 26 s or more)`. The lines come from the game's own
autopilot over 300 games (champion level), with a wide margin: waves faster than 18 s on average, more than 2.2 kills
or 1,400 points a second, more than 1,250 points a kill, 2.5 times the board's best once it has 10 scores, or two
games running at once on one code. The player is told their score is held for review. If one looks genuine, tick it
and run **REBELS → Update winners**. This applies to the world table too. Tune the lines with the `SUSPECT_` constants
at the top of `Code.gs`.

### After the event

Untick **open** (or let **closes** do it). To move a score to the world table, clear its **event** cell in the scores
tab. Clear the **code** cells once prizes are out if you like: they're only needed to find winners.

The logo and QR link live only in the sheet, so the public repository stays free of third-party logos.

## Upgrading from the first version (no tickets)

1. Paste the new `Code.gs` over the old one and **Save**.
2. Run **setup** once. It adds the newer columns to the **scores** tab (approved, event, code, proof, why), creates or
   upgrades the **events** tab and creates the **winners** tab. Existing scores at or below `REVIEW_ABOVE` are ticked, higher ones are
   left unticked for you to check.
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
