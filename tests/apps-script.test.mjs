// apps-script/Code.gs, run in Node against fake Google services.
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { loadAppsScript, config, content } from "./_source.mjs";

const V = content.meta.version;
const bits = (n) => "1".repeat(n) + "0".repeat(18 - n);
const dev = (i) => i.toString(16).padStart(32, "0");
const plain = (x) => JSON.parse(JSON.stringify(x));

describe("contract with index.html", () => {
  test("minCompare matches the page config", () => {
    assert.equal(loadAppsScript().CONFIG.minCompare, config.minCompare);
  });

  test("item count matches the content spec", () => {
    const items = content.paradigms.reduce((s, p) => s + p.items.length, 0);
    assert.equal(loadAppsScript().CONFIG.items, items);
  });
});

describe("validation: anything unexpected is rejected and nothing is written", () => {
  const cases = [
    ["not json", "{oops"],
    ["array", [1, 2]],
    ["extra field (e.g. a name)", { v: V, d: dev(1), a: bits(3), name: "דנה" }],
    ["missing device", { v: V, a: bits(3) }],
    ["short answers", { v: V, d: dev(1), a: "0101" }],
    ["answers with other chars", { v: V, d: dev(1), a: "2".repeat(18) }],
    ["device not hex", { v: V, d: "x".repeat(32), a: bits(3) }],
    ["email as device", { v: V, d: "lior@example.com", a: bits(3) }],
    ["bad version", { v: "latest", d: dev(1), a: bits(3) }],
  ];
  for (const [name, body] of cases) {
    test(name, () => {
      const s = loadAppsScript();
      const r = s.post(body);
      assert.equal(r.ok, false);
      assert.equal(s.sheet.rows.length, 0, "nothing written");
    });
  }
});

describe("storage", () => {
  test("creates the header once, then appends every submission", () => {
    const s = loadAppsScript();
    s.post({ v: V, d: dev(1), a: bits(2) });
    s.post({ v: V, d: dev(1), a: bits(5) });
    assert.equal(s.sheet.rows.length, 3);
    assert.deepEqual(plain(s.sheet.rows[0]), plain(s.HEADER));
    assert.equal(s.sheet.rows[1][1], dev(1));
    assert.equal(s.sheet.rows[2].slice(3).join(""), bits(5));
  });

  test("stores only time, device, version and answers", () => {
    const s = loadAppsScript();
    s.post({ v: V, d: dev(1), a: bits(2) });
    assert.equal(s.sheet.rows[1].length, 3 + 18);
  });

  test("rate limit per minute", () => {
    const s = loadAppsScript();
    const key = "rate:" + Math.floor(Date.now() / 60000);
    s.cache[key] = String(s.CONFIG.maxPerMinute);
    assert.equal(s.post({ v: V, d: dev(1), a: bits(1) }).error, "busy");
  });
});

describe("reply: my answers and everyone's average", () => {
  test("below minCompare: my answers back, no average", () => {
    const s = loadAppsScript();
    for (let i = 1; i < config.minCompare; i++) s.post({ v: V, d: dev(i), a: bits(i) });
    const r = s.post({ v: V, d: dev(1), a: bits(4) });
    assert.equal(r.n, config.minCompare - 1);
    assert.equal(r.mine, bits(4));
    assert.equal(r.avg, null);
  });

  test("one device counts once, with its latest answers", () => {
    const s = loadAppsScript();
    for (let i = 1; i <= 5; i++) s.post({ v: V, d: dev(i), a: bits(0) });
    s.post({ v: V, d: dev(1), a: bits(18) });
    const r = s.post({ v: V, d: dev(1), a: bits(18) }); // same device again
    assert.equal(r.n, 5);
    assert.equal(r.avg.length, 18);
    assert.ok(r.avg.every((x) => Math.abs(x - 0.2) < 1e-9), "1 of 5 devices said yes to everything");
  });

  test("averages per item", () => {
    const s = loadAppsScript();
    ["1".repeat(18), "1".repeat(18), "0".repeat(18), "0".repeat(18), "1" + "0".repeat(17)]
      .forEach((a, i) => s.post({ v: V, d: dev(i + 1), a }));
    const r = s.post({ v: V, d: dev(5), a: "1" + "0".repeat(17) });
    assert.equal(r.avg[0], 0.6);
    assert.equal(r.avg[1], 0.4);
  });

  test("other content versions are left out of the average", () => {
    const s = loadAppsScript();
    for (let i = 1; i <= 5; i++) s.post({ v: "0.9.0", d: dev(i), a: bits(18) });
    const r = s.post({ v: V, d: dev(9), a: bits(0) });
    assert.equal(r.n, 1);
    assert.equal(r.avg, null);
  });

  test("never returns other devices' raw answers", () => {
    const s = loadAppsScript();
    for (let i = 1; i <= 6; i++) s.post({ v: V, d: dev(i), a: bits(i) });
    const r = s.post({ v: V, d: dev(1), a: bits(1) });
    assert.deepEqual(Object.keys(r).sort(), ["avg", "mine", "n", "ok"]);
    assert.doesNotMatch(JSON.stringify(r), new RegExp(dev(2)));
  });

  test("GET says only that the service is up", () => {
    const s = loadAppsScript();
    s.post({ v: V, d: dev(1), a: bits(3) });
    assert.deepEqual(JSON.parse(s.doGet().text), { ok: true, service: "reality-check" });
  });
});
