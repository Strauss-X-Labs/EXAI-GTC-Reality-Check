// Reads index.html and extracts its modules by id. Tests run against the shipped file, not a copy.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

export const HTML_PATH = fileURLToPath(new URL("../index.html", import.meta.url));
export const html = readFileSync(HTML_PATH, "utf8");

function block(id) {
  const m = html.match(new RegExp(`<script[^>]*\\bid="${id}"[^>]*>([\\s\\S]*?)</script>`));
  if (!m) throw new Error(`Block #${id} not found in index.html`);
  return m[1];
}

export const contentSource = block("content");
export const domainSource = block("rc-domain");
export const uiSource = block("rc-ui");
export const netSource = block("rc-net");
export const configSource = block("config");
export const content = JSON.parse(contentSource);
export const config = JSON.parse(configSource);
export const appsScriptSource = readFileSync(new URL("../apps-script/Code.gs", import.meta.url), "utf8");

// Run the domain in an empty sandbox: if it touches anything browser-only, it throws here.
export function loadDomain() {
  const sandbox = { Math, JSON, RangeError, Object, Array };
  sandbox.globalThis = sandbox;
  vm.runInNewContext(domainSource, sandbox, { filename: "index.html#rc-domain" });
  return sandbox.RCDomain;
}

// Code = everything that is not the content spec.
export const codeOnly = html.replace(contentSource, "");

// Run Code.gs in a sandbox with fake Google services. Returns the script's globals and the fake sheet.
export function loadAppsScript({ rows = [], cache = {} } = {}) {
  const sheet = {
    rows: rows.map((r) => r.slice()),
    getLastRow() { return this.rows.length; },
    appendRow(r) { this.rows.push(r); },
    setFrozenRows() {},
    getRange(row, col, numRows, numCols) {
      const data = this.rows.slice(row - 1, row - 1 + numRows).map((r) => r.slice(col - 1, col - 1 + numCols));
      return { getValues: () => data };
    },
  };
  const sandbox = {
    Math, JSON, Object, Array, String, Number, RegExp, Date,
    SpreadsheetApp: { getActiveSpreadsheet: () => ({ getSheetByName: () => sheet, insertSheet: () => sheet }) },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    CacheService: { getScriptCache: () => ({ get: (k) => cache[k] ?? null, put: (k, v) => { cache[k] = v; } }) },
    ContentService: {
      MimeType: { JSON: "json" },
      createTextOutput: (text) => ({ text, setMimeType() { return this; } }),
    },
  };
  vm.runInNewContext(appsScriptSource + "\n;globalThis.__api = { doPost, doGet, setup, validate, summarize, CONFIG, HEADER };", sandbox);
  const post = (body) => JSON.parse(sandbox.__api.doPost({ postData: { contents: typeof body === "string" ? body : JSON.stringify(body) } }).text);
  return { ...sandbox.__api, post, sheet, cache };
}

// A copy of the shipped file with a different endpoint ("" = local only). Returns a file:// URL.
export function variantUrl(endpoint) {
  const out = html.replace(/"endpoint":\s*"[^"]*"/, `"endpoint": "${endpoint}"`);
  if (!/"endpoint":/.test(out)) throw new Error("No endpoint in #config");
  const dir = mkdtempSync(join(tmpdir(), "rc-e2e-"));
  writeFileSync(join(dir, "index.html"), out);
  return pathToFileURL(join(dir, "index.html")).href;
}
