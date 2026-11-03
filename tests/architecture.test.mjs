// Fitness functions: every principle in ARCHITECTURE.md §2 maps to a test here.
// A principle without a test is a recommendation. We don't keep recommendations.
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import { html, HTML_PATH, content, contentSource, configSource, config, domainSource, uiSource, netSource, codeOnly, appsScriptSource } from "./_source.mjs";

const ALLOWED_ORIGINS = ["https://fonts.googleapis.com", "https://fonts.gstatic.com", "https://script.google.com/macros/s/"];
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

describe("P2 · nothing leaves without a click, and nothing identifying", () => {
  const code = strip(codeOnly.replace(/<style>[\s\S]*?<\/style>/g, ""));
  const outsideNet = strip(codeOnly.replace(netSource, "").replace(/<style>[\s\S]*?<\/style>/g, ""));
  const net = strip(netSource);
  const re = (api) => new RegExp(`\\b${api.replace(/[.(]/g, (c) => "\\" + c)}`);

  for (const api of ["XMLHttpRequest", "sendBeacon", "WebSocket", "EventSource", "sessionStorage", "indexedDB",
    "document.cookie", "Worker", "BroadcastChannel", "caches", "open("]) {
    test(`no ${api} anywhere`, () => assert.doesNotMatch(code, re(api)));
  }

  for (const api of ["fetch", "localStorage", "crypto"]) {
    test(`${api} only inside #rc-net`, () => assert.doesNotMatch(outsideNet, re(api)));
  }

  test("#rc-net fetches only the configured endpoint", () => {
    const calls = [...net.matchAll(/\bfetch\(([^,)]*)/g)].map((m) => m[1].trim());
    assert.deepEqual(calls, ["endpoint"]);
  });

  test("#rc-net stores exactly one key: the random device id", () => {
    const keys = [...net.matchAll(/localStorage\.(\w+)\(([^,)]*)/g)];
    assert.ok(keys.length > 0);
    for (const [, method, arg] of keys) {
      assert.ok(["getItem", "setItem"].includes(method), `localStorage.${method} is not allowed`);
      assert.equal(arg.trim(), "DEVICE_KEY");
    }
    assert.match(net, /const DEVICE_KEY = "rc\.device";/);
  });

  test("#rc-net sends exactly version, device id and answers", () => {
    assert.match(net, /JSON\.stringify\(\{ v: version, d: deviceId\(\), a: bits \}\)/);
  });

  test("the endpoint is empty or an Apps Script Web App", () => {
    assert.ok(config.endpoint === "" || /^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(config.endpoint),
      `endpoint: ${config.endpoint}`);
  });

  test("sending happens only from the compare button", () => {
    const ui = strip(uiSource);
    assert.equal((ui.match(/Net\.submit\(/g) ?? []).length, 1);
    assert.match(ui, /\$\("compareBtn"\)\.addEventListener\("click", runCompare\)/);
  });

  test("the Apps Script never echoes other devices", () => {
    assert.match(appsScriptSource, /return \{ ok: true, n: n, mine: mine, avg: avg \};/);
  });

  test("no forms that could submit anywhere", () => {
    assert.doesNotMatch(html, /<form\b/i);
  });

  test("both privacy promises are on the first screen", () => {
    assert.match(html, /התשובות נשארות במכשיר שלכם בלבד ולא נשלחות לאף אחד/);
    assert.match(html, /בעילום שם/);
  });
});

describe("P3 · spec over body", () => {
  test("the UI reads content only from the #content block", () => {
    assert.match(uiSource, /getElementById\("content"\)/);
    assert.equal((html.match(/type="application\/json"/g) ?? []).length, 2, "#content and #config only");
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

  test("the spec and the config are valid JSON on their own", () => {
    assert.doesNotThrow(() => JSON.parse(contentSource));
    assert.doesNotThrow(() => JSON.parse(configSource));
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

  test("dependency direction: content, config, domain, net, UI", () => {
    const at = (id) => html.indexOf(`<script type="application/json" id="${id}"`) + 1 || html.indexOf(`<script id="${id}"`);
    const order = ["content", "config", "rc-domain", "rc-net", "rc-ui"].map(at);
    assert.ok(order.every((x) => x > 0), order.join(","));
    assert.deepEqual([...order].sort((a, b) => a - b), order);
  });

  test("net does not draw or compute", () => {
    const net = strip(netSource);
    assert.doesNotMatch(net, /createElement|innerHTML|textContent\s*=|\.append|RCDomain|PARADIGMS/);
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
