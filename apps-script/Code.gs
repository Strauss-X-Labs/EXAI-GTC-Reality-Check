/**
 * Reality Check · Apps Script (one workshop)
 *
 * Pasted into the Google Sheet: Extensions → Apps Script. Runs as the sheet owner,
 * so the sheet itself stays private. The page only knows this Web App's URL.
 *
 * POST body (text/plain JSON): { v: "1.0.0", d: "<32 hex device id>", a: "<18 x 0/1>" }
 * Reply: { ok, n, mine, avg }   avg = 18 item averages (0..1), or null below minCompare.
 *
 * Every submission is kept (append-only). Averages count each device once: its latest answers,
 * for the same content version only.
 */
const CONFIG = {
  sheet: "responses",
  items: 18,
  minCompare: 5,      // must match "minCompare" in index.html #config
  maxPerMinute: 120,  // global write limit
};

const HEADER = ["received_at", "device", "content_version"].concat(
  Array.from({ length: CONFIG.items }, (_, i) => "q" + (i + 1)));

function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(CONFIG.sheet) || ss.insertSheet(CONFIG.sheet);
  if (sh.getLastRow() === 0) {
    sh.appendRow(HEADER);
    sh.setFrozenRows(1);
  }
  return sh;
}

function doPost(e) {
  let body;
  try {
    body = JSON.parse((e && e.postData && e.postData.contents) || "");
  } catch (err) {
    return reply({ ok: false, error: "bad_json" });
  }
  const problem = validate(body);
  if (problem) return reply({ ok: false, error: problem });

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const cache = CacheService.getScriptCache();
    const key = "rate:" + Math.floor(Date.now() / 60000);
    const count = Number(cache.get(key) || 0);
    if (count >= CONFIG.maxPerMinute) return reply({ ok: false, error: "busy" });
    cache.put(key, String(count + 1), 120);

    const sh = setup();
    sh.appendRow([new Date(), body.d, body.v].concat(body.a.split("").map(Number)));
    return reply(summarize(readRows(sh), body));
  } finally {
    lock.releaseLock();
  }
}

function validate(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return "shape";
  if (Object.keys(body).sort().join(",") !== "a,d,v") return "shape";
  if (typeof body.a !== "string" || !new RegExp("^[01]{" + CONFIG.items + "}$").test(body.a)) return "answers";
  if (typeof body.d !== "string" || !/^[0-9a-f]{32}$/.test(body.d)) return "device";
  if (typeof body.v !== "string" || !/^\d+\.\d+\.\d+$/.test(body.v)) return "version";
  return null;
}

function readRows(sh) {
  const rows = sh.getLastRow() - 1;
  if (rows < 1) return [];
  return sh.getRange(2, 1, rows, HEADER.length).getValues();
}

// Pure: rows in, reply out. Latest row per device wins.
function summarize(rows, body) {
  const latest = {};
  rows.forEach(function (r) {
    if (String(r[2]) !== body.v) return;
    latest[String(r[1])] = r.slice(3, 3 + CONFIG.items).map(function (x) { return Number(x) === 1 ? 1 : 0; });
  });
  const devices = Object.keys(latest);
  const n = devices.length;
  const mine = latest[body.d] ? latest[body.d].join("") : null;
  if (n < CONFIG.minCompare) return { ok: true, n: n, mine: mine, avg: null };
  const sums = new Array(CONFIG.items).fill(0);
  devices.forEach(function (d) { latest[d].forEach(function (x, i) { sums[i] += x; }); });
  const avg = sums.map(function (s) { return Math.round((s / n) * 1000) / 1000; });
  return { ok: true, n: n, mine: mine, avg: avg };
}

function reply(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

// Opening the URL in a browser shows that the service is up, and nothing else.
function doGet() {
  return reply({ ok: true, service: "reality-check" });
}
