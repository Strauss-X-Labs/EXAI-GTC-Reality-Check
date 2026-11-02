// Reads index.html and extracts its modules by id. Tests run against the shipped file, not a copy.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

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
export const content = JSON.parse(contentSource);

// Run the domain in an empty sandbox: if it touches anything browser-only, it throws here.
export function loadDomain() {
  const sandbox = { Math, JSON, RangeError, Object, Array };
  sandbox.globalThis = sandbox;
  vm.runInNewContext(domainSource, sandbox, { filename: "index.html#rc-domain" });
  return sandbox.RCDomain;
}

// Code = everything that is not the content spec.
export const codeOnly = html.replace(contentSource, "");
