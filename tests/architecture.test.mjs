// Fitness functions: every principle in ARCHITECTURE.md §2 maps to a test here.
// A principle without a test is a recommendation. We don't keep recommendations.
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import { html, HTML_PATH, content, contentSource, domainSource, uiSource, codeOnly } from "./_source.mjs";

const ALLOWED_ORIGINS = ["https://fonts.googleapis.com", "https://fonts.gstatic.com"];
const NAMESPACES = ["http://www.w3.org/2000/svg"];
const strip = (src) => src.replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, ""); // ignore comments

describe("P1 · one file", () => {
  test("no script loads a file", () => {
    assert.doesNotMatch(html, /<script[^>]*\bsrc=/i);
  });

  test("no local src, href or url() references", () => {
    const refs = [...html.matchAll(/\b(?:src|href)="([^"]*)"|url\(\s*["']?([^"')]+)/g)].map((m) => m[1] ?? m[2]);
    const local = refs.filter((r) => !/^(https:|data:|#)/.test(r));
    assert.deepEqual(local, [], `local references: ${local.join(", ")}`);
  });

  test("no dynamic imports or modules", () => {
    assert.doesNotMatch(strip(codeOnly), /\bimport\s*\(|type="module"/);
  });

  test("deploy ships index.html and nothing else", () => {
    const ci = readFileSync(new URL("../.github/workflows/ci.yml", import.meta.url), "utf8");
    assert.match(ci, /cp index\.html _site\//);
    assert.doesNotMatch(ci, /cp -r|cp .*\*/);
  });
});

describe("P2 · answers never leave the device", () => {
  const FORBIDDEN = ["fetch", "XMLHttpRequest", "sendBeacon", "WebSocket", "EventSource", "localStorage",
    "sessionStorage", "indexedDB", "document.cookie", "Worker", "BroadcastChannel", "caches", "open("];
  for (const api of FORBIDDEN) {
    test(`no ${api}`, () => {
      const re = new RegExp(`\\b${api.replace(/[.(]/g, (c) => "\\" + c)}`);
      assert.doesNotMatch(strip(codeOnly.replace(/<style>[\s\S]*?<\/style>/g, "")), re);
    });
  }

  test("no forms that could submit anywhere", () => {
    assert.doesNotMatch(html, /<form\b/i);
  });

  test("the promise is still on the first screen", () => {
    assert.match(html, /התשובות נשארות במכשיר שלכם בלבד/);
  });
});

describe("P3 · spec over body", () => {
  test("the UI reads content only from the #content block", () => {
    assert.match(uiSource, /getElementById\("content"\)/);
    assert.equal((html.match(/type="application\/json"/g) ?? []).length, 1);
  });

  test("no content string is hard-coded outside the spec", () => {
    const strings = [];
    const walk = (v) => {
      if (typeof v === "string" && v.length >= 8) strings.push(v);
      else if (v && typeof v === "object") Object.values(v).forEach(walk);
    };
    walk(content.paradigms);
    const leaked = strings.filter((s) => codeOnly.includes(s));
    assert.deepEqual(leaked, []);
  });

  test("the spec is valid JSON on its own", () => {
    assert.doesNotThrow(() => JSON.parse(contentSource));
  });
});

describe("P4 · ports and adapters", () => {
  const domain = strip(domainSource);

  for (const token of ["document", "window", "navigator", "location", "Date", "Math.random",
    "setTimeout", "setInterval", "requestAnimationFrame", "matchMedia", "console"]) {
    test(`domain does not use ${token}`, () => {
      assert.doesNotMatch(domain, new RegExp(`\\b${token.replace(".", "\\.")}\\b`));
    });
  }

  test("domain publishes exactly one global", () => {
    assert.equal((domain.match(/\bglobalThis\b/g) ?? []).length, 1);
    assert.match(domain, /globalThis\.RCDomain\s*=/);
  });

  test("UI does not compute scores itself", () => {
    const ui = strip(uiSource);
    assert.doesNotMatch(ui, /filter\(Boolean\)/, "count answers via RCDomain.perParadigm");
    assert.doesNotMatch(ui, /\.reduce\(/, "totals belong to the domain");
    assert.doesNotMatch(ui, /\.find\(\s*\(?b\)?\s*=>/, "band lookup belongs to the domain");
  });

  test("dependency direction: content, then domain, then UI", () => {
    const at = (id) => html.indexOf(`id="${id}"`);
    assert.ok(at("content") < at("rc-domain") && at("rc-domain") < at("rc-ui"));
  });

  test("domain never reads the UI", () => {
    assert.doesNotMatch(domain, /RCUI|rc-ui/);
  });
});

describe("P5 · zero runtime dependencies", () => {
  test("only allow-listed external origins", () => {
    const urls = [...html.matchAll(/https?:\/\/[^\s"'<>)]+/g)].map((m) => m[0]);
    const bad = urls.filter((u) => !NAMESPACES.some((n) => u.startsWith(n)) && !ALLOWED_ORIGINS.some((o) => u.startsWith(o)));
    assert.deepEqual(bad, []);
  });

  test("fonts fall back to system fonts", () => {
    assert.match(html, /--font-display:[^;]*Arial/);
    assert.match(html, /--font-body:[^;]*Arial/);
  });

  test("package.json declares no runtime dependencies", () => {
    const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
    assert.equal(Object.keys(pkg.dependencies ?? {}).length, 0);
  });
});

describe("P6 · accessible RTL (static part, the rest is in e2e)", () => {
  test("document is Hebrew, right to left", () => {
    assert.match(html, /<html[^>]*\blang="he"/);
    assert.match(html, /<html[^>]*\bdir="rtl"/);
  });

  test("reduced motion is respected", () => {
    assert.match(html, /prefers-reduced-motion: reduce/);
    assert.match(uiSource, /reduceMotion/);
  });

  test("head is well formed: charset and title inside <head>", () => {
    const head = html.match(/<head>([\s\S]*?)<\/head>/)[1];
    assert.match(head, /<meta charset="utf-8">/);
    assert.match(head, /<title>[^<]+<\/title>/);
  });
});

describe("P7 · small", () => {
  test("index.html is at most 60KB", () => {
    const kb = statSync(HTML_PATH).size / 1024;
    assert.ok(kb <= 60, `index.html is ${kb.toFixed(1)}KB`);
  });
});
