/* PERCONA REBELS — freedom fighters for open source. A 1980s-style vertical shooter for ARCADE.
   Plain canvas + Web Audio. No framework, no build step, no network calls; works from disk.
   To change the line-up, edit ENEMIES, BOSSES and POWERUPS right below. */
(() => {
  "use strict";

  /* ================================================================== CONFIG — edit me */
  // The enemies are practices open source users push back on, not companies: no logos, no names, no one's project.
  // Waves feature them two at a time, in this order.
  //   id       file name for an optional local sprite: web/rebels-assets/<id>.png (folder is gitignored)
  //   name     full name, shown on the wave card and the attract screen
  //   tag      short label shown under an enemy while it dives
  //   color    main colour of the built-in sprite (shades are derived from it)
  //   hp       hits needed to destroy one
  //   points   score for a kill in formation (a kill while it dives scores double)
  //   pattern  dive pattern: swoop | dive | zigzag | loop | spiral
  //   sprite   built-in art: badge | coin | clipboard | chip | calendar | cube | paywall (practices), or the creatures
  //            crab | jelly | hornet | dart | cloud | orb | urchin | manta
  //   ability  optional mechanic: flip (friendly in formation, hostile when it dives; color2 is its hostile colour),
  //            drain (eats your score while it dives), jam (its shots jam your guns instead of killing),
  //            split (breaks into two cores), renew (comes back once; a smart bomb ends it for good),
  //            stealth (nearly invisible unless PMM is on), armor (PXC spread and wingmen hit harder)
  //   hint     one line on the attract screen explaining the ability
  //   quip     one line for the wave card. Keep it playful, never insulting.
  const ENEMIES = [
    { id: "relicenser", name: "The Relicenser", tag: "RELICENSER", color: "#35c46a", color2: "#f2455c", hp: 1, points: 100, pattern: "swoop", sprite: "badge", ability: "flip", hint: "Friendly until it dives", quip: "Open source until it wasn't." },
    { id: "egress-fee", name: "Egress Fee", tag: "EGRESS FEE", color: "#f4c542", hp: 1, points: 120, pattern: "zigzag", sprite: "coin", ability: "drain", hint: "Drains your score while it dives", quip: "Your data can leave any time. For a fee." },
    { id: "surprise-audit", name: "Surprise Audit", tag: "AUDIT", color: "#e2cfa0", hp: 2, points: 150, pattern: "dive", sprite: "clipboard", ability: "jam", hint: "Its paperwork jams your guns", quip: "Just a routine check. Every year." },
    { id: "core-tax", name: "Core Tax", tag: "CORE TAX", color: "#3fd0e0", hp: 2, points: 150, pattern: "spiral", sprite: "chip", ability: "split", hint: "Splits into two cores when destroyed", quip: "Priced per core. You have many cores." },
    { id: "auto-renewal", name: "Auto-Renewal", tag: "RENEWAL", color: "#ff7ac6", hp: 2, points: 160, pattern: "loop", sprite: "calendar", ability: "renew", hint: "Comes back once. A smart bomb ends it", quip: "Renewed for another three years." },
    { id: "black-box", name: "Black Box", tag: "BLACK BOX", color: "#6a6484", hp: 2, points: 170, pattern: "swoop", sprite: "cube", ability: "stealth", hint: "Nearly invisible. PMM radar reveals it", quip: "No, you can't see the source." },
    { id: "enterprise-only", name: "Enterprise-Only Feature", tag: "PAYWALL", color: "#c8643b", hp: 4, points: 200, pattern: "dive", sprite: "paywall", ability: "armor", hint: "Armoured. PXC spread shots break it", quip: "Available in the Platinum tier." },
  ];
  // Bosses take turns every RULES.bossEvery waves. hp and points grow with each encounter. style picks the art and attacks.
  const BOSSES = [
    { id: "vendor-lock-in", name: "Vendor Lock-In", tag: "VENDOR LOCK-IN", color: "#8f96ad", hp: 110, points: 5000, style: "lock", quip: "Easy to get into. Try getting out.",
      intro: "BREAK THE LOCK!", phase2: ["CONTRACT RENEWAL", "NEW TERMS INCOMING"], phase3: ["THE LOCK IS BREAKING", "KEEP FIRING!"], win: ["LOCK-IN BROKEN!", "THE WAY IS OPEN"] },
    { id: "patent-troll", name: "Patent Troll", tag: "PATENT TROLL", color: "#6fae4f", hp: 120, points: 6000, style: "troll", quip: "I own the concept of rows.",
      intro: "PRIOR ART, ENGAGE!", phase2: ["CEASE AND DESIST", "HERE COME THE LAWYERS"], phase3: ["CLAIMS REJECTED", "THE PATENT IS CRUMBLING"], win: ["PATENT INVALIDATED!", "PRIOR ART WINS"] },
  ];
  const bossFor = (wave) => BOSSES[(Math.max(1, Math.floor(wave / RULES.bossEvery)) - 1) % BOSSES.length];
  // Power-ups, themed on Percona products. weight = how often it drops, duration in seconds.
  // icon = one of PRODUCT_ICONS below (Percona product icons); without one the drop is a lettered capsule.
  const POWERUPS = [
    { id: "pmm", label: "PMM", name: "PMM", color: "#9d8cff", icon: "pmm", iconColor: "#653df4", weight: 3, duration: 15, desc: "Radar. See every dive before it starts.", banner: "PMM RADAR", sub: "EYES ON EVERY DIVE" },
    { id: "xtrabackup", label: "PXB", name: "XtraBackup", color: "#35c46a", weight: 2, desc: "Shield. Grab another for an extra life.", banner: "XTRABACKUP", sub: "SHIELD UP. YOU'RE BACKED UP", subLife: "RESTORED FROM BACKUP: +1 LIFE" },
    { id: "operator", label: "OP", name: "Percona Operator", color: "#2aa6df", icon: "operator", iconColor: "#2aa6df", weight: 2, duration: 20, desc: "Deploys two wingman drones.", banner: "PERCONA OPERATOR", sub: "2 REPLICAS DEPLOYED" },
    { id: "pxc", label: "PXC", name: "PXC", color: "#ea6525", icon: "pxc", iconColor: "#ea6525", weight: 3, duration: 15, desc: "Triple spread shot. Three nodes, three shots.", banner: "PXC", sub: "3-NODE SPREAD SHOT" },
    { id: "toolkit", label: "PT", name: "Percona Toolkit", color: "#ff5c7a", weight: 1, desc: "Smart bomb. Hits everything on screen.", banner: "PERCONA TOOLKIT", sub: "PT-KILL! SMART BOMB" },
  ];
  const RULES = { startLives: 3, maxLives: 9, extraLifeEvery: 20000, bossEvery: 5, dropChance: 0.07, maxCombo: 8, comboStep: 5, comboWindow: 2.0 };
  // Default high-score table (initials only: the game never ranks people from the roster).
  const DEFAULT_SCORES = [["PXC", 30000, 10], ["PMM", 25000, 9], ["PXB", 20000, 8], ["OPS", 15000, 7], ["PTK", 12000, 6], ["SQL", 9000, 5], ["DBA", 6000, 4], ["OSS", 4000, 3], ["YAY", 2000, 2], ["GUD", 1000, 1]];
  // Local sprite hook: web/rebels-assets/<id>.png replaces that enemy's built-in art. The browser can't check whether a
  // file exists without requesting it (and logging a 404), so it is opt-in: set this to true, or open the page once with
  // ?sprites (remembered in this browser; ?nosprites turns it off). The single-file build inlines any PNGs it finds automatically.
  const LOCAL_SPRITES = false;
  // Where Esc / the back link goes, as shown on screen. The public single-file build sets it to "PERCONA.COM".
  const BACK_NAME = String(window.REBELS_BACK_NAME || "ARCADE").toUpperCase();

  /* ================================================================== basics */
  const W = 224, H = 288, STEP = 1 / 60;          // Galaga's own resolution, portrait
  const C = { yellow: "#f6fe54", purple: "#653df4", lilac: "#9d8cff", white: "#f4f2f8", dim: "#a9a5b8", faint: "#6f6b7d", red: "#ff5c7a", teal: "#22c1a5", orange: "#ff9f43", bg: "#07060b", ink: "#140c28" };
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const rnd = (a = 1, b) => (b === undefined ? Math.random() * a : a + Math.random() * (b - a));
  const pick = (a) => a[(Math.random() * a.length) | 0];
  const bez = (p0, p1, p2, p3, t) => { const u = 1 - t; return u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3; };
  const easeOut = (t) => 1 - Math.pow(1 - t, 3);
  const pad = (n, l = 6) => String(Math.max(0, Math.floor(n))).padStart(l, "0");
  const norm = (s) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "");
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const $ = (s) => document.querySelector(s);
  const store = {
    get(k, d) { try { const v = localStorage.getItem("arcade.rebels." + k); return v === null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem("arcade.rebels." + k, JSON.stringify(v)); } catch { /* private mode */ } },
  };
  const motionQuery = matchMedia("(prefers-reduced-motion: reduce)");
  let reduced = motionQuery.matches;
  motionQuery.addEventListener?.("change", (e) => (reduced = e.matches));
  const asset = (path) => (window.ARCADE_ASSETS && window.ARCADE_ASSETS[path]) || path;   // the single-file build inlines images here

  function makeCanvas(w, h) { const c = document.createElement("canvas"); c.width = w; c.height = h; return c; }
  // every offscreen canvas stays CPU-backed: they are all small, and mixing GPU and CPU canvases costs a readback per draw
  const ctx2d = (c) => c.getContext("2d", { willReadFrequently: true });
  const colorCtx = makeCanvas(1, 1).getContext("2d", { willReadFrequently: true });
  function rgbOf(css) { colorCtx.clearRect(0, 0, 1, 1); colorCtx.fillStyle = "#000"; colorCtx.fillStyle = css; colorCtx.fillRect(0, 0, 1, 1); const d = colorCtx.getImageData(0, 0, 1, 1).data; return [d[0], d[1], d[2]]; }
  const hex = (c) => "#" + c.map((v) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, "0")).join("");
  const mix = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
  function hexToHsl(hx) {
    const n = parseInt(hx.slice(1), 16); const r = (n >> 16) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b); let h = 0, s = 0; const l = (max + min) / 2;
    if (max !== min) { const d = max - min; s = l > 0.5 ? d / (2 - max - min) : d / (max + min); h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60; }
    return [h, s * 100, l * 100];
  }

  /* ================================================================== canvases */
  const buf = makeCanvas(W, H);                        // the low-res frame everything is drawn into
  const g = buf.getContext("2d", { willReadFrequently: true });           // CPU-backed: cheap to upload to WebGL every frame
  g.imageSmoothingEnabled = false;
  const stage = $("#stage"), view = $("#view"), crtCanvas = $("#crt");
  const vctx = view.getContext("2d");

  /* ================================================================== fonts: 8x8 from Press Start 2P, 3x5 built in */
  const SMALL = {
    A: "25755", B: "65656", C: "34443", D: "65556", E: "74647", F: "74644", G: "34553", H: "55755", I: "72227", J: "11152", K: "55655", L: "44447", M: "57755",
    N: "65555", O: "25552", P: "65644", Q: "25563", R: "65655", S: "34216", T: "72222", U: "55557", V: "55552", W: "55775", X: "55255", Y: "55222", Z: "71247",
    0: "75557", 1: "26227", 2: "61247", 3: "61216", 4: "55711", 5: "74616", 6: "34757", 7: "71222", 8: "75757", 9: "75716",
    " ": "00000", "-": "00700", ".": "00002", ",": "00024", "!": "22202", "?": "61202", "/": "11244", ":": "02020", "+": "02720", "'": "22000", '"': "55000",
    "(": "12221", ")": "42224", "%": "51245", "&": "25253", "=": "07070", "<": "12421", ">": "42124", "#": "57575", "*": "05250", "_": "00007",
  };
  const Font = { big: null, small: null, smallIndex: {}, cache: new Map() };
  function buildSmallFont() {
    const chars = Object.keys(SMALL); const c = makeCanvas(chars.length * 4, 5); const x = ctx2d(c); x.fillStyle = "#fff";
    chars.forEach((ch, i) => { Font.smallIndex[ch] = i; for (let r = 0; r < 5; r++) { const bits = +SMALL[ch][r]; for (let b = 0; b < 3; b++) if (bits & (4 >> b)) x.fillRect(i * 4 + b, r, 1, 1); } });
    Font.small = c;
  }
  function buildBigFont(usePS2P) {
    const c = makeCanvas(95 * 8, 8); const x = c.getContext("2d", { willReadFrequently: true });
    if (usePS2P) {
      const tmp = makeCanvas(95 * 8, 12); const t = tmp.getContext("2d", { willReadFrequently: true });
      t.font = '8px "Press Start 2P"'; t.textBaseline = "top"; t.fillStyle = "#fff";
      for (let i = 32; i < 127; i++) t.fillText(String.fromCharCode(i), (i - 32) * 8, 0);
      const d = t.getImageData(0, 0, tmp.width, tmp.height); const a = d.data;
      let top = 12; // align so that the cap height starts on row 0
      for (let y = 0; y < 12 && top === 12; y++) for (let xx = ("H".charCodeAt(0) - 32) * 8; xx < ("H".charCodeAt(0) - 31) * 8; xx++) if (a[(y * tmp.width + xx) * 4 + 3] > 100) { top = y; break; }
      if (top === 12) top = 0;
      for (let p = 0; p < a.length; p += 4) { const on = a[p + 3] > 100; a[p] = a[p + 1] = a[p + 2] = 255; a[p + 3] = on ? 255 : 0; }
      x.putImageData(d, 0, -top);
    } else {
      // fallback: stretch the 3x5 font into the 8x8 grid
      x.fillStyle = "#fff"; const rowMap = [0, 1, 1, 2, 3, 3, 4];
      for (let i = 32; i < 127; i++) { const rows = SMALL[String.fromCharCode(i).toUpperCase()]; if (!rows) continue; for (let r = 0; r < 7; r++) { const bits = +rows[rowMap[r]]; for (let b = 0; b < 3; b++) if (bits & (4 >> b)) x.fillRect((i - 32) * 8 + 1 + b * 2, r, 2, 1); } }
    }
    Font.big = c; Font.cache.clear();
  }
  function tinted(which, color) {
    const key = which + color; let c = Font.cache.get(key);
    if (!c) { const src = Font[which]; c = makeCanvas(src.width, src.height); const x = ctx2d(c); x.drawImage(src, 0, 0); x.globalCompositeOperation = "source-in"; x.fillStyle = color; x.fillRect(0, 0, c.width, c.height); Font.cache.set(key, c); }
    return c;
  }
  const textWidth = (s, o = {}) => { const n = String(s).length, sc = o.scale || 1; return o.small ? (n * 4 - 1) * sc : n * 8 * sc; };
  // text(str, x, y, colour, {small, scale, align: left|center|right, shadow})
  function text(s, x, y, color = C.white, o = {}) {
    s = String(s); if (o.small) s = norm(s).toUpperCase();
    const sc = o.scale || 1, w = textWidth(s, o);
    if (o.align === "center") x = Math.round(x - w / 2); else if (o.align === "right") x = Math.round(x - w);
    x = Math.round(x); y = Math.round(y);
    if (o.shadow) text(s, x + sc, y + sc, o.shadow, { small: o.small, scale: sc });
    const atlas = tinted(o.small ? "small" : "big", color);
    for (let i = 0; i < s.length; i++) {
      if (o.small) { const idx = Font.smallIndex[s[i]]; if (idx !== undefined) g.drawImage(atlas, idx * 4, 0, 3, 5, x + i * 4 * sc, y, 3 * sc, 5 * sc); }
      else { const code = s.charCodeAt(i); if (code > 32 && code < 127) g.drawImage(atlas, (code - 32) * 8, 0, 8, 8, x + i * 8 * sc, y, 8 * sc, 8 * sc); }
    }
    return w;
  }
  function wrap(s, maxChars) {
    const out = []; let line = "";
    for (const word of String(s).split(/\s+/)) { if ((line + " " + word).trim().length > maxChars && line) { out.push(line); line = word; } else line = (line + " " + word).trim(); }
    if (line) out.push(line); return out;
  }
  const blink = (rate = 2, t = G.t) => Math.floor(t * (reduced ? Math.min(rate, 1) : rate)) % 2 === 0;

  /* ================================================================== sprites (original pixel art; left half + centre column, mirrored) */
  const SPR = {
    crab: [["l.....", "a...a.", "a..aaa", "aaallw", "aadkaa", ".aaaaa", "..dada", ".d....", "d....."],
      ["......", "....a.", "l..aaa", "aaallw", "aadkaa", "aaaaaa", "..dada", "..d...", "...d.."]],
    jelly: [["...aaa", "..alll", ".aalll", ".akaaa", ".aaaaa", ".d.d.d", ".d.d.d", "d..d..", "......"],
      ["...aaa", "..alll", ".aalll", ".akaaa", ".aaaaa", "..d.d.", ".d.d.d", "..d..d", "......"]],
    hornet: [["ll....", "lll...", ".llaaa", "..akaa", "..dddd", "..aaaa", "...ddd", "....aa", ".....w"],
      ["......", "......", "..laaa", "llakaa", "lllddd", "..aaaa", "...ddd", "....aa", ".....w"]],
    dart: [["a....y", "aa...l", "daa..l", ".daaal", "..daaw", "...daa", "....da", ".....a", "......"],
      ["l.....", "aa...l", "daa..l", ".daaal", "..daak", "...daa", "....da", ".....a", "......"]],
    cloud: [["......", "...ll.", "..llll", ".lllll", "llklll", "llllll", ".aaaaa", "..a..a", ".a..a."],
      ["......", "...ll.", "..llll", ".lllll", "llklll", "llllll", ".aaaaa", ".a..a.", "..a..a"]],
    orb: [["....aa", "..aall", ".aalll", "wwwwww", "aaakaa", ".aaaaa", "..daaa", "....dd", "......"],
      ["....aa", "..aall", ".aalll", "aaakaa", "wwwwww", ".aaaaa", "..daaa", "....dd", "......"]],
    urchin: [["a....a", ".a...a", "..aaaa", ".aakll", "aaaaaa", ".aaddd", "..aaaa", ".a...a", "a....a"],
      [".....a", "a....a", ".a.aaa", "..akll", "aaaaaa", "..addd", ".a.aaa", "a....a", ".....a"]],
    manta: [["a.....", "aa....", "aaa.aa", "daaaal", ".dakaa", "..dddd", ".....d", ".....d", ".....a"],
      ["......", "......", "a...aa", "aaaaal", "ddakaa", "..dddd", ".....d", ".....d", ".....a"]],
  };
  // Practice enemies (11x9). Six-character rows are a left half plus the centre column, mirrored; 11-character rows are drawn as is.
  Object.assign(SPR, {
    badge: [["..aaaaaaa..", ".allllllla.", ".alllllkla.", ".allllklla.", ".akllkllla.", ".alkklllla.", "..allllla..", "...aalaa...", ".....a....."],
      ["..aaaaaaa..", ".wllllllla.", ".alllllkla.", ".allllklla.", ".akllkllla.", ".alkklllla.", "..allllla..", "...aalaa...", ".....a....."]],
    badgebad: [["..aaaa", ".allll", ".alkll", ".allkl", ".alllk", ".allkl", "..alkl", "...aal", ".....a"],
      ["..aaaa", ".allll", ".alkll", ".allkl", ".alllk", ".allkl", "..alkl", "...aal", ".....w"]],
    coin: [["...aaa", "..alll", "d.alkk", "ddalll", "d.alll", "..adll", "...aaa", "......", "......"],
      ["...aaa", "..alll", ".dalkk", "d.alll", "..alll", "..adll", "...aaa", "......", "......"]],
    clipboard: [["....dd", ".ddddd", ".dllll", ".dlkkl", ".dllll", ".dlkkk", ".dllll", ".dllll", ".ddddd"],
      ["....dd", ".ddddd", ".dllll", ".dllkl", ".dllll", ".dlkkk", ".dllll", ".dllll", ".ddddd"]],
    chip: [[".d.d.d", "aaaaaa", "dallll", "alkkkk", "dalkky", "alkkkk", "dallll", "aaaaaa", ".d.d.d"],
      [".d.d.d", "aaaaaa", "dallll", "alkkkk", "dalkkw", "alkkkk", "dallll", "aaaaaa", ".d.d.d"]],
    calendar: [["..k...", "aakaaa", "aaaaaa", "wwwwww", "wkwkwk", "wwwwww", "wkwkwk", "wwwwww", ".ddddd"],
      ["..k...", "llklll", "aaaaaa", "wwwwww", "wkwkwk", "wwwwww", "wkwkwr", "wwwwww", ".ddddd"]],
    cube: [["...lllll...", ".lllllllll.", "lllllllllll", "aaaaawddddd", "aaaaawddddd", "aaraawddrdd", "aaaaawddddd", ".aaaawdddd.", "...aawdd..."],
      ["...lllll...", ".lllllllll.", "lllllllllll", "aaaaawddddd", "aaaaawddddd", "aayaawddydd", "aaaaawddddd", ".aaaawdddd.", "...aawdd..."]],
    paywall: [["dddddd", "llldll", "dddddd", "ldllld", "dddddd", "llldyy", "dddddd", "ldllld", "dddddd"],
      ["dddddd", "llldll", "dddddd", "ldllld", "dddddd", "llldww", "dddddd", "ldllld", "dddddd"]],
    core: [[".d.d.", "dakad", "akyka", "dakad", ".d.d."], [".d.d.", "dakad", "akwka", "dakad", ".d.d."]],
  });
  const DRONE = ["...y", "..ll", ".lal", "llaa", ".d.d"];
  const SPRITE_ORDER = ["badge", "coin", "clipboard", "chip", "calendar", "cube", "paywall", "crab", "jelly", "hornet", "dart", "cloud", "orb", "urchin", "manta"];
  const mirror = (rows) => rows.map((r) => (r.length === 6 || r.length === 4 ? r + [...r.slice(0, -1)].reverse().join("") : r));
  function paletteFor(css) { const b = rgbOf(css); return { a: hex(b), d: hex(mix(b, [0, 0, 0], 0.45)), l: hex(mix(b, [255, 255, 255], 0.45)), w: "#ffffff", k: C.ink, y: C.yellow, r: C.red }; }
  function paint(rows, pal) { const c = makeCanvas(rows[0].length, rows.length); const x = ctx2d(c); rows.forEach((row, j) => [...row].forEach((ch, i) => { if (ch !== ".") { x.fillStyle = pal[ch] || pal.a; x.fillRect(i, j, 1, 1); } })); return c; }
  function silhouette(src, color = "#fff") { const c = makeCanvas(src.width, src.height); const x = ctx2d(c); x.drawImage(src, 0, 0); x.globalCompositeOperation = "source-in"; x.fillStyle = color; x.fillRect(0, 0, c.width, c.height); return c; }
  function prepareTypes() {
    ENEMIES.forEach((t, i) => {
      t.pal = paletteFor(t.color || C.lilac);
      const frames = SPR[t.sprite] || SPR[SPRITE_ORDER[i % SPRITE_ORDER.length]];
      t.frames = frames.map((f) => paint(mirror(f), t.pal)); t.white = t.frames.map((f) => silhouette(f));
      t.hp = Math.max(1, t.hp | 0 || 1); t.points = t.points || 100; t.tag = t.tag || t.name;
      if (t.ability === "flip") { const pal2 = paletteFor(t.color2 || C.red); t.frames2 = (SPR[t.sprite2] || SPR[t.sprite + "bad"] || frames).map((f) => paint(mirror(f), pal2)); t.white2 = t.frames2.map((f) => silhouette(f)); t.pal2 = pal2; }
      if (t.ability === "split") t.child = { id: t.id + "-core", name: "Core", tag: "CORE", pal: t.pal, hp: 1, points: Math.round(t.points / 3), pattern: "dive", frames: SPR.core.map((f) => paint(f, t.pal)) };
      if (t.child) t.child.white = t.child.frames.map((f) => silhouette(f));
    });
    BOSSES.forEach((def) => {
      def.pal = paletteFor(def.color);
      const make = def.style === "troll" ? makeTroll : makeBoss;
      def.frames = [make(def, false), make(def, true)]; def.white = def.frames.map((f) => silhouette(f));
    });
    DRONE.pal = paletteFor(C.purple); DRONE.img = paint(mirror(DRONE), DRONE.pal);
    POWERUPS.forEach((P) => { if (P.icon && PRODUCT_ICONS[P.icon]) { const base = rgbOf(P.iconColor || P.color); P.iconImg = buildIcon(P.icon, hex(base), 23); P.iconHi = buildIcon(P.icon, hex(mix(base, [255, 255, 255], 0.55)), 23); P.iconBig = buildIcon(P.icon, hex(mix(base, [255, 255, 255], 0.15)), 38); } });
  }
  // Vendor Lock-In: a padlock battleship, drawn in code (48x36, anchor at 24,20)
  function makeBoss(def, open) {
    const c = makeCanvas(48, 36), x = ctx2d(c), P = def.pal;
    const put = (i, j, col) => { x.fillStyle = col; x.fillRect(i, j, 1, 1); };
    const rect = (i, j, w, h, col) => { x.fillStyle = col; x.fillRect(i, j, w, h); };
    const lift = open ? 6 : 0;
    for (let j = 0; j < 22; j++) for (let i = 0; i < 48; i++) {
      const dx = i + 0.5 - 24, dy = j + 0.5 - 15; let d;
      if (dy <= 0) d = Math.hypot(dx, dy); else d = Math.abs(dx);
      if (d > 10 || d < 6) continue;
      put(i, j - lift, d < 7 || d > 9 ? P.d : P.l);
    }
    if (open) for (let j = 16; j < 22; j++) for (let i = 14; i < 18; i++) put(i, j, i === 14 || i === 17 ? P.d : P.l);   // left leg stays in
    rect(8, 18, 32, 16, P.d); rect(9, 19, 30, 14, P.a); rect(9, 19, 30, 2, P.l); rect(9, 32, 30, 1, P.d);
    [[11, 22], [36, 22], [11, 30], [36, 30]].forEach(([i, j]) => put(i, j, C.yellow));
    const key = open ? C.red : C.ink;
    for (let j = 20; j < 31; j++) for (let i = 18; i < 30; i++) { const dx = i + 0.5 - 24, dy = j + 0.5 - 24; if (Math.hypot(dx, dy) <= 2.8 || (Math.abs(dx) <= 1 && j >= 24 && j <= 29)) put(i, j, key); }
    for (let j = 20; j < 31; j++) { const span = Math.min(7, j - 20); for (let s = 0; s <= span; s++) { put(7 - s, j, s === span ? P.d : P.a); put(40 + s, j, s === span ? P.d : P.a); } }
    rect(1, 28, 4, 7, P.d); rect(2, 28, 2, 6, P.l); rect(43, 28, 4, 7, P.d); rect(44, 28, 2, 6, P.l);
    rect(2, 34, 2, 1, C.yellow); rect(44, 34, 2, 1, C.yellow);
    for (let i = 13; i < 36; i += 3) if (Math.abs(i + 0.5 - 24) > 3) rect(i, 30, 1, 2, P.d);
    if (open) [[14, 21], [15, 22], [15, 23], [16, 24], [33, 25], [32, 26], [32, 27], [31, 28]].forEach(([i, j]) => put(i, j, P.d));
    return c;
  }
  // Patent Troll: a troll holding up its patent scroll, drawn in code (48x36, anchor at 24,20). angry = phase 3.
  function makeTroll(def, angry) {
    const c = makeCanvas(48, 36), x = ctx2d(c), P = def.pal;
    const put = (i, j, col) => { x.fillStyle = col; x.fillRect(i, j, 1, 1); };
    const rect = (i, j, w, h, col) => { x.fillStyle = col; x.fillRect(i, j, w, h); };
    const ell = (cx, cy, rx, ry, col) => { for (let j = 0; j < 36; j++) for (let i = 0; i < 48; i++) { const u = (i + 0.5 - cx) / rx, v = (j + 0.5 - cy) / ry; if (u * u + v * v <= 1) put(i, j, col); } };
    const tri = (pts, col) => { for (let j = 0; j < 36; j++) for (let i = 0; i < 48; i++) { const px = i + 0.5, py = j + 0.5; let inside = false; for (let a = 0, b = pts.length - 1; a < pts.length; b = a++) { const [xa, ya] = pts[a], [xb, yb] = pts[b]; if ((ya > py) !== (yb > py) && px < ((xb - xa) * (py - ya)) / (yb - ya) + xa) inside = !inside; } if (inside) put(i, j, col); } };
    tri([[7, 3], [17, 9], [14, 15]], P.d); tri([[41, 3], [31, 9], [34, 15]], P.d);          // ears
    ell(24, 26, 17, 9, P.d); ell(24, 25, 15, 8, P.a);                                          // body
    ell(24, 13, 11, 8.5, P.d); ell(24, 12.5, 10, 7.5, P.a); ell(24, 10, 7, 3.5, P.l);           // head
    rect(17, 8, 5, 1, P.d); rect(26, 8, 5, 1, P.d);                                              // brows
    if (angry) { put(21, 7, P.d); put(26, 7, P.d); }
    rect(18, 9, 4, 3, "#ffffff"); rect(26, 9, 4, 3, "#ffffff");
    const eye = angry ? C.red : C.ink; rect(20, 10, 2, 2, eye); rect(26, 10, 2, 2, eye);
    ell(24, 14, 2.5, 2, P.d);                                                                   // nose
    rect(19, 17, 10, 1, C.ink); rect(20, 15, 1, 2, "#ffffff"); rect(27, 15, 1, 2, "#ffffff");  // mouth, tusks
    ell(6, 27, 3.5, 3.5, P.a); ell(42, 27, 3.5, 3.5, P.a);                                      // hands
    rect(7, 24, 34, 9, "#b8a47a"); rect(8, 25, 32, 7, "#f4ecd6");                               // the patent
    rect(4, 23, 4, 11, "#d8c8a0"); rect(40, 23, 4, 11, "#d8c8a0"); rect(5, 23, 2, 11, "#f4ecd6"); rect(41, 23, 2, 11, "#f4ecd6");
    rect(10, 26, 16, 1, C.ink); rect(10, 28, 20, 1, C.ink); rect(10, 30, 12, 1, C.ink);
    ell(35, 29, 2.6, 2.6, angry ? C.yellow : C.red);                                            // seal
    return c;
  }

  // The player's ship: the Percona mountain mark (web/assets/brand/mountain-mark-white.svg), rasterised to pixels.
  const MARK_PATH = "M108.9,139.5l63.5,110.1h-127L108.9,139.5z M178.8,82.2c10.3-4.9,21.8-6,33-3c12.3,3.3,22.6,11.2,29,22.3c12.6,21.8,6,49.4-14.4,63.3L178.8,82.2z M119.3,121.4l30.6-53l0,0l104.5,181.2h-61.2L119.3,121.4z M108.9,103.4L14.2,267.6h271.5l-50.3-87.2c29-18.9,38.4-57.6,20.9-88c-8.8-15.2-23-26.1-40-30.7c-15.7-4.2-32.2-2.5-46.6,4.8l-19.8-34.2L108.9,103.4z";
  // Percona product icons (web/assets/brand/products/*.svg, 1123.51 units square). Only the glyphs are stored: the outline
  // triangle is redrawn as crisp 1 px lines, which a proportional stroke can't survive at 19 px.
  const PRODUCT_ICONS = {
    pmm: "M529.44,662.42L529.44,662.42L773.07,662.42L651.25,451.44L529.44,662.42Z M435.89,555.32L419.17,526.36L340.61,662.42L374.06,662.42L435.89,555.32Z M587.99,516.98L535.5,426.08L399.05,662.42L504.03,662.42L587.99,516.98Z M529.44,683.48L529.44,683.48L773.07,683.48L651.25,894.45L529.44,683.48Z M435.89,790.57L419.17,819.53L340.61,683.48L374.06,683.48L435.89,790.57Z M587.99,828.91L535.5,919.81L399.05,683.48L504.03,683.48L587.99,828.91Z",           // PMM color.svg
    operator: "M285.46,815.31l31.02,82.63h452.56l68.58-82.63H285.46Z M338.58,786.24L485.24,528.52L504.78,562.26L376.93,786.24Z M607.11,706.43L653.19,786.24L801.39,786.24L607.11,449.74L412.83,786.24L561.03,786.24L607.11,706.43Z M471.65,449.74L521.09,535.38L570.54,449.74L471.65,449.74Z", // Percona Operators color.svg
    pxc: "M355.31,798.52L446.37,798.52L401.31,719.55L355.31,798.52Z M287.72,808.89L271.19,834.94L271.19,899.17L332.21,836.75L364.12,864.61L404.64,863.85L357.54,808.89L287.72,808.89Z M668.31,608.9h-103.63l-115.28-47.15,29.15,51.04-112.11,61.96-64.71,111.7h34.92l64.98-111.54,63.62,111.51h66.14l-20,34.32,43.46,76.17,100.45-173.04-28.41-49.66,82.27.19,28.45,49.82h-56.27l-78.13,133.72,23.45,40,64.76-110.43,13.62-.48c36.63,0,126.32-8.48,126.32-45.12,0-65.16-97.9-133.01-163.07-133.01ZM764.38,754.63c0,5.13-4.19,9.32-9.32,9.32h-8.67c-5.13,0-9.32-4.2-9.32-9.32v-8.67c0-5.13,4.19-9.32,9.32-9.32h8.67c5.13,0,9.32,4.19,9.32,9.32v8.67Z",           // Percona for MySQL black.svg (the MySQL icon stands in for PXC)
  };
  function buildIcon(id, css, size = 19) {
    const c = makeCanvas(size, size), x = ctx2d(c), s = size / 1123.51;
    x.save(); x.scale(s, s); x.fill(new Path2D(PRODUCT_ICONS[id])); x.restore();
    const d = x.getImageData(0, 0, size, size), rgb = rgbOf(css);
    for (let i = 0; i < d.data.length; i += 4) { const on = d.data[i + 3] > 90; d.data[i] = rgb[0]; d.data[i + 1] = rgb[1]; d.data[i + 2] = rgb[2]; d.data[i + 3] = on ? 255 : 0; }
    x.putImageData(d, 0, 0);
    const line = (x0, y0, x1, y1) => { const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)); x.fillStyle = css; for (let k = 0; k <= n; k++) x.fillRect(Math.round(lerp(x0, x1, k / n)), Math.round(lerp(y0, y1, k / n)), 1, 1); };
    const ax = Math.floor(size / 2), ay = Math.round(112 * s), by = Math.min(size - 1, Math.round(1011 * s)), lx = Math.round(42 * s), rx = size - 1 - lx;
    line(ax, ay, lx, by); line(ax, ay, rx, by); line(lx, by, rx, by);
    return c;
  }
  let markBox = null;
  function rasterMark(width) {
    const path = new Path2D(MARK_PATH);
    if (!markBox) {
      const c = makeCanvas(300, 300), x = c.getContext("2d", { willReadFrequently: true }); x.fill(path);
      const a = x.getImageData(0, 0, 300, 300).data; let x0 = 300, y0 = 300, x1 = 0, y1 = 0;
      for (let j = 0; j < 300; j++) for (let i = 0; i < 300; i++) if (a[(j * 300 + i) * 4 + 3] > 20) { x0 = Math.min(x0, i); x1 = Math.max(x1, i); y0 = Math.min(y0, j); y1 = Math.max(y1, j); }
      markBox = { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
    }
    const s = width / markBox.w, h = Math.max(1, Math.round(markBox.h * s));
    const c = makeCanvas(width, h), x = c.getContext("2d", { willReadFrequently: true });
    x.scale(s, s); x.translate(-markBox.x, -markBox.y); x.fill(path);
    const d = x.getImageData(0, 0, width, h).data; const a = new Uint8Array(width * h);
    for (let i = 0; i < a.length; i++) a[i] = d[i * 4 + 3];
    return { w: width, h, a };
  }
  function buildMark(tintCss, width) {
    const base = rgbOf(tintCss); const { w, h, a } = rasterMark(width);
    const body = mix(base, [255, 255, 255], 0.12), hi = mix(base, [255, 255, 255], 0.65), sh = mix(base, [0, 0, 0], 0.42);
    const on = (i, j) => i >= 0 && j >= 0 && i < w && j < h && a[j * w + i] > 70;
    const c = makeCanvas(w, h), x = ctx2d(c), img = x.createImageData(w, h);
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const al = a[j * w + i]; if (al <= 70) continue;
      let col = al > 150 ? body : sh;
      if (!on(i, j - 1)) col = hi; else if (!on(i, j + 1) || !on(i + 1, j)) col = sh;
      const p = (j * w + i) * 4; img.data[p] = col[0]; img.data[p + 1] = col[1]; img.data[p + 2] = col[2]; img.data[p + 3] = 255;
    }
    x.putImageData(img, 0, 0); return c;
  }
  const SHIP = { img: null, mini: null, white: null, title: null, titleShadow: null };
  function buildShip(tintCss) {
    let t = rgbOf(tintCss); t = mix(t, [255, 255, 255], 0.2);                   // keep dark guild colours readable on space
    const css = hex(t); SHIP.img = buildMark(css, 17); SHIP.mini = buildMark(css, 9); SHIP.white = silhouette(SHIP.img);
  }

  // Optional local sprites: web/rebels-assets/<id>.png replaces the built-in art for that enemy.
  function loadLocalSprites() {
    const q = location.search;
    if (/[?&]sprites\b/.test(q)) store.set("sprites", true); else if (/[?&]nosprites\b/.test(q)) store.set("sprites", false);
    const inlined = window.REBELS_ASSETS;                                      // set by the single-file build
    if (!inlined && !(LOCAL_SPRITES || store.get("sprites", false))) return;
    [...ENEMIES, ...BOSSES].forEach((t) => {
      const path = `rebels-assets/${t.id}.png`;
      if (inlined && !inlined[path]) return;
      const img = new Image();
      img.onload = () => { t.img = fitImage(img, BOSSES.includes(t) ? 48 : 16); };
      img.onerror = () => {};
      img.src = inlined ? inlined[path] : path;
    });
  }
  // scale a local sprite down once, smoothly (halving steps), so big PNGs and logos stay legible at 16 px
  function fitImage(img, box) {
    const k = Math.min(1, box / img.width, box / img.height); if (k === 1) return img;
    let cur = img, w = img.width, h = img.height;
    const tw = Math.max(1, Math.round(img.width * k)), th = Math.max(1, Math.round(img.height * k));
    while (w / 2 > tw) { const c = makeCanvas(Math.ceil(w / 2), Math.ceil(h / 2)), x = ctx2d(c); x.imageSmoothingQuality = "high"; x.drawImage(cur, 0, 0, w, h, 0, 0, c.width, c.height); cur = c; w = c.width; h = c.height; }
    const out = makeCanvas(tw, th), x = ctx2d(out); x.imageSmoothingQuality = "high"; x.drawImage(cur, 0, 0, w, h, 0, 0, tw, th);
    return out;
  }
  function drawType(t, frame, x, y, white, box = 16, alt = false) {
    if (t.img) {
      const k = Math.min(1, box / t.img.width, box / t.img.height), w = Math.max(1, Math.round(t.img.width * k)), h = Math.max(1, Math.round(t.img.height * k));
      if (white) g.globalAlpha = 0.45;
      g.drawImage(t.img, Math.round(x - w / 2), Math.round(y - h / 2), w, h); g.globalAlpha = 1; return;
    }
    const set = alt && t.frames2 ? (white ? t.white2 : t.frames2) : white ? t.white : t.frames;
    const img = set[frame % set.length];
    g.drawImage(img, Math.round(x - img.width / 2), Math.round(y - img.height / 2));
  }

  /* ================================================================== audio: everything synthesised */
  const AU = {
    ctx: null, out: null, sfx: null, mus: null, noise: null, muted: store.get("muted", false),
    unlock() {
      if (this.ctx) { if (this.ctx.state === "suspended") this.ctx.resume().catch(() => {}); return; }
      const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
      try {
        const c = (this.ctx = new AC());
        this.out = c.createGain(); this.out.gain.value = this.muted ? 0 : 0.7;
        const comp = c.createDynamicsCompressor(); this.out.connect(comp).connect(c.destination);
        this.sfx = c.createGain(); this.sfx.gain.value = 0.9; this.sfx.connect(this.out);
        this.mus = c.createGain(); this.mus.gain.value = 0.32; this.mus.connect(this.out);
        const len = c.sampleRate; const b = c.createBuffer(1, len, c.sampleRate); const d = b.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
        this.noise = b;
      } catch { this.ctx = null; }
    },
    get ok() { return !!this.ctx && !this.muted; },
    setMuted(m) { this.muted = m; store.set("muted", m); if (this.out) this.out.gain.setTargetAtTime(m ? 0 : 0.7, this.ctx.currentTime, 0.02); },
    tone(f, dur, { type = "square", vol = 0.1, to = null, at = 0, bus = null } = {}) {
      if (!this.ok) return;
      try {
        const c = this.ctx, t = c.currentTime + at, o = c.createOscillator(), gn = c.createGain();
        o.type = type; o.frequency.setValueAtTime(f, t); if (to) o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
        gn.gain.setValueAtTime(vol, t); gn.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(gn).connect(bus || this.sfx); o.start(t); o.stop(t + dur + 0.02);
      } catch { /* ignore */ }
    },
    hiss(dur, { vol = 0.2, f = 2000, to = null, q = 0.8, at = 0, type = "lowpass" } = {}) {
      if (!this.ok) return;
      try {
        const c = this.ctx, t = c.currentTime + at, s = c.createBufferSource(), fl = c.createBiquadFilter(), gn = c.createGain();
        s.buffer = this.noise; s.loop = true; fl.type = type; fl.frequency.setValueAtTime(f, t); if (to) fl.frequency.exponentialRampToValueAtTime(Math.max(40, to), t + dur); fl.Q.value = q;
        gn.gain.setValueAtTime(vol, t); gn.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        s.connect(fl).connect(gn).connect(this.sfx); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
      } catch { /* ignore */ }
    },
    laser(spread) { this.tone(1500, 0.09, { vol: 0.045, to: 320 }); if (spread) this.tone(2000, 0.07, { type: "sawtooth", vol: 0.02, to: 600 }); },
    eshot() { this.tone(560, 0.12, { type: "triangle", vol: 0.05, to: 170 }); },
    boom(big) { this.hiss(big ? 0.9 : 0.32, { vol: big ? 0.42 : 0.22, f: big ? 1800 : 3200, to: 80 }); this.tone(big ? 90 : 170, big ? 0.6 : 0.18, { type: "sine", vol: big ? 0.3 : 0.1, to: 30 }); },
    clink() { this.tone(950, 0.04, { vol: 0.035, to: 620 }); },
    power() { [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone(f, 0.09, { vol: 0.06, at: i * 0.055 })); },
    oneUp() { [784, 988, 1175, 1568, 1175, 1568].forEach((f, i) => this.tone(f, 0.1, { vol: 0.07, at: i * 0.08, type: "triangle" })); },
    coin() { this.tone(988, 0.08, { vol: 0.08 }); this.tone(1319, 0.35, { vol: 0.08, at: 0.08 }); },
    death() { this.hiss(1.2, { vol: 0.38, f: 1200, to: 60 }); [440, 330, 247, 165].forEach((f, i) => this.tone(f, 0.22, { type: "sawtooth", vol: 0.05, at: i * 0.14, to: f * 0.7 })); },
    shield() { this.tone(300, 0.3, { type: "sawtooth", vol: 0.07, to: 1200 }); },
    bomb() { this.hiss(1.4, { vol: 0.5, f: 4000, to: 60 }); this.tone(60, 1, { type: "sine", vol: 0.35, to: 25 }); },
    dive() { this.tone(1200, 0.35, { type: "triangle", vol: 0.02, to: 420 }); },
    siren() { for (let i = 0; i < 4; i++) { this.tone(440, 0.25, { type: "sawtooth", vol: 0.05, to: 880, at: i * 0.5 }); this.tone(880, 0.25, { type: "sawtooth", vol: 0.05, to: 440, at: i * 0.5 + 0.25 }); } },
    combo() { this.tone(660, 0.06, { vol: 0.05 }); this.tone(990, 0.1, { vol: 0.05, at: 0.06 }); },
    start() { [523, 659, 784, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.12, { vol: 0.07, at: i * 0.1 })); },
    blip(f = 880) { this.tone(f, 0.05, { vol: 0.05 }); },
    charge() { this.tone(200, 1.0, { type: "sawtooth", vol: 0.04, to: 1600 }); },
    zap() { this.hiss(0.7, { vol: 0.28, f: 6000, to: 800, type: "bandpass", q: 2 }); this.tone(110, 0.7, { vol: 0.05 }); },
    clear() { [659, 784, 988, 1319].forEach((f, i) => this.tone(f, 0.14, { vol: 0.07, at: i * 0.12, type: "triangle" })); },
    over() { [392, 349, 311, 262].forEach((f, i) => this.tone(f, 0.32, { type: "triangle", vol: 0.08, at: i * 0.28 })); },
  };
  // A four-bar chiptune loop: square lead, triangle bass, noise drums. The boss gets it faster and lower.
  const Music = {
    lead: [69, 0, 72, 0, 76, 0, 81, 0, 79, 0, 76, 0, 72, 0, 74, 0, 72, 0, 77, 0, 81, 0, 77, 0, 76, 0, 72, 0, 69, 0, 72, 0,
      71, 0, 74, 0, 79, 0, 83, 0, 81, 0, 79, 0, 74, 0, 71, 0, 76, 0, 0, 0, 80, 0, 83, 0, 0, 0, 81, 0, 80, 0, 76, 0],
    bass: [45, 45, 57, 45, 45, 45, 57, 45, 41, 41, 53, 41, 41, 41, 53, 41, 43, 43, 55, 43, 43, 43, 55, 43, 40, 40, 52, 40, 40, 40, 52, 44],
    on: false, boss: false, step: 0, next: 0, timer: null,
    start(boss) {
      if (!AU.ctx) return;
      if (this.on && this.boss === boss) return;
      this.boss = boss; this.on = true; this.step = 0; this.next = AU.ctx.currentTime + 0.06;
      if (!this.timer) this.timer = setInterval(() => this.pump(), 25);
    },
    stop() { this.on = false; if (this.timer) clearInterval(this.timer); this.timer = null; },
    pump() {
      if (!this.on || !AU.ctx) return;
      const c = AU.ctx, s16 = 60 / (144 * (this.boss ? 1.14 : 1)) / 4;
      if (this.next < c.currentTime - 0.2) this.next = c.currentTime + 0.02;   // tab was asleep
      while (this.next < c.currentTime + 0.12) { this.play(this.step, this.next, s16); this.next += s16; this.step = (this.step + 1) % 64; }
    },
    note(m, t, dur, type, vol) {
      const c = AU.ctx, o = c.createOscillator(), gn = c.createGain();
      o.type = type; o.frequency.setValueAtTime(440 * Math.pow(2, (m - 69) / 12), t);
      gn.gain.setValueAtTime(0.0001, t); gn.gain.linearRampToValueAtTime(vol, t + 0.005); gn.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(gn).connect(AU.mus); o.start(t); o.stop(t + dur + 0.02);
    },
    drum(t, kind) {
      const c = AU.ctx;
      if (kind === "kick") { const o = c.createOscillator(), gn = c.createGain(); o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.12); gn.gain.setValueAtTime(0.5, t); gn.gain.exponentialRampToValueAtTime(0.0001, t + 0.14); o.connect(gn).connect(AU.mus); o.start(t); o.stop(t + 0.16); return; }
      const s = c.createBufferSource(), fl = c.createBiquadFilter(), gn = c.createGain(); s.buffer = AU.noise;
      fl.type = kind === "hat" ? "highpass" : "bandpass"; fl.frequency.value = kind === "hat" ? 7000 : 1800;
      const dur = kind === "hat" ? 0.03 : 0.12; gn.gain.setValueAtTime(kind === "hat" ? 0.08 : 0.25, t); gn.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      s.connect(fl).connect(gn).connect(AU.mus); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
    },
    play(i, t, s16) {
      if (AU.muted) return;
      try {
        const tr = this.boss ? -3 : 0;
        if (this.lead[i]) this.note(this.lead[i] + tr, t, s16 * 1.7, "square", 0.045);
        if (i % 2 === 0 && this.bass[i / 2]) this.note(this.bass[i / 2] + tr, t, s16 * 1.8, "triangle", 0.16);
        if (i % 8 === 0) this.drum(t, "kick"); else if (i % 8 === 4) this.drum(t, "snare");
        if (i % 2 === 1) this.drum(t, "hat");
      } catch { /* ignore */ }
    },
  };

  /* ================================================================== CRT filter: WebGL when it can, CSS otherwise */
  const CRT = {
    gl: null, ok: false, tried: false, loc: null,
    init() {
      this.tried = true;
      try {
        const gl = crtCanvas.getContext("webgl", { antialias: false, premultipliedAlpha: false, preserveDrawingBuffer: false });
        if (!gl) return false;
        const vs = "attribute vec2 a;varying vec2 v;void main(){v=a*0.5+0.5;gl_Position=vec4(a,0.0,1.0);}";
        const fs = `precision mediump float;varying vec2 v;uniform sampler2D t;uniform vec2 src;
          vec2 warp(vec2 p){p=p*2.0-1.0;p*=1.0+vec2(p.y*p.y*0.035,p.x*p.x*0.05);return p*0.5+0.5;}
          void main(){vec2 p=warp(v);
            if(p.x<0.0||p.x>1.0||p.y<0.0||p.y>1.0){gl_FragColor=vec4(0.0,0.0,0.0,1.0);return;}
            vec2 px=1.0/src;vec3 c=texture2D(t,p).rgb;
            vec3 gl2=texture2D(t,p+vec2(px.x,0.0)).rgb+texture2D(t,p-vec2(px.x,0.0)).rgb+texture2D(t,p+vec2(0.0,px.y)).rgb+texture2D(t,p-vec2(0.0,px.y)).rgb;
            c+=gl2*0.07;
            float row=fract(p.y*src.y);float scan=0.68+0.32*smoothstep(0.0,0.3,row)*smoothstep(1.0,0.7,row);c*=scan;
            float m=mod(gl_FragCoord.x,3.0);c*=m<1.0?vec3(1.0,0.92,0.92):m<2.0?vec3(0.92,1.0,0.92):vec3(0.92,0.92,1.0);
            vec2 q=p*(1.0-p.yx);c*=pow(q.x*q.y*16.0,0.2)*1.14;
            gl_FragColor=vec4(c,1.0);}`;
        const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error("shader"); return s; };
        const prog = gl.createProgram(); gl.attachShader(prog, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(prog);
        if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error("link");
        gl.useProgram(prog);
        const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
        const a = gl.getAttribLocation(prog, "a"); gl.enableVertexAttribArray(a); gl.vertexAttribPointer(a, 2, gl.FLOAT, false, 0, 0);
        const tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
        gl.uniform2f(gl.getUniformLocation(prog, "src"), W, H);
        this.gl = gl; this.ok = true;
      } catch { this.ok = false; }
      return this.ok;
    },
    draw() {
      const gl = this.gl;
      gl.viewport(0, 0, crtCanvas.width, crtCanvas.height);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, buf);   // throws on a tainted canvas (file:// images) → CSS fallback
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    },
  };
  function applyCrt() {
    if (G.crt && !CRT.tried) CRT.init();
    const gpu = G.crt && CRT.ok;
    crtCanvas.hidden = !gpu; view.hidden = gpu;
    stage.classList.toggle("crt-css", G.crt && !gpu);
  }
  function present() {
    if (G.crt && CRT.ok) {
      try { CRT.draw(); return; } catch { CRT.ok = false; applyCrt(); }
    }
    vctx.imageSmoothingEnabled = false; vctx.drawImage(buf, 0, 0, view.width, view.height);
  }
  function resize() {
    const dpr = window.devicePixelRatio || 1;
    const hintsH = document.body.classList.contains("touch") || innerHeight < 560 ? 12 : 44;
    const availW = Math.max(100, innerWidth - 16), availH = Math.max(100, innerHeight - hintsH - 12);
    let scale = Math.floor(Math.min((availW * dpr) / W, (availH * dpr) / H));        // integer scale in device pixels
    if (scale < 1) scale = Math.min((availW * dpr) / W, (availH * dpr) / H);
    const dw = Math.round(W * scale), dh = Math.round(H * scale);
    for (const c of [view, crtCanvas]) { c.width = dw; c.height = dh; }
    stage.style.width = dw / dpr + "px"; stage.style.height = dh / dpr + "px";
    stage.style.setProperty("--px", scale / dpr + "px");
    stage.style.marginTop = -(hintsH - 12) / 2 + "px";
  }

  /* ================================================================== state */
  const G = {
    mode: "attract", t: 0, attract: { i: 0, t: 0 }, credits: 0, paused: false, pauseEsc: false, world: null, demo: null, demoCount: 0,
    pilot: null, crt: store.get("crt", true), toast: null, scores: [], lastEntry: -1, over: null, ini: null, scoresT: 0, touch: false, warp: 1, stars: [],
  };
  function loadScores() {
    let s = store.get("scores", null);
    if (!Array.isArray(s) || !s.length) s = DEFAULT_SCORES.map(([n, sc, w]) => ({ n, s: sc, w }));
    G.scores = s.filter((x) => x && typeof x.s === "number").sort((a, b) => b.s - a.s).slice(0, 10);
  }
  const hiScore = () => Math.max(G.scores[0]?.s || 0, G.world && !G.world.demo ? G.world.score : 0);
  function toast(msg) { G.toast = { msg, t: 0 }; }

  /* ================================================================== stars */
  function seedStars() {
    const cols = [C.white, C.white, C.lilac, "#6f6b7d", C.yellow, "#4aa3ff"];
    G.stars = Array.from({ length: 90 }, (_, i) => ({ x: rnd(W), y: rnd(H), l: i % 3, c: pick(cols), tw: rnd(6) }));
  }
  function updateStars(dt) {
    const target = G.mode === "game" && G.world && (G.world.phase === "intro" || G.world.phase === "clear") ? (reduced ? 1.6 : 5) : 1;
    G.warp = lerp(G.warp, target, Math.min(1, dt * 2.5));
    for (const s of G.stars) { s.y += [7, 18, 40][s.l] * G.warp * dt; if (s.y > H) { s.y -= H; s.x = rnd(W); } }
  }
  function drawStars() {
    for (const s of G.stars) {
      if (s.l === 0 && Math.sin(G.t * 3 + s.tw) < -0.6) continue;
      g.fillStyle = s.c; g.globalAlpha = [0.45, 0.7, 1][s.l];
      const len = G.warp > 1.5 && s.l > 0 ? Math.round(G.warp * s.l) : 1;
      g.fillRect(Math.round(s.x), Math.round(s.y), 1, len);
    }
    g.globalAlpha = 1;
  }

  /* ================================================================== world */
  function newWorld(demo) {
    return {
      demo, score: 0, lives: demo ? 3 : RULES.startLives, wave: 0, nextLife: RULES.extraLifeEvery, t: 0,
      phase: "intro", phaseT: 0, spawnT: 0, isBoss: false, featured: [],
      enemies: [], queue: [], ebul: [], pbul: [], parts: [], pops: [], pups: [], wing: [], boss: null, beam: null,
      form: { t: 0, mix: 0, top: 46, cols: 8 }, diveT: 3, fx: { pmm: 0, pxc: 0, op: 0, shield: false },
      streak: 0, streakT: 0, mult: 1, shots: 0, hits: 0, kills: 0, deathsThisWave: 0,
      p: { x: W / 2, y: H - 34, alive: true, inv: 0, cd: 0, deadT: 0 }, shake: 0, flash: 0, banner: null,
    };
  }
  const sfx = (w, fn, ...a) => { if (!w.demo) AU[fn](...a); };
  function diff(w) {
    const n = w.wave;
    return {
      diveEvery: Math.max(0.55, 2.6 - n * 0.16), maxDivers: Math.min(7, 1 + Math.floor(n / 1.5)), dive: Math.min(1.85, 0.85 + n * 0.06),
      bullet: Math.min(150, 72 + n * 5), formFire: Math.min(1.6, 0.25 + n * 0.09), diveShots: n < 2 ? 1 : n < 5 ? 2 : 3, escorts: n >= 4, entry: Math.max(1.6, 2.2 - n * 0.03),
    };
  }
  function banner(w, textMain, sub = "", dur = 1.8, color = C.yellow) { w.banner = { text: textMain, sub, t: 0, dur, color }; }
  function popup(w, x, y, s, big = false) { w.pops.push({ x, y, s: String(s), t: 0, big }); }
  function explode(w, x, y, colors, n = 16, speed = 90) {
    n = Math.round(n * (reduced ? 0.6 : 1));
    for (let i = 0; i < n; i++) { const a = rnd(Math.PI * 2), sp = rnd(speed * 0.2, speed); const life = rnd(0.3, 0.75); w.parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life, max: life, c: pick(colors), s: Math.random() < 0.25 ? 2 : 1 }); }
    w.parts.push({ ring: true, x, y, r: 1, life: 0.28, max: 0.28, c: colors[0] });
  }
  function shake(w, amount) { w.shake = Math.max(w.shake, amount); }

  function startWave(w) {
    w.wave++; w.phase = "intro"; w.phaseT = 0; w.spawnT = 0; w.enemies = []; w.queue = []; w.boss = null; w.beam = null;
    w.form.mix = 0; w.form.t = 0; w.deathsThisWave = 0; w.diveT = 3;
    w.isBoss = w.wave % RULES.bossEvery === 0;
    if (w.isBoss) { w.featured = [bossFor(w.wave)]; sfx(w, "siren"); } else buildFormation(w);
    if (!w.demo) Music.start(w.isBoss);
  }
  function buildFormation(w) {
    const n = w.wave, L = ENEMIES.length, k = n - 1 - Math.floor((n - 1) / RULES.bossEvery);
    const A = ENEMIES[(2 * k) % L], B = ENEMIES[(2 * k + 1) % L];
    const top = A.hp >= B.hp ? A : B, bottom = top === A ? B : A;
    const extra = k >= Math.ceil(L / 2) ? ENEMIES[(2 * k + 2) % L] : null;
    const rows = n === 1 ? 3 : n === 2 ? 4 : 5;
    const types = []; for (let r = 0; r < rows; r++) types.push(r === 0 && extra ? extra : r < (rows >= 4 ? 2 : 1) ? top : bottom);
    w.featured = [...new Set(types)]; w.form.rows = rows;
    const d = diff(w); let at = 0;
    for (let r = 0; r < rows; r++) {
      for (const side of [-1, 1]) {
        const cols = side < 0 ? [3, 2, 1, 0] : [4, 5, 6, 7];
        cols.forEach((col, i) => w.queue.push({ at: at + i * 0.14, e: mkEnemy(w, types[r], r, col), path: r % 3, side, dur: d.entry }));
      }
      at += 1.2;
    }
    w.queue.sort((a, b) => a.at - b.at);
  }
  function mkEnemy(w, type, row, col) { const hp = type.hp + Math.floor((w.wave - 1) / 10); return { type, hp, row, col, x: -40, y: -40, state: "wait", t: 0, flash: 0, fired: 0, fireAt: [] }; }
  function slotPos(w, e) {
    const f = w.form, sway = (1 - f.mix) * 16 * Math.sin(f.t * 0.8), br = 1 + f.mix * 0.075 * (0.5 - 0.5 * Math.cos(f.t * 1.7));
    return { x: W / 2 + sway + (e.col - (f.cols - 1) / 2) * 16 * br, y: f.top + e.row * 13 * (1 + (br - 1) * 0.6) };
  }
  function entryPoints(id, s) {
    if (id === 0) return [W / 2 + s * 12, -16, W / 2 + s * 12, H * 0.5, W / 2 + s * 104, H * 0.56];
    if (id === 1) return [W / 2 + s * (W / 2 + 14), H * 0.74, W / 2 - s * 50, H * 0.62, W / 2 - s * 20, H * 0.18];
    return [W / 2 + s * (W / 2 + 14), -12, W / 2 - s * 70, H * 0.34, W / 2 + s * 90, H * 0.52];
  }
  function spawn(w, q) { const e = q.e; e.state = "enter"; e.t = 0; e.pts = entryPoints(q.path, q.side); e.dur = q.dur; e.willFire = w.wave >= 3 && Math.random() < 0.15; w.enemies.push(e); }

  const DIVE_DUR = { swoop: 2.4, dive: 1.7, zigzag: 3.0, loop: 3.3, spiral: 3.4 };
  function divePos(e, t) {
    const pat = DIVE_DUR[e.pattern] ? e.pattern : "swoop", D = DIVE_DUR[pat], k = Math.min(1, (t * e.spd) / D);
    const { sx, sy, tx, dir } = e, ey = H + 24; let x, y;
    switch (pat) {
      case "swoop": x = bez(sx, sx + dir * 50, tx - dir * 70, tx + dir * 30, k); y = bez(sy, sy - 34, H * 0.78, ey, k); break;
      case "dive": x = bez(sx, sx + dir * 26, tx, tx, k); y = bez(sy, sy - 26, sy + 60, ey, k); break;
      case "zigzag": x = lerp(sx, tx, k) + 28 * Math.sin(k * Math.PI * 4) * Math.min(1, k * 5); y = lerp(sy, ey, k) - 18 * Math.sin(Math.min(1, k * 5) * Math.PI); break;
      case "loop": {
        const Lx = clamp(lerp(sx, tx, 0.5), 30, W - 30), Ly = H * 0.48, r = 20;
        if (k < 0.33) { const q = k / 0.33; x = bez(sx, sx + dir * 30, Lx, Lx, q); y = bez(sy, sy - 24, Ly - r - 30, Ly - r, q); }
        else if (k < 0.66) { const a = -Math.PI / 2 + dir * ((k - 0.33) / 0.33) * Math.PI * 2; x = Lx + r * Math.cos(a); y = Ly + r * Math.sin(a); }
        else { const q = (k - 0.66) / 0.34; x = bez(Lx, Lx + dir * 20, tx, tx, q); y = bez(Ly - r, Ly - r + 20, H * 0.8, ey, q); }
        break;
      }
      case "spiral": { const r = 6 + 20 * k, a = k * D * 6 * dir; x = lerp(sx, tx, k) + r * Math.cos(a) - 6; y = lerp(sy, ey, k) + r * Math.sin(a) * 0.5; break; }
    }
    return { x, y, k, done: k >= 1 };
  }
  function telegraph(w, e, lead, i) {
    const d = diff(w); const s = slotPos(w, e);
    e.state = "tele"; e.t = 0; e.tx = clamp(w.p.x + rnd(-24, 24), 12, W - 12); e.dir = s.x < W / 2 ? -1 : 1; e.pattern = e.type.pattern; e.spd = d.dive;
    if (lead) { e.tx = clamp(lead.tx + (i ? 12 : -12), 12, W - 12); e.pattern = lead.pattern; e.dir = lead.dir; e.t = -0.14 * (i + 1); }
  }
  function beginDive(w, e) {
    const d = diff(w); e.state = "dive"; e.t = 0; e.sx = e.x; e.sy = e.y; e.fired = 0;
    e.fireAt = [0.2, 0.28, 0.42, 0.56].slice(e.type.ability === "flip" ? 0 : 1, 1 + d.diveShots); sfx(w, "dive");   // the Relicenser saves its shots for the dive
  }
  // an enemy's shot: Surprise Audit fires paperwork that jams your guns instead of killing you
  function enemyShot(w, e, opts = {}) { eShoot(w, e.x, e.y + 5, { ...opts, kind: e.type.ability === "jam" ? "j" : opts.kind || "s", speed: e.type.ability === "jam" ? 60 : opts.speed }); sfx(w, "eshot"); }
  function launchDives(w, dt, d) {
    if (!w.p.alive) return;
    w.diveT -= dt; if (w.diveT > 0) return;
    const busy = w.enemies.filter((e) => e.state === "dive" || e.state === "tele").length;
    const cands = w.enemies.filter((e) => e.state === "form");
    if (busy >= d.maxDivers || !cands.length) { w.diveT = 0.3; return; }
    const lead = pick(cands); telegraph(w, lead);
    if (d.escorts && Math.random() < 0.45) cands.filter((e) => e !== lead && e.row === lead.row + 1 && Math.abs(e.col - lead.col) <= 1).slice(0, 2).forEach((e, i) => telegraph(w, e, lead, i));
    w.diveT = d.diveEvery * rnd(0.7, 1.3);
  }
  function eShoot(w, x, y, { aim = true, speed, angle = 0, kind = "s" } = {}) {
    const s = speed || diff(w).bullet; let vx = 0, vy = s;
    if (aim) { const dx = w.p.x - x, dy = Math.max(30, w.p.y - y), L = Math.hypot(dx, dy); vx = clamp((dx / L) * s, -s * 0.45, s * 0.45); vy = Math.sqrt(s * s - vx * vx); }
    if (angle) { const c = Math.cos(angle), sn = Math.sin(angle); [vx, vy] = [vx * c - vy * sn, vx * sn + vy * c]; }
    w.ebul.push({ x, y, vx, vy, kind });
  }
  function formationFire(w, dt, d) {
    if (!w.p.alive || Math.random() > d.formFire * dt) return;
    const near = w.enemies.filter((e) => e.state === "form" && e.type.ability !== "flip" && Math.abs(e.x - w.p.x) < 44);
    if (!near.length) return;
    const e = near.reduce((a, b) => (b.row > a.row ? b : a)); enemyShot(w, e, { aim: Math.random() < 0.5 });
  }
  function updateEnemies(w, dt, d) {
    for (const e of w.enemies) {
      if (e.dead) continue;
      e.t += dt; e.flash = Math.max(0, e.flash - dt);
      if (e.state === "enter") {
        const k = Math.min(1, e.t / e.dur), s = slotPos(w, e), p = e.pts;
        e.x = bez(p[0], p[2], p[4], s.x, k); e.y = bez(p[1], p[3], p[5], s.y, k);
        if (e.willFire && k > 0.45 && w.p.alive && e.y > 0 && e.type.ability !== "flip") { e.willFire = false; enemyShot(w, e); }
        if (k >= 1) { e.state = "form"; e.t = 0; }
      } else if (e.state === "form") {
        const s = slotPos(w, e); e.x = s.x; e.y = s.y;
      } else if (e.state === "tele") {
        const s = slotPos(w, e); e.x = s.x + (e.t > 0 ? Math.round(Math.sin(e.t * 45)) : 0); e.y = s.y;
        if (e.t >= 0.6) beginDive(w, e);
      } else if (e.state === "dive") {
        const r = divePos(e, e.t); e.x = r.x; e.y = r.y;
        if (e.fired < e.fireAt.length && r.k >= e.fireAt[e.fired]) { e.fired++; if (w.p.alive && e.y < w.p.y - 24 && e.y > 0) enemyShot(w, e); }
        if (e.type.ability === "drain" && w.p.alive && e.y > 0 && e.y < H && !w.demo) {                       // Egress Fee: your score leaks while it dives
          e.drain = (e.drain || 0) + dt;
          if (e.drain >= 0.25) { e.drain -= 0.25; w.score = Math.max(0, w.score - 10); e.drained = (e.drained || 0) + 10; if (e.drained % 50 === 0) popup(w, e.x, e.y - 8, "-" + e.drained); }
        }
        if (r.done || e.y > H + 20) { if (e.minion) e.dead = true; else { e.state = "return"; e.t = 0; e.rx = slotPos(w, e).x; e.y = -12; } }
      } else if (e.state === "return") {
        const k = Math.min(1, e.t / 1.1), s = slotPos(w, e), q = easeOut(k);
        e.x = lerp(e.rx, s.x, q); e.y = lerp(-12, s.y, q);
        if (k >= 1) { e.state = "form"; e.t = 0; }
      }
    }
  }

  /* --- boss */
  function spawnBoss(w) {
    const n = Math.max(1, Math.floor(w.wave / RULES.bossEvery)), def = bossFor(w.wave), loop = Math.floor((n - 1) / BOSSES.length), hp = Math.round(def.hp * (1 + 0.5 * loop));
    w.boss = { def, x: W / 2, y: -30, hp, max: hp, phase: 1, state: "enter", t: 0, mt: 0, flash: 0, inv: 0, n, dying: 0, at: { aim: 1.6, can: 2.4, min: 3.5, ring: 3, beam: 5.5, spin: 0 }, spin: 0 };
  }
  function damageBoss(w, dmg, x, y) {
    const b = w.boss; if (!b || b.state !== "fight") return;
    if (b.inv > 0) { explode(w, x, y, [C.white, C.lilac], 3, 30); return; }
    b.hp -= dmg; b.flash = 0.06; sfx(w, "clink");
    if (b.hp <= 0) {
      b.hp = 0; b.state = "dying"; b.dying = 0; w.ebul = []; w.beam = null;
      w.enemies.forEach((e) => { if (e.minion && !e.dead) { e.dead = true; explode(w, e.x, e.y, [e.type.pal.a, e.type.pal.l], 10); } });
      sfx(w, "boom", true); shake(w, 8);
    }
  }
  function updateBoss(w, dt) {
    const b = w.boss; b.t += dt; b.flash = Math.max(0, b.flash - dt); b.inv = Math.max(0, b.inv - dt);
    const def = b.def, troll = def.style === "troll";
    if (b.state === "enter") { b.y = lerp(-30, 64, easeOut(Math.min(1, b.t / 2.5))); if (b.t >= 2.5) { b.state = "fight"; b.t = 0; banner(w, def.name.toUpperCase(), def.intro, 1.8, C.red); } return; }
    if (b.state === "dying") {
      b.dying += dt; shake(w, 3);
      if (Math.random() < dt * 14) { explode(w, b.x + rnd(-20, 20), b.y + rnd(-14, 14), [def.pal.l, C.yellow, C.orange, C.white], 12, 70); sfx(w, "boom", false); }
      if (b.dying > 2.4) {
        explode(w, b.x, b.y, [C.yellow, C.white, C.orange, C.purple, def.pal.l], 70, 150); shake(w, 12); w.flash = 1; sfx(w, "boom", true);
        const pts = def.points * (1 + Math.floor((b.n - 1) / BOSSES.length)); addScore(w, pts); popup(w, b.x, b.y, pts, true); w.kills++;
        banner(w, def.win[0], def.win[1], 2.4, C.yellow); w.banner.hold = true; w.boss = null;   // the wave clear waits for this
      }
      return;
    }
    const ratio = b.hp / b.max, ph = ratio > 0.66 ? 1 : ratio > 0.33 ? 2 : 3;
    if (ph !== b.phase) {
      b.phase = ph; b.inv = 1; shake(w, 6); w.ebul = []; w.beam = null; sfx(w, "siren");
      const [t1, t2] = ph === 2 ? def.phase2 : def.phase3; banner(w, t1, t2, 1.8, ph === 2 ? C.red : C.yellow);
    }
    const frozen = w.beam && w.beam.t < w.beam.tele + w.beam.dur;
    if (!frozen) b.mt += dt * (ph === 3 ? 1.7 : ph === 2 ? 1.2 : 1);
    b.x = W / 2 + Math.sin(b.mt * 0.55) * (W / 2 - 32); b.y = 64 + Math.sin(b.t * 1.3) * 4;
    if (!w.p.alive || b.inv > 0) return;
    const at = b.at, keyY = b.y + 5;
    for (const k in at) at[k] -= dt;
    if (troll) {
      // patent scrolls drift as they fall; "claims" fan out; phase 3 is a litigation storm from above
      if (at.aim <= 0) { at.aim = ph === 3 ? 1.0 : 1.3; [-0.12, 0.12].forEach((a) => eShoot(w, b.x, b.y + 4, { angle: a, kind: "p", speed: 85 })); sfx(w, "eshot"); }
      if (at.can <= 0 && ph < 3) { at.can = 2.6; [-0.5, -0.25, 0, 0.25, 0.5].forEach((a) => eShoot(w, b.x, b.y + 12, { aim: false, angle: a, kind: "p", speed: 70 })); }
      if (ph === 3 && at.spin <= 0) { at.spin = 0.16; w.ebul.push({ x: rnd(12, W - 12), y: 40, vx: 0, vy: rnd(45, 70), kind: "p" }); }
    } else {
      if (at.aim <= 0) { at.aim = ph === 3 ? 1.1 : 1.5; [-0.22, 0, 0.22].forEach((a) => eShoot(w, b.x, keyY, { angle: a, kind: "o" })); sfx(w, "eshot"); }
      if (at.can <= 0 && ph < 3) { at.can = 2.4; [-21, 21].forEach((dx) => { eShoot(w, b.x + dx, b.y + 16, { aim: false, speed: 130 }); eShoot(w, b.x + dx, b.y + 10, { aim: false, speed: 130 }); }); }
    }
    if (ph >= 2 && at.min <= 0) {
      at.min = (ph === 3 ? 6 : 4.5) * (troll ? 0.8 : 1);
      [-1, 1].forEach((side) => {
        const type = pick(ENEMIES); const e = mkEnemy(w, type, 0, 0);
        Object.assign(e, { minion: true, state: "dive", t: 0, sx: b.x + side * 20, sy: b.y + 8, x: b.x + side * 20, y: b.y + 8, tx: clamp(w.p.x + side * 20, 12, W - 12), dir: side, pattern: type.pattern, spd: diff(w).dive, fireAt: [0.35], fired: 0, hp: type.hp });
        w.enemies.push(e);
      });
    }
    if (ph === 2 && at.ring <= 0 && !troll) { at.ring = 3.2; const off = rnd(1); for (let i = 0; i < 10; i++) { const a = ((i + off) / 10) * Math.PI * 2; w.ebul.push({ x: b.x, y: keyY, vx: Math.cos(a) * 60, vy: Math.sin(a) * 60 + 20, kind: "o" }); } }
    if (ph >= 2 && at.beam <= 0 && !w.beam) { at.beam = ph === 3 ? 7 : 6; w.beam = { side: troll ? 0 : Math.random() < 0.5 ? -1 : 1, t: 0, tele: 1, dur: 0.7, zapped: false }; sfx(w, "charge"); }
    if (ph === 3 && at.spin <= 0 && !troll) { at.spin = 0.12; b.spin += 0.45; for (const arm of [0, Math.PI]) { const a = b.spin + arm; w.ebul.push({ x: b.x, y: keyY, vx: Math.cos(a) * 70, vy: Math.abs(Math.sin(a)) * 50 + 35, kind: "o" }); } }
  }
  function beamX(w) { return w.boss ? w.boss.x + w.beam.side * 21 : -99; }

  /* --- scoring, damage, power-ups */
  function addScore(w, pts) {
    w.score += pts;
    if (w.demo) return;
    while (w.score >= w.nextLife) { w.nextLife += RULES.extraLifeEvery; if (w.lives < RULES.maxLives) { w.lives++; banner(w, "1UP!", "EXTRA LIFE", 1.8, C.teal); AU.oneUp(); } }
  }
  function killEnemy(w, e, bomb = false) {
    e.dead = true; w.kills++;
    const diving = e.state === "dive" || e.state === "tele" || e.minion;
    w.streak++; w.streakT = RULES.comboWindow;
    const m = Math.min(RULES.maxCombo, 1 + Math.floor(w.streak / RULES.comboStep));
    if (m > w.mult) { w.mult = m; if (!w.demo) { popup(w, W / 2, 34, `COMBO X${m}`); AU.combo(); } }
    const pts = e.type.points * (diving ? 2 : 1) * w.mult; addScore(w, pts);
    if (diving || w.mult > 1) popup(w, e.x, e.y - 4, pts);
    explode(w, e.x, e.y, [e.type.pal.a, e.type.pal.l, C.white, C.yellow], 16); shake(w, 1.5); sfx(w, "boom", false);
    const ab = e.type.ability;
    if (ab === "renew" && !e.renewed && !e.minion && !bomb) {                                                // Auto-Renewal: back for another term
      Object.assign(e, { dead: false, renewed: true, hp: e.type.hp, state: "return", t: 0, rx: slotPos(w, e).x, y: -12, flash: 0 }); w.kills--;
      popup(w, e.x, 40, "RENEWED!");
      return;
    }
    if (ab === "split" && e.type.child) {                                                                    // Core Tax: two cores for the price of one
      [-1, 1].forEach((side) => { const c = mkEnemy(w, e.type.child, 0, 0); Object.assign(c, { minion: true, state: "dive", t: 0, sx: e.x + side * 4, sy: e.y, x: e.x + side * 4, y: e.y, tx: clamp(w.p.x + side * 24, 12, W - 12), dir: side, pattern: "dive", spd: diff(w).dive * 1.1, fireAt: [], fired: 0, hp: 1 }); w.enemies.push(c); });
    }
    if (w.pups.length < 2 && Math.random() < RULES.dropChance + 0.02 * e.type.hp) {
      const total = POWERUPS.reduce((s, p) => s + p.weight, 0); let r = rnd(total);
      const P = POWERUPS.find((p) => (r -= p.weight) < 0) || POWERUPS[0];
      w.pups.push({ id: P.id, P, x: clamp(e.x, 10, W - 10), y: e.y, t: 0 });
    }
  }
  function hitEnemy(w, e, dmg, bomb = false) { e.hp -= dmg; e.flash = 0.08; if (e.hp <= 0) killEnemy(w, e, bomb); else sfx(w, "clink"); }
  // player bullet on an enemy. Enterprise-Only Feature is armoured: plain shots only get through every other time,
  // PXC spread shots and wingmen hit twice as hard.
  function shotEnemy(w, e, b) {
    if (e.type.ability === "armor") {
      if (b.spread || b.wing) { hitEnemy(w, e, 2); return; }
      e.armor = (e.armor || 0) + 1;
      if (e.armor % 2) { explode(w, b.x, b.y, [C.faint, C.white], 3, 30); sfx(w, "clink"); return; }
    }
    hitEnemy(w, e, 1);
  }
  function hurtPlayer(w) {
    const p = w.p; if (!p.alive || p.inv > 0) return false;
    if (w.fx.shield) { w.fx.shield = false; p.inv = 1.2; shake(w, 3); explode(w, p.x, p.y, [C.teal, C.white], 12, 60); sfx(w, "shield"); return true; }
    p.alive = false; p.deadT = 0; w.lives--; w.deathsThisWave++;
    explode(w, p.x, p.y, [C.white, C.yellow, C.purple, C.lilac, C.red], 46, 120); shake(w, 8); w.flash = 0.6; sfx(w, "death");
    w.fx = { pmm: 0, pxc: 0, op: 0, shield: false }; w.wing = []; w.streak = 0; w.mult = 1;
    return true;
  }
  function applyPower(w, pu) {
    const P = pu.P; let sub = P.sub;
    if (P.id === "pmm") w.fx.pmm = P.duration;
    else if (P.id === "xtrabackup") { if (w.fx.shield) { if (w.lives < RULES.maxLives) w.lives++; sub = P.subLife; } else w.fx.shield = true; }
    else if (P.id === "operator") { w.fx.op = P.duration; if (!w.wing.length) w.wing = [-1, 1].map((side) => ({ side, x: w.p.x, y: w.p.y })); }
    else if (P.id === "pxc") w.fx.pxc = P.duration;
    else if (P.id === "toolkit") smartBomb(w);
    addScore(w, 100); banner(w, P.banner, sub, 1.8, P.color); sfx(w, "power");
  }
  function smartBomb(w) {
    w.ebul = []; w.flash = 1; shake(w, 6); sfx(w, "bomb");
    for (let i = 0; i < 3; i++) w.parts.push({ ring: true, x: w.p.x, y: w.p.y, r: 1 + i * 10, life: 0.6, max: 0.6, c: [C.red, C.yellow, C.white][i], grow: 320 });
    for (const e of w.enemies) if (!e.dead && e.y > -8 && e.y < H) hitEnemy(w, e, 2, true);
    if (w.boss) damageBoss(w, 10, w.boss.x, w.boss.y);
  }

  /* --- player */
  function updatePlayer(w, dt, ctl) {
    const p = w.p;
    if (!p.alive) return;
    p.inv = Math.max(0, p.inv - dt); p.cd -= dt; p.jam = Math.max(0, (p.jam || 0) - dt);
    let dx = (ctl.right ? 1 : 0) - (ctl.left ? 1 : 0), dy = (ctl.down ? 1 : 0) - (ctl.up ? 1 : 0);
    if (ctl.ax) dx = ctl.ax; if (ctl.ay) dy = ctl.ay;
    p.x = clamp(p.x + dx * 100 * dt + (ctl.dragX || 0), 9, W - 9);
    p.y = clamp(p.y + dy * 80 * dt + (ctl.dragY || 0), H - 96, H - 24);
    for (const m of w.wing) { m.x = lerp(m.x, p.x + m.side * 16, Math.min(1, dt * 10)); m.y = lerp(m.y, p.y + 4, Math.min(1, dt * 10)); }
    const cap = (w.fx.pxc > 0 ? 12 : 5) + w.wing.length * 2;
    if ((ctl.fire || ctl.auto) && p.cd <= 0 && p.jam <= 0 && w.pbul.length < cap) {
      const add = (x, y, vx, flag) => w.pbul.push({ x, y, vx, vy: -270, ...flag });
      add(p.x, p.y - 8, 0);
      if (w.fx.pxc > 0) { add(p.x - 3, p.y - 6, -55, { spread: true }); add(p.x + 3, p.y - 6, 55, { spread: true }); }
      for (const m of w.wing) add(m.x, m.y - 4, 0, { wing: true });
      w.shots++; p.cd = 0.17; sfx(w, "laser", w.fx.pxc > 0);
    }
  }
  function aiControl(w) {
    const p = w.p, c = { fire: true };
    if (!p.alive) return c;
    let tx = W / 2;
    const live = w.enemies.filter((e) => !e.dead && e.state !== "wait" && e.y > 0);
    const divers = live.filter((e) => e.state === "dive" && e.y < p.y - 70);
    const target = w.boss && w.boss.state === "fight" ? w.boss : divers.length ? divers.reduce((a, b) => (b.y > a.y ? b : a)) : live.length ? live.reduce((a, b) => (Math.abs(b.x - p.x) < Math.abs(a.x - p.x) ? b : a)) : null;
    if (target) tx = target.x + (target === w.boss ? Math.sin(w.t) * 14 : 0);
    const near = w.pups.find((u) => u.y > p.y - 70);
    if (near) tx = near.x;
    for (const b of w.ebul) { const dy = p.y - b.y; if (dy > 0 && dy < 60) { const fx = b.x + b.vx * (dy / Math.max(1, b.vy)); if (Math.abs(fx - p.x) < 9) { tx = p.x + (fx < p.x ? 28 : -28); break; } } }
    for (const e of live) if (e.state === "dive" && e.y > p.y - 50 && e.y < p.y + 6 && Math.abs(e.x - p.x) < 14) tx = p.x + (e.x < p.x ? 30 : -30);
    if (w.beam && Math.abs(beamX(w) - p.x) < 14) tx = p.x + (beamX(w) < p.x ? 30 : -30);
    tx = clamp(tx, 12, W - 12);
    if (tx < p.x - 2) c.left = true; else if (tx > p.x + 2) c.right = true;
    return c;
  }

  /* --- one fixed step of the world */
  function stepWorld(w, dt, ctl) {
    w.t += dt; w.phaseT += dt; w.form.t += dt;
    w.shake = Math.max(0, w.shake - dt * 22); w.flash = Math.max(0, w.flash - dt * 2.5);
    if (w.banner && (w.banner.t += dt) > w.banner.dur) w.banner = null;
    for (const k of ["pmm", "pxc", "op"]) if (w.fx[k] > 0) { w.fx[k] = Math.max(0, w.fx[k] - dt); if (k === "op" && !w.fx.op) w.wing = []; }
    if (w.streakT > 0 && (w.streakT -= dt) <= 0) { w.streak = 0; w.mult = 1; }
    const d = diff(w);

    if (w.phase === "intro") {
      updatePlayer(w, dt, ctl);
      if (w.phaseT >= (w.demo ? 1.6 : w.wave === 1 ? 3.8 : 3)) { w.phase = "play"; w.phaseT = 0; w.spawnT = 0; if (w.isBoss) spawnBoss(w); }
    } else {
      if (w.phase === "play") {
        w.spawnT += dt;
        while (w.queue.length && w.queue[0].at <= w.spawnT) spawn(w, w.queue.shift());
        if (!w.queue.length && w.enemies.every((e) => e.state !== "enter")) w.form.mix = Math.min(1, w.form.mix + dt * 0.6);
        launchDives(w, dt, d); formationFire(w, dt, d);
      }
      updateEnemies(w, dt, d);
      if (w.boss) updateBoss(w, dt);
      if (w.beam) {
        const bm = w.beam; bm.t += dt;
        if (bm.t >= bm.tele && !bm.zapped) { bm.zapped = true; sfx(w, "zap"); shake(w, 3); }
        if (bm.t > bm.tele + bm.dur || !w.boss) w.beam = null;
        else if (bm.t >= bm.tele && Math.abs(beamX(w) - w.p.x) < 6) hurtPlayer(w);
      }
      updatePlayer(w, dt, w.phase === "over" ? {} : ctl);
    }

    // bullets
    for (const b of w.pbul) { b.x += b.vx * dt; b.y += b.vy * dt; }
    for (const b of w.ebul) { b.x += b.vx * dt; b.y += b.vy * dt; if (b.kind === "p") { b.t = (b.t || 0) + dt; b.x += Math.sin(b.t * 7) * 0.7; } }
    // player bullets vs enemies and the boss
    for (const b of w.pbul) {
      if (b.hit) continue;
      for (const e of w.enemies) {
        if (e.dead || e.state === "wait" || Math.abs(b.x - e.x) > 6 || Math.abs(b.y - e.y) > 6) continue;
        b.hit = true; w.hits++; shotEnemy(w, e, b); break;
      }
      const bs = w.boss;
      if (!b.hit && bs && bs.state === "fight") {
        const dx = Math.abs(b.x - bs.x), dy = b.y - bs.y;
        if ((dx <= 17 && dy >= -15 && dy <= 14) || (dx <= 23 && dy >= 0 && dy <= 14)) { b.hit = true; w.hits++; damageBoss(w, 1, b.x, b.y); explode(w, b.x, b.y, [C.white, C.yellow], 2, 30); }
      }
    }
    const p = w.p;
    if (p.alive) {
      for (const b of w.ebul) if (!b.hit && Math.abs(b.x - p.x) < 3.5 && Math.abs(b.y - (p.y + 1)) < 5) {
        b.hit = true;
        if (b.kind === "j") { if (p.inv <= 0) { p.jam = 1.6; popup(w, p.x, p.y - 14, "PAPERWORK!"); sfx(w, "clink"); } } else hurtPlayer(w);
        break;
      }
      for (const e of w.enemies) if (!e.dead && e.state !== "wait" && e.state !== "form" && Math.abs(e.x - p.x) < 9 && Math.abs(e.y - p.y) < 8) { if (hurtPlayer(w)) killEnemy(w, e); break; }
      for (const u of w.pups) if (!u.taken && Math.abs(u.x - p.x) < 10 && Math.abs(u.y - p.y) < 10) { u.taken = true; applyPower(w, u); }
    }
    for (const m of w.wing) {
      for (const b of w.ebul) if (!b.hit && Math.abs(b.x - m.x) < 4 && Math.abs(b.y - m.y) < 4) { b.hit = true; m.dead = true; }
      for (const e of w.enemies) if (!e.dead && (e.state === "dive" || e.state === "return") && Math.abs(e.x - m.x) < 8 && Math.abs(e.y - m.y) < 7) { m.dead = true; killEnemy(w, e); }
      if (m.dead) { explode(w, m.x, m.y, [C.lilac, C.purple, C.white], 14, 70); sfx(w, "boom", false); }
    }
    w.wing = w.wing.filter((m) => !m.dead);
    w.pbul = w.pbul.filter((b) => !b.hit && b.y > -8 && b.x > -8 && b.x < W + 8);
    w.ebul = w.ebul.filter((b) => !b.hit && b.y < H + 8 && b.y > -20 && b.x > -8 && b.x < W + 8);
    w.enemies = w.enemies.filter((e) => !e.dead);
    for (const u of w.pups) { u.t += dt; u.y += 32 * dt; u.x += Math.sin(u.t * 3) * 0.25; }
    w.pups = w.pups.filter((u) => !u.taken && u.y < H + 10);
    for (const q of w.parts) { q.life -= dt; if (q.ring) q.r += (q.grow || 60) * dt; else { q.x += q.vx * dt; q.y += q.vy * dt; q.vx *= 1 - 2.5 * dt; q.vy *= 1 - 2.5 * dt; } }
    w.parts = w.parts.filter((q) => q.life > 0);
    for (const q of w.pops) { q.t += dt; q.y -= 12 * dt; }
    w.pops = w.pops.filter((q) => q.t < (q.big ? 2 : 1));

    // respawn / game over
    if (!p.alive && w.phase !== "over") {
      p.deadT += dt;
      const divers = w.enemies.some((e) => e.state === "dive" || e.state === "tele");
      if (p.deadT > 2.4 && (!divers || p.deadT > 6)) {
        if (w.lives > 0) { Object.assign(p, { alive: true, inv: 2.5, x: W / 2, y: H - 34, cd: 0.4 }); banner(w, "READY", "", 1.4, C.white); }
        else { w.phase = "over"; w.phaseT = 0; }
      }
    }
    if (w.phase === "play" && !w.queue.length && !w.boss && !w.enemies.length && p.alive && !(w.banner && w.banner.hold)) {
      w.phase = "clear"; w.phaseT = 0; w.ebul = [];
      if (!w.deathsThisWave) { const bonus = 500 * Math.min(10, w.wave); addScore(w, bonus); banner(w, "WAVE CLEAR", `NO-HIT BONUS ${bonus}`, 2.2, C.teal); }
      else banner(w, "WAVE CLEAR", "DATA LIBERATED", 2.2, C.teal);
      sfx(w, "clear");
    }
    if (w.phase === "clear" && w.phaseT > 2.4) startWave(w);
  }

  /* ================================================================== drawing the world */
  function drawShip(x, y, w) {
    if (!SHIP.img) return;
    const img = SHIP.img, ix = Math.round(x - img.width / 2), iy = Math.round(y - img.height / 2);
    const f = Math.floor(G.t * 20) % 3;
    g.fillStyle = f ? C.yellow : C.orange; g.fillRect(Math.round(x) - 1, iy + img.height, 2, 1 + f);
    g.drawImage(img, ix, iy);
    if (w && w.fx.shield) {
      g.fillStyle = blink(8) ? C.teal : "#8ff5e0";
      for (let a = 0; a < Math.PI * 2; a += 0.26) g.fillRect(Math.round(x + Math.cos(a + G.t * 2) * 11), Math.round(y + 1 + Math.sin(a + G.t * 2) * 10), 1, 1);
    }
  }
  function drawPup(u, x, y, big = false) {
    const P = u.P || u; x = Math.round(x); y = Math.round(y);
    if (big && P.iconBig) { g.drawImage(P.iconBig, x - 19, y - 21); return; }
    if (P.iconImg) { const img = blink(4) ? P.iconImg : P.iconHi; g.drawImage(img, x - (img.width >> 1), y - (img.height >> 1) - 3); return; }
    g.fillStyle = blink(4) ? C.white : P.color; g.fillRect(x - 7, y - 4, 15, 9);
    g.fillStyle = P.color; g.fillRect(x - 6, y - 3, 13, 7);
    g.fillStyle = C.ink; g.fillRect(x - 6, y + 3, 13, 1);
    text(P.label, x + 1, y - 2, C.white, { small: true, align: "center" });
  }
  function drawBossSprite(b, x, y, def = b.def) {
    const open = b ? b.phase === 3 : false; const img = (b && b.flash > 0 && !reduced ? def.white : def.frames)[open ? 1 : 0];
    if (def.img) drawType(def, 0, x, y, b && b.flash > 0, 48);
    else g.drawImage(img, Math.round(x - 24), Math.round(y - 20));
    if (b && b.phase >= 2 && !def.img && def.style === "lock") { g.fillStyle = blink(6) ? C.red : C.orange; g.fillRect(Math.round(x) - 1, Math.round(y) + 3, 2, 2); }
  }
  function renderWorld(w) {
    g.save();
    if (w.shake > 0) { const s = w.shake * (reduced ? 0.25 : 1); g.translate(Math.round(rnd(-s, s)), Math.round(rnd(-s, s))); }
    // PMM radar: show where each dive will go before it starts
    if (w.fx.pmm > 0) {
      for (const e of w.enemies) {
        if (e.state !== "tele") continue;
        const ghost = { sx: e.x, sy: e.y, tx: e.tx, dir: e.dir, pattern: e.pattern, spd: e.spd }; const D = DIVE_DUR[e.pattern] || 2.4;
        g.fillStyle = blink(6) ? C.teal : "#0f5f52";
        for (let t = 0.1; t < D / e.spd; t += 0.06) { const r = divePos(ghost, t); if (r.y > H) break; g.fillRect(Math.round(r.x), Math.round(r.y), 1, 1); }
        text("!", e.x - 3, e.y - 16, C.teal);
      }
    }
    for (const e of w.enemies) {
      if (e.state === "wait") continue;
      const frame = e.state === "form" || e.state === "enter" ? Math.floor(w.t * 2) : Math.floor(w.t * 6);
      const hostile = e.state === "dive" || e.state === "tele" || e.minion;
      // Black Box is nearly invisible unless PMM is on, it was just hit, or it dives close to you
      const hidden = e.type.ability === "stealth" && !(w.fx.pmm > 0 || e.flash > 0 || (e.state === "dive" && e.y > H * 0.62));
      if (hidden) g.globalAlpha = 0.14;
      drawType(e.type, frame, e.x, e.y, e.flash > 0, 16, e.type.ability === "flip" && hostile);
      g.globalAlpha = 1;
      if ((e.state === "dive" || e.minion) && !hidden && e.y > 12 && e.y < H - 14) text(e.type.tag, e.x, e.y + 7, (e.type.ability === "flip" && e.type.pal2 ? e.type.pal2 : e.type.pal).l, { small: true, align: "center" });
    }
    if (w.boss) drawBossSprite(w.boss, w.boss.x, w.boss.y);
    if (w.beam && w.boss) {
      const bx = Math.round(beamX(w)), top = Math.round(w.boss.y + 16), bm = w.beam;
      if (bm.t < bm.tele) { if (blink(10)) { g.fillStyle = C.red; for (let y = top; y < H; y += 3) g.fillRect(bx, y, 1, 2); } }
      else { g.fillStyle = C.red; g.fillRect(bx - 3, top, 7, H - top); g.fillStyle = blink(20) ? C.white : C.yellow; g.fillRect(bx - 1, top, 3, H - top); }
    }
    for (const u of w.pups) drawPup(u, u.x, u.y);
    g.fillStyle = C.yellow; for (const b of w.pbul) { g.fillRect(Math.round(b.x), Math.round(b.y), 1, 4); }
    g.fillStyle = C.white; for (const b of w.pbul) g.fillRect(Math.round(b.x), Math.round(b.y), 1, 1);
    for (const b of w.ebul) {
      const x = Math.round(b.x), y = Math.round(b.y);
      if (b.kind === "o") { g.fillStyle = C.orange; g.fillRect(x - 1, y - 1, 3, 3); g.fillStyle = C.yellow; g.fillRect(x, y, 1, 1); }
      else if (b.kind === "j" || b.kind === "p") { g.fillStyle = "#f4ecd6"; g.fillRect(x - 1, y - 2, 3, 4); g.fillStyle = b.kind === "p" ? C.red : C.ink; g.fillRect(x - 1, y - 1, 3, 1); g.fillRect(x - 1, y + 1, 2, 1); }
      else { g.fillStyle = blink(12) ? C.red : C.white; g.fillRect(x, y - 2, 1, 4); g.fillStyle = C.red; g.fillRect(x - 1, y, 3, 1); }
    }
    for (const m of w.wing) g.drawImage(DRONE.img, Math.round(m.x - 3), Math.round(m.y - 2));
    const p = w.p;
    if (p.alive && !(p.inv > 0 && Math.floor(G.t * 12) % 2)) drawShip(p.x, p.y, w);
    if (p.alive && p.jam > 0 && blink(6)) text("JAMMED", p.x, p.y + 10, C.orange, { small: true, align: "center" });
    for (const q of w.parts) {
      g.globalAlpha = clamp(q.life / q.max, 0, 1); g.fillStyle = q.c;
      if (q.ring) { for (let a = 0; a < Math.PI * 2; a += Math.max(0.08, 2 / q.r)) g.fillRect(Math.round(q.x + Math.cos(a) * q.r), Math.round(q.y + Math.sin(a) * q.r), 1, 1); }
      else g.fillRect(Math.round(q.x), Math.round(q.y), q.s, q.s);
    }
    g.globalAlpha = 1;
    for (const q of w.pops) {
      const col = reduced ? C.yellow : [C.yellow, C.white, C.lilac][Math.floor(q.t * 12) % 3];
      text(q.s, q.x, q.y, col, { small: !q.big, align: "center", shadow: C.ink });
    }
    g.restore();
    if (w.flash > 0) { g.fillStyle = `rgba(255,255,255,${Math.min(0.7, w.flash) * (reduced ? 0.2 : 1)})`; g.fillRect(0, 0, W, H); }
    renderHudBottom(w);
    if (w.boss && w.boss.state !== "enter") {
      const b = w.boss; text(b.def.tag, W / 2, 25, C.red, { small: true, align: "center" });
      g.fillStyle = C.ink; g.fillRect(W / 2 - 70, 32, 140, 4); g.fillStyle = b.inv > 0 && blink(10) ? C.white : b.phase === 3 ? C.yellow : C.red; g.fillRect(W / 2 - 70, 32, Math.round((140 * b.hp) / b.max), 4);
      g.fillStyle = C.faint; g.fillRect(W / 2 - 70 + 47, 32, 1, 4); g.fillRect(W / 2 - 70 + 93, 32, 1, 4);
    }
    if (w.phase === "intro") renderIntro(w);
    if (w.banner) {
      const bn = w.banner; const show = bn.t > 0.5 || blink(8, bn.t);
      if (show) { text(bn.text, W / 2, 150, bn.color, { align: "center", shadow: C.ink }); if (bn.sub) text(bn.sub, W / 2, 162, C.white, { small: true, align: "center", shadow: C.ink }); }
    }
    if (w.phase === "over" && !w.demo && G.mode === "game") text("GAME OVER", W / 2, 130, C.red, { align: "center", shadow: C.ink });
  }
  function panel(x, y, w, h) {
    g.fillStyle = "rgba(7,6,11,0.9)"; g.fillRect(x, y, w, h);
    g.fillStyle = C.purple; g.fillRect(x, y, w, 1); g.fillRect(x, y + h - 1, w, 1); g.fillRect(x, y, 1, h); g.fillRect(x + w - 1, y, 1, h);
    g.fillStyle = "rgba(157,140,255,0.45)"; g.fillRect(x + 2, y + 2, w - 4, 1); g.fillRect(x + 2, y + h - 3, w - 4, 1);
  }
  function renderIntro(w) {
    if (!w.demo && w.wave === 1 && w.phaseT < 1.3) { text("REBEL 1", W / 2, 124, C.white, { align: "center" }); text("READY", W / 2, 140, C.yellow, { align: "center" }); return; }
    if (w.isBoss) {
      panel(12, 76, W - 24, 118);
      if (blink(4)) text("WARNING!", W / 2, 86, C.red, { align: "center", shadow: C.ink });
      const def = w.featured[0];
      drawBossSprite(null, W / 2, 124, def);
      text(def.name.toUpperCase(), W / 2, 152, C.yellow, { align: "center", shadow: C.purple });
      wrap(def.quip, 48).forEach((l, i) => text(l, W / 2, 166 + i * 7, C.dim, { small: true, align: "center" }));
      text(`WAVE ${pad(w.wave, 2)}`, W / 2, 182, C.lilac, { small: true, align: "center" });
      return;
    }
    const types = w.featured, h = 30 + types.length * 30;
    const y0 = 80; panel(10, y0, W - 20, h);
    text(`WAVE ${pad(w.wave, 2)}`, W / 2, y0 + 8, C.yellow, { align: "center", shadow: C.purple });
    types.forEach((t, i) => {
      const y = y0 + 26 + i * 30;
      drawType(t, Math.floor(G.t * 2), 26, y + 5, false);
      text(t.name, 40, y, C.white, { small: true });
      text(`${t.points}`, W - 18, y, C.yellow, { small: true, align: "right" });
      wrap(t.quip || "", 40).slice(0, 2).forEach((l, j) => text(l, 40, y + 8 + j * 7, C.dim, { small: true }));
    });
    if (blink(3)) text("INCOMING!", W / 2, y0 + h + 6, C.red, { small: true, align: "center" });
  }
  function renderHudTop() {
    const w = G.mode === "game" || G.mode === "gameover" ? G.world : null;
    const score = w ? w.score : G.over ? G.over.score : 0;
    if (!(G.mode === "game" && w && w.phase === "play") || blink(2)) text("1UP", 16, 2, C.red);
    text(pad(score), 8, 11, C.white);
    text("HIGH SCORE", W / 2, 2, C.red, { align: "center" });
    text(pad(hiScore()), W / 2, 11, C.white, { align: "center" });
    if (w && w.mult > 1) text(`X${w.mult}`, 60, 11, C.yellow);
    if (G.pilot) {
      const x = W - 20, y = 2;
      g.fillStyle = G.pilot.color; g.fillRect(x - 1, y - 1, 18, 18); g.fillStyle = C.ink; g.fillRect(x, y, 16, 16);
      if (G.pilot.img) g.drawImage(G.pilot.img, x, y, 16, 16); else text(G.pilot.initials, x + 8, y + 5, C.white, { small: true, align: "center" });
      text(G.pilot.first, W - 3, 20, C.lilac, { small: true, align: "right" });
    }
  }
  function renderHudBottom(w) {
    const y = H - 10;
    if (SHIP.mini) for (let i = 0; i < Math.min(6, w.lives - (w.p.alive ? 1 : 0)); i++) g.drawImage(SHIP.mini, 4 + i * 11, y);
    text(`WAVE ${w.wave}`, W - 4, y + 2, w.isBoss ? C.red : C.lilac, { small: true, align: "right" });
    let x = 78;
    const timer = (label, left, max, color) => { text(label, x, y, color, { small: true }); const lw = textWidth(label, { small: true }); g.fillStyle = C.ink; g.fillRect(x, y + 6, lw, 2); g.fillStyle = color; g.fillRect(x, y + 6, Math.ceil((lw * left) / max), 2); x += lw + 6; };
    const P = (id) => POWERUPS.find((p) => p.id === id) || { label: id.toUpperCase(), duration: 1, color: C.white };
    if (w.fx.pmm > 0) timer(P("pmm").label, w.fx.pmm, P("pmm").duration, P("pmm").color);
    if (w.fx.pxc > 0) timer(P("pxc").label, w.fx.pxc, P("pxc").duration, P("pxc").color);
    if (w.fx.op > 0) timer(P("operator").label, w.fx.op, P("operator").duration, P("operator").color);
    if (w.fx.shield) timer(P("xtrabackup").label, 1, 1, P("xtrabackup").color);
    if (w.demo) { text("DEMO PLAY", W / 2, 26, C.lilac, { small: true, align: "center" }); if (blink(2)) text(G.credits ? "PRESS START" : "INSERT COIN", W / 2, 206, C.yellow, { align: "center", shadow: C.ink }); }
  }

  /* ================================================================== attract mode */
  const ATTRACT = [["title", 9], ["enemies", 9], ["powerups", 7], ["demo", 26], ["scores", 7]];
  function setAttract(i) {
    G.attract.i = ((i % ATTRACT.length) + ATTRACT.length) % ATTRACT.length; G.attract.t = 0; G.demo = null;
    if (ATTRACT[G.attract.i][0] === "demo") { G.demo = newWorld(true); G.demo.wave = G.demoCount++ % RULES.bossEvery; startWave(G.demo); }
  }
  function updateAttract(dt) {
    const a = G.attract; a.t += dt; const [name, dur] = ATTRACT[a.i];
    if (G.credits && name !== "title") { setAttract(0); return; }
    if (name === "demo") { stepWorld(G.demo, dt, aiControl(G.demo)); if ((G.demo.phase === "over" && G.demo.phaseT > 1.5) || a.t > dur) setAttract(a.i + 1); }
    else if (a.t > dur && !G.credits) setAttract(a.i + 1);
  }
  function renderTitle() {
    const t = G.attract.t;
    if (SHIP.title) { const x = Math.round(W / 2 - SHIP.title.width / 2), y = 38 + (reduced ? 0 : Math.round(Math.sin(G.t * 1.5) * 2)); g.drawImage(SHIP.titleShadow, x + 2, y + 2); g.drawImage(SHIP.title, x, y); }
    text("PERCONA", W / 2, 84, C.white, { align: "center" });
    text("REBELS", W / 2, 95, C.yellow, { align: "center", scale: 3, shadow: C.purple });
    text("FREEDOM FIGHTERS FOR OPEN SOURCE", W / 2, 124, C.lilac, { small: true, align: "center" });
    text("OPEN SOURCE STRIKES BACK", W / 2, 132, C.faint, { small: true, align: "center" });
    if (G.credits) { if (blink(2)) text("PRESS START", W / 2, 150, C.yellow, { align: "center" }); text("1 REBEL ONLY", W / 2, 164, C.white, { small: true, align: "center" }); }
    else if (blink(1.6)) text("INSERT COIN", W / 2, 150, C.yellow, { align: "center" });
    const lines = ["ENTER / SPACE / TAP: COIN, THEN START", "ARROWS OR WASD MOVE   SPACE FIRE", `P PAUSE   M SOUND   C CRT   ESC ${BACK_NAME}`];
    lines.forEach((l, i) => text(l, W / 2, 180 + i * 9, C.dim, { small: true, align: "center" }));
    if (Pilot.ready) text("CHOOSE YOUR PILOT FROM THE ARCADE ROSTER", W / 2, 214, C.teal, { small: true, align: "center" });
    if (t > 0.1) text(`BONUS SHIP EVERY ${RULES.extraLifeEvery.toLocaleString("en-US")} PTS`, W / 2, 228, C.lilac, { small: true, align: "center" });
    text(`(C) ${new Date().getFullYear()} PERCONA   THE WAY IS OPEN`, 6, H - 8, C.faint, { small: true });
    text(`CREDIT ${G.credits}`, W - 6, H - 8, C.white, { small: true, align: "right" });
  }
  function renderEnemyTable() {
    const t = G.attract.t;
    text("KNOW YOUR", W / 2, 28, C.white, { align: "center" });
    text("ENEMY", W / 2, 38, C.yellow, { align: "center", shadow: C.purple });
    text("WE FIGHT PRACTICES, NOT PROJECTS", W / 2, 50, C.teal, { small: true, align: "center" });
    text("DIVING KILLS SCORE DOUBLE", W / 2, 57, C.lilac, { small: true, align: "center" });
    ENEMIES.slice(0, 9).forEach((e, i) => {
      if (t < 0.25 * i) return;
      const y = 66 + i * 20;
      drawType(e, Math.floor(G.t * 2), 22, y + 3, false);
      text(e.name, 36, y, C.white, { small: true });
      text(e.hint || `HP ${e.hp}  ${String(e.pattern).toUpperCase()}`, 36, y + 7, C.faint, { small: true });
      text(`${e.points}`, W - 12, y, C.yellow, { align: "right" });
    });
    if (t > 0.25 * Math.min(9, ENEMIES.length)) { const y = 66 + Math.min(9, ENEMIES.length) * 20; text(BOSSES.map((b) => b.name).join(" / ").toUpperCase(), 36, y, C.red, { small: true }); text(`BOSSES EVERY ${RULES.bossEvery} WAVES, TAKING TURNS`, 36, y + 7, C.faint, { small: true }); text("???", W - 12, y, C.red, { align: "right" }); }
  }
  function renderPowerTable() {
    const t = G.attract.t;
    text("POWER-UPS", W / 2, 30, C.yellow, { align: "center", shadow: C.purple });
    text("PERCONA TOOLS DROP AS YOU BREAK FREE", W / 2, 43, C.lilac, { small: true, align: "center" });
    POWERUPS.forEach((P, i) => {
      if (t < 0.3 * i) return;
      const y = 58 + i * 40;
      drawPup(P, 26, y + 8, true);
      text(P.name, 50, y, C.white);
      wrap(P.desc, 42).slice(0, 2).forEach((l, j) => text(l, 50, y + 10 + j * 7, C.dim, { small: true }));
    });
    const y = 58 + POWERUPS.length * 40 + 2;
    text(`COMBOS MULTIPLY YOUR SCORE UP TO X${RULES.maxCombo}`, W / 2, y, C.teal, { small: true, align: "center" });
  }
  function renderScoreTable(highlight) {
    text("HIGH SCORES", W / 2, 30, C.yellow, { align: "center", shadow: C.purple });
    text("RANK   SCORE   NAME  WAVE", W / 2, 48, C.lilac, { small: true, align: "center" });
    const ord = ["1ST", "2ND", "3RD", "4TH", "5TH", "6TH", "7TH", "8TH", "9TH", "10TH"];
    G.scores.forEach((s, i) => {
      if (i === highlight && !blink(4)) return;
      const col = i === highlight ? C.yellow : i === 0 ? C.yellow : i % 2 ? C.white : C.lilac;
      const y = 60 + i * 16;
      text(ord[i], 20, y, col); text(pad(s.s), 64, y, col); text(String(s.n || "???").slice(0, 3), 124, y, col); text(String(s.w || 0).padStart(2, " "), 172, y, col);
    });
  }

  /* ================================================================== game flow */
  function insertCoin() { G.credits = Math.min(9, G.credits + 1); AU.coin(); if (ATTRACT[G.attract.i][0] !== "title") setAttract(0); }
  function pressStart() {
    if (G.credits <= 0) { insertCoin(); return; }
    G.credits--;
    if (Pilot.ready) Pilot.open(); else beginGame();
  }
  function beginGame() {
    G.mode = "game"; G.paused = false; G.pauseEsc = false; G.demo = null; G.over = null;
    G.world = newWorld(false); AU.start(); startWave(G.world);
  }
  function toGameOver() {
    const w = G.world; Music.stop(); AU.over();
    G.mode = "gameover"; G.over = { t: 0, score: w.score, wave: w.wave, kills: w.kills, acc: w.shots ? Math.round((100 * w.hits) / w.shots) : 0 };
  }
  const qualifies = (s) => s > 0 && (G.scores.length < 10 || s > G.scores[G.scores.length - 1].s);
  function finishGameOver() {
    if (qualifies(G.over.score)) { const last = String(store.get("initials", "AAA")).toUpperCase(); G.mode = "initials"; G.ini = { letters: (last + "AAA").slice(0, 3).split(""), pos: 0, t: 0 }; }
    else { G.mode = "scores"; G.scoresT = 0; G.lastEntry = -1; }
  }
  const INI_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.-! ";
  const Ini = {
    cycle(d) { const I = G.ini, c = INI_CHARS.indexOf(I.letters[I.pos]); I.letters[I.pos] = INI_CHARS[(c + d + INI_CHARS.length) % INI_CHARS.length]; AU.blip(700 + d * 100); },
    move(d) { G.ini.pos = clamp(G.ini.pos + d, 0, 2); AU.blip(600); },
    ok() { if (G.ini.pos < 2) { G.ini.pos++; AU.blip(900); } else this.submit(); },
    type(ch) { G.ini.letters[G.ini.pos] = ch; AU.blip(900); if (G.ini.pos < 2) G.ini.pos++; },
    back() { G.ini.pos = Math.max(0, G.ini.pos - 1); AU.blip(500); },
    submit() {
      const n = G.ini.letters.join(""); store.set("initials", n);
      const entry = { n, s: G.over.score, w: G.over.wave, d: new Date().toISOString().slice(0, 10) };
      G.scores.push(entry); G.scores.sort((a, b) => b.s - a.s); G.scores = G.scores.slice(0, 10); store.set("scores", G.scores);
      G.lastEntry = G.scores.indexOf(entry); G.mode = "scores"; G.scoresT = 0; AU.oneUp();
    },
  };
  function renderGameOver() {
    g.fillStyle = "rgba(7,6,11,0.72)"; g.fillRect(0, 0, W, H);
    const o = G.over;
    text("GAME OVER", W / 2, 76, C.red, { align: "center", scale: 2, shadow: C.ink });
    const rows = [["SCORE", pad(o.score)], ["WAVE", pad(o.wave, 2)], ["LOCK-INS BROKEN", String(o.kills)], ["ACCURACY", o.acc + "%"]];
    rows.forEach(([k, v], i) => { text(k, 28, 112 + i * 14, C.lilac); text(v, W - 28, 112 + i * 14, C.white, { align: "right" }); });
    text("YOUR DATA IS STILL YOURS.", W / 2, 180, C.teal, { small: true, align: "center" });
    text("THE WAY IS OPEN.", W / 2, 189, C.teal, { small: true, align: "center" });
    if (o.t > 1.5 && blink(2)) text("PRESS START", W / 2, 214, C.yellow, { align: "center" });
  }
  function renderInitials() {
    const I = G.ini;
    if (blink(3)) text("NEW HIGH SCORE!", W / 2, 64, C.yellow, { align: "center", shadow: C.purple });
    text("ENTER YOUR INITIALS", W / 2, 84, C.white, { align: "center" });
    I.letters.forEach((ch, i) => {
      const cx = W / 2 + (i - 1) * 32, cur = i === I.pos;
      text(ch === " " ? "_" : ch, cx, 112, cur ? C.yellow : C.white, { align: "center", scale: 3 });
      if (cur) {
        g.fillStyle = C.teal;
        for (let k = 0; k < 4; k++) { g.fillRect(cx - k, 104 + k, k * 2 + 1, 1); g.fillRect(cx - k, 146 - k, k * 2 + 1, 1); }
        if (blink(4)) { g.fillStyle = C.yellow; g.fillRect(cx - 12, 138, 24, 2); }
      }
    });
    text(`SCORE ${pad(G.over.score)}`, W / 2, 160, C.lilac, { align: "center" });
    text("UP/DOWN LETTER   LEFT/RIGHT MOVE   FIRE OK", W / 2, 180, C.dim, { small: true, align: "center" });
    text("OR JUST TYPE THEM", W / 2, 188, C.dim, { small: true, align: "center" });
    g.fillStyle = C.purple; g.fillRect(W / 2 - 24, 204, 48, 16); text("OK", W / 2, 208, C.yellow, { align: "center" });
  }
  function renderPause() {
    g.fillStyle = "rgba(7,6,11,0.7)"; g.fillRect(0, 0, W, H);
    text("PAUSED", W / 2, 120, C.yellow, { align: "center", scale: 2, shadow: C.purple });
    text(G.pauseEsc ? `ESC AGAIN: GO TO ${BACK_NAME}` : "P OR START TO RESUME", W / 2, 148, C.white, { small: true, align: "center" });
    text(G.pauseEsc ? "P OR START TO KEEP PLAYING" : `ESC: GO TO ${BACK_NAME}`, W / 2, 158, C.dim, { small: true, align: "center" });
  }

  /* ================================================================== input: keyboard, gamepad, touch */
  const IN = { keys: new Set(), pad: new Set(), padPrev: new Set(), pressed: new Set(), ax: 0, ay: 0, dragX: 0, dragY: 0, touchId: null, lx: 0, ly: 0 };
  const KEYMAP = { ArrowLeft: "left", a: "left", A: "left", ArrowRight: "right", d: "right", D: "right", ArrowUp: "up", w: "up", W: "up", ArrowDown: "down", s: "down", S: "down",
    " ": "fire", Enter: "start", p: "pause", P: "pause", m: "mute", M: "mute", c: "crt", C: "crt", Escape: "back", 5: "coin", 1: "start" };
  const held = (a) => IN.keys.has(a) || IN.pad.has(a);
  const pressed = (a) => IN.pressed.has(a);
  addEventListener("keydown", (e) => {
    AU.unlock();
    if (G.mode === "pilot") { Pilot.onKey(e); return; }
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (G.mode === "initials") {
      e.preventDefault();
      if (e.key === "ArrowUp") Ini.cycle(1); else if (e.key === "ArrowDown") Ini.cycle(-1);
      else if (e.key === "ArrowLeft") Ini.move(-1); else if (e.key === "ArrowRight") Ini.move(1);
      else if (e.key === "Enter") Ini.submit(); else if (e.key === " ") Ini.ok();
      else if (e.key === "Backspace") Ini.back();
      else if (e.key === "Escape") { Ini.submit(); leave(); }
      else if (e.key.length === 1 && INI_CHARS.includes(e.key.toUpperCase())) Ini.type(e.key.toUpperCase());
      return;
    }
    const a = KEYMAP[e.key]; if (!a) return;
    e.preventDefault();
    if (G.mode === "game") G.touch = false;
    if (!e.repeat) IN.pressed.add(a);
    IN.keys.add(a);
  });
  addEventListener("keyup", (e) => { const a = KEYMAP[e.key]; if (a) IN.keys.delete(a); });
  addEventListener("blur", () => { IN.keys.clear(); if (G.mode === "game" && !G.paused) setPause(true); });
  document.addEventListener("visibilitychange", () => { if (document.hidden && G.mode === "game" && !G.paused) setPause(true); });

  const PADMAP = [[0, "fire"], [2, "fire"], [5, "fire"], [7, "fire"], [9, "start"], [8, "back"], [1, "cancel"], [12, "up"], [13, "down"], [14, "left"], [15, "right"]];
  function pollPad() {
    IN.padPrev = IN.pad; IN.pad = new Set(); IN.ax = 0; IN.ay = 0;
    let pads = [];
    try { pads = navigator.getGamepads ? [...navigator.getGamepads()] : []; } catch { pads = []; }
    for (const gp of pads) {
      if (!gp || !gp.connected) continue;
      for (const [i, a] of PADMAP) if (gp.buttons[i] && gp.buttons[i].pressed) IN.pad.add(a);
      const x = gp.axes[0] || 0, y = gp.axes[1] || 0;
      if (Math.abs(x) > 0.25) IN.ax = clamp(x, -1, 1); if (Math.abs(y) > 0.25) IN.ay = clamp(y, -1, 1);
      if (x < -0.5) IN.pad.add("left"); if (x > 0.5) IN.pad.add("right"); if (y < -0.5) IN.pad.add("up"); if (y > 0.5) IN.pad.add("down");
    }
    for (const a of IN.pad) if (!IN.padPrev.has(a)) { IN.pressed.add(a); AU.unlock(); }
  }
  addEventListener("gamepadconnected", () => toast("GAMEPAD READY"));

  function logical(e) { const r = view.hidden ? crtCanvas.getBoundingClientRect() : view.getBoundingClientRect(); return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H, sx: W / r.width, sy: H / r.height }; }
  const uiTarget = (e) => e.target.closest?.("a, button, input, .pilot");
  addEventListener("pointerdown", (e) => {
    if (uiTarget(e)) return;
    AU.unlock();
    if (e.pointerType !== "mouse") { document.body.classList.add("touch"); resize(); }
    const L = logical(e);
    if (G.mode === "game") {
      if (G.paused) { setPause(false); return; }
      if (e.pointerType === "mouse") return;
      G.touch = true; IN.touchId = e.pointerId; IN.lx = e.clientX; IN.ly = e.clientY; e.preventDefault();
    } else if (G.mode === "initials") {
      for (let i = 0; i < 3; i++) { const cx = W / 2 + (i - 1) * 32; if (Math.abs(L.x - cx) < 15 && L.y > 96 && L.y < 156) { G.ini.pos = i; Ini.cycle(L.y < 126 ? 1 : -1); return; } }
      if (Math.abs(L.x - W / 2) < 28 && L.y > 200 && L.y < 224) Ini.submit();
    } else if (G.mode !== "pilot") IN.pressed.add("start");
  });
  addEventListener("pointermove", (e) => {
    if (e.pointerId !== IN.touchId) return;
    const L = logical(e); IN.dragX += (e.clientX - IN.lx) * L.sx * 1.35; IN.dragY += (e.clientY - IN.ly) * L.sy * 1.35; IN.lx = e.clientX; IN.ly = e.clientY; e.preventDefault();
  });
  const endTouch = (e) => { if (e.pointerId === IN.touchId) IN.touchId = null; };
  addEventListener("pointerup", endTouch); addEventListener("pointercancel", endTouch);
  $("#t-pause")?.addEventListener("click", () => { AU.unlock(); if (G.mode === "game") setPause(!G.paused); });
  $("#t-mute")?.addEventListener("click", () => { AU.unlock(); toggleMute(); });

  function toggleMute() { AU.setMuted(!AU.muted); toast(AU.muted ? "SOUND OFF" : "SOUND ON"); updateSoundIcon(); }
  function updateSoundIcon() { const b = $("#t-mute"); if (b) b.textContent = AU.muted ? "♪̸" : "♪"; }
  function toggleCrt() { G.crt = !G.crt; store.set("crt", G.crt); applyCrt(); toast(G.crt ? "CRT FILTER ON" : "CRT FILTER OFF"); }
  function setPause(on) { G.paused = on; G.pauseEsc = false; if (on) Music.stop(); else if (G.world && !G.world.demo) Music.start(G.world.isBoss); AU.blip(on ? 400 : 800); }
  function leave() {
    Music.stop();
    const target = $("#back")?.href || "index.html", same = (u) => { try { const x = new URL(u, location.href); return x.origin + x.pathname.replace(/\.html$|\/$/, ""); } catch { return u; } };
    // came here from ARCADE: step back so its screen, search and filters are as you left them
    if (document.referrer && same(document.referrer) === same(target) && history.length > 1) history.back(); else location.href = target;
  }

  function handleInput() {
    if (pressed("mute")) toggleMute();
    if (pressed("crt")) toggleCrt();
    const go = pressed("start") || pressed("fire");
    switch (G.mode) {
      case "attract": if (pressed("coin")) insertCoin(); else if (go) pressStart(); if (pressed("back")) leave(); break;
      case "game":
        if (pressed("back")) { if (G.paused && G.pauseEsc) leave(); else { if (!G.paused) setPause(true); G.pauseEsc = true; } }
        else if (pressed("pause") || pressed("start")) setPause(!G.paused);
        break;
      case "gameover": if (go && G.over.t > 1.5) finishGameOver(); if (pressed("back")) leave(); break;
      case "initials":
        if (pressed("up")) Ini.cycle(1); if (pressed("down")) Ini.cycle(-1); if (pressed("left")) Ini.move(-1); if (pressed("right")) Ini.move(1);
        if (pressed("fire")) Ini.ok(); if (pressed("start")) Ini.submit(); break;
      case "scores": if (go) { G.mode = "attract"; setAttract(0); } if (pressed("back")) leave(); break;
      case "pilot":
        if (pressed("left")) Pilot.move(-1); if (pressed("right")) Pilot.move(1); if (pressed("up")) Pilot.move(-Pilot.cols()); if (pressed("down")) Pilot.move(Pilot.cols());
        if (pressed("fire") || pressed("start")) Pilot.launch(); if (pressed("cancel") || pressed("back")) Pilot.cancel(); break;
    }
    IN.pressed.clear();
  }
  function control() {
    const c = { left: held("left"), right: held("right"), up: held("up"), down: held("down"), fire: held("fire"), ax: IN.ax, ay: IN.ay, auto: G.touch, dragX: IN.dragX, dragY: IN.dragY };
    IN.dragX = 0; IN.dragY = 0; return c;
  }

  /* ================================================================== choose your pilot (only when web/data/people.js is present) */
  const Pilot = {
    list: [], shown: [], focus: 0, ready: false, openedAt: 0,
    el: $("#pilot"), q: $("#pilot-q"), grid: $("#pilot-grid"), info: $("#pilot-info"),
    load() {
      if (window.ARCADE_DATA) { this.init(window.ARCADE_DATA); return; }
      if (window.REBELS_STANDALONE) return;                                    // single-file build without the roster
      const s = document.createElement("script"); s.src = "data/people.js"; s.async = true;
      s.onload = () => { if (window.ARCADE_DATA) this.init(window.ARCADE_DATA); };
      s.onerror = () => {}; document.head.appendChild(s);
    },
    init(data) {
      if (!this.el || !Array.isArray(data.people)) return;
      const colors = {}, per = {};
      (data.departments || []).forEach((d) => (per[d.group] ||= []).push(d));
      Object.entries(per).forEach(([gname, ds]) => { const [h, s, l] = hexToHsl(data.groups?.[gname]?.color || C.purple); ds.forEach((d, i) => { colors[d.id] = `hsl(${(h + i * 14 - (ds.length - 1) * 7 + 360) % 360}, ${Math.min(95, s)}%, ${Math.min(70, Math.max(38, l + (i % 2 ? 6 : -4)))}%)`; }); });
      this.list = data.people.map((p) => ({
        id: p.id, name: p.name, first: p.first || p.name.split(/\s+/)[0], dept: p.dept?.name || "", color: colors[p.dept?.id] || C.purple,
        avatar: p.avatar ? p.avatar.replace("avatars/", "avatars/px/") : null, initials: p.name.split(/\s+/).map((x) => x[0]).slice(0, 2).join("").toUpperCase(),
        key: norm(`${p.name} ${p.dept?.name || ""}`).toLowerCase(),
      })).sort((a, b) => a.name.localeCompare(b.name));
      this.ready = this.list.length > 0;
      const last = store.get("pilot", null), p = last && this.list.find((x) => x.id === last);
      if (p) choosePilot(p);
      this.q.addEventListener("input", () => { this.focus = 0; this.render(); });
      this.grid.addEventListener("click", (e) => { const b = e.target.closest("[data-i]"); if (b && performance.now() - this.openedAt > 450) { this.focus = +b.dataset.i; this.launch(); } });
      this.grid.addEventListener("pointerover", (e) => { const b = e.target.closest("[data-i]"); if (b && +b.dataset.i !== this.focus) { this.focus = +b.dataset.i; this.mark(); } });
      this.grid.addEventListener("error", (e) => { if (e.target.tagName === "IMG") { const s = document.createElement("span"); s.className = "ini"; s.textContent = e.target.dataset.ini || "?"; e.target.replaceWith(s); } }, true);
      $("#pilot-guest").addEventListener("click", () => performance.now() - this.openedAt > 450 && this.guest());
      $("#pilot-go").addEventListener("click", () => performance.now() - this.openedAt > 450 && this.launch());
      $("#pilot-back").addEventListener("click", () => performance.now() - this.openedAt > 450 && this.cancel());
    },
    open() {
      G.mode = "pilot"; this.el.hidden = false; this.q.value = ""; this.focus = 0; this.openedAt = performance.now();
      this.render();
      if (G.pilot) { const i = this.shown.findIndex((p) => p.id === G.pilot.id); if (i >= 0) { this.focus = i; this.mark(); } }
      if (!document.body.classList.contains("touch")) this.q.focus();
    },
    close() { this.el.hidden = true; this.q.blur(); },
    render() {
      const terms = norm(this.q.value).toLowerCase().split(/\s+/).filter(Boolean);
      this.shown = this.list.filter((p) => terms.every((t) => p.key.includes(t))).slice(0, 96);
      this.grid.innerHTML = this.shown.length ? this.shown.map((p, i) => `<button type="button" class="pc" data-i="${i}" style="--c:${p.color}" title="${esc(p.name)} · ${esc(p.dept)}">${p.avatar ? `<img src="${esc(asset(p.avatar))}" alt="" loading="lazy" data-ini="${esc(p.initials)}">` : `<span class="ini">${esc(p.initials)}</span>`}<span class="nm">${esc(p.first)}</span></button>`).join("")
        : `<p class="none">No pilot by that name. Fly as a guest?</p>`;
      this.focus = Math.min(this.focus, Math.max(0, this.shown.length - 1)); this.mark();
    },
    mark() {
      [...this.grid.querySelectorAll(".pc")].forEach((b) => b.classList.toggle("on", +b.dataset.i === this.focus));
      const p = this.shown[this.focus], on = this.grid.querySelector(".pc.on");
      on?.scrollIntoView({ block: "nearest" });
      this.info.innerHTML = p ? `<b style="color:${p.color}">${esc(p.name)}</b><span>${esc(p.dept)} · ship tinted in guild colours</span>` : `<b>Guest pilot</b><span>standard issue white ship</span>`;
    },
    cols() { const t = getComputedStyle(this.grid).gridTemplateColumns; return Math.max(1, t.split(" ").filter(Boolean).length); },
    move(d) { if (!this.shown.length) return; this.focus = clamp(this.focus + d, 0, this.shown.length - 1); this.mark(); AU.blip(620); },
    launch() { const p = this.shown[this.focus]; if (!p) { this.guest(); return; } choosePilot(p); store.set("pilot", p.id); this.close(); beginGame(); },
    guest() { G.pilot = null; store.set("pilot", null); buildShip(C.white); this.close(); beginGame(); },
    cancel() { this.close(); G.credits++; G.mode = "attract"; setAttract(0); AU.blip(400); },
    onKey(e) {
      const k = e.key;
      if (k === "ArrowRight" || k === "ArrowLeft" || k === "ArrowDown" || k === "ArrowUp") { e.preventDefault(); this.move(k === "ArrowRight" ? 1 : k === "ArrowLeft" ? -1 : (k === "ArrowDown" ? 1 : -1) * this.cols()); }
      else if (k === "Enter") { e.preventDefault(); this.launch(); }
      else if (k === "Escape") { e.preventDefault(); if (this.q.value) { this.q.value = ""; this.render(); } else this.cancel(); }
      else if (k.length === 1 && document.activeElement !== this.q && !e.metaKey && !e.ctrlKey) this.q.focus();
    },
  };
  function choosePilot(p) {
    G.pilot = { ...p, img: null };
    if (p.avatar) { const img = new Image(); img.onload = () => { if (G.pilot && G.pilot.id === p.id) G.pilot.img = img; }; img.onerror = () => {}; img.src = asset(p.avatar); }
    buildShip(p.color);
  }

  /* ================================================================== main loop */
  let last = 0, acc = 0, frameNo = 0;
  function update(dt) {
    G.t += dt; pollPad(); handleInput(); updateStars(dt);
    if (G.toast && (G.toast.t += dt) > 1.4) G.toast = null;
    switch (G.mode) {
      case "attract": case "pilot": updateAttract(dt); break;
      case "game": if (!G.paused) { stepWorld(G.world, dt, control()); if (G.world.phase === "over" && G.world.phaseT > 2.6) toGameOver(); } break;
      case "gameover": G.over.t += dt; if (G.world) stepWorld(G.world, dt, {}); if (G.over.t > 7) finishGameOver(); break;
      case "initials": G.ini.t += dt; if (G.ini.t > 45) Ini.submit(); break;
      case "scores": G.scoresT += dt; if (G.scoresT > 9) { G.mode = "attract"; setAttract(0); } break;
    }
  }
  function render() {
    g.fillStyle = C.bg; g.fillRect(0, 0, W, H);
    drawStars();
    if (G.mode === "attract" || G.mode === "pilot") {
      const name = ATTRACT[G.attract.i][0];
      if (name === "title" || G.mode === "pilot") renderTitle(); else if (name === "enemies") renderEnemyTable(); else if (name === "powerups") renderPowerTable();
      else if (name === "scores") renderScoreTable(-1); else if (name === "demo" && G.demo) renderWorld(G.demo);
    } else if (G.mode === "game") { renderWorld(G.world); if (G.paused) renderPause(); }
    else if (G.mode === "gameover") { renderWorld(G.world); renderGameOver(); }
    else if (G.mode === "initials") renderInitials();
    else if (G.mode === "scores") renderScoreTable(G.lastEntry);
    renderHudTop();
    if (G.toast) text(G.toast.msg, W / 2, 40, C.teal, { small: true, align: "center", shadow: C.ink });
    present();
  }
  function frame(ts) {
    const dt = last ? Math.min(0.25, (ts - last) / 1000) : STEP; last = ts; acc += dt;
    let n = 0; while (acc >= STEP && n < 8) { update(STEP); acc -= STEP; n++; }
    if (n === 8) acc = 0;
    if (G.mode !== "pilot" || !(frameNo++ % 4)) render();        // behind the pilot picker the (blurred) title only needs a slow refresh
    requestAnimationFrame(frame);
  }

  /* ================================================================== boot */
  function boot(fontOk) {
    buildSmallFont(); buildBigFont(fontOk); prepareTypes(); loadScores(); seedStars();
    buildShip(C.white);
    SHIP.title = buildMark(C.white, 44); SHIP.titleShadow = silhouette(SHIP.title, C.purple);
    if (G.pilot) buildShip(G.pilot.color);
    loadLocalSprites(); Pilot.load(); updateSoundIcon();
    resize(); addEventListener("resize", resize); applyCrt(); setAttract(0);
    requestAnimationFrame(frame);
    // hooks for tests and the curious
    window.PERCONA_REBELS = {
      get mode() { return G.mode; }, get world() { return G.world; }, get state() { return G; }, ENEMIES, BOSSES, POWERUPS, RULES,
      give(id) { const P = POWERUPS.find((x) => x.id === id); if (G.world && P) applyPower(G.world, { P }); },
      warpTo(n) { if (G.world) { G.world.wave = Math.max(0, n - 1); startWave(G.world); } },
    };
  }
  // wait for the stylesheet (and its @font-face rules) before asking for Press Start 2P; fall back after 2.5 s
  const pageLoaded = document.readyState === "complete" ? Promise.resolve() : new Promise((r) => addEventListener("load", r, { once: true }));
  const fontReady = pageLoaded.then(() => (document.fonts && document.fonts.load ? Promise.race([document.fonts.load('8px "Press Start 2P"').then((l) => l.length > 0), new Promise((r) => setTimeout(() => r(false), 2500))]) : false));
  fontReady.catch(() => false).then((ok) => boot(ok));
})();
