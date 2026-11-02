// Content spec: schema and invariants (ARCHITECTURE.md §4).
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { content } from "./_source.mjs";

const nonEmpty = (v, where) => assert.ok(typeof v === "string" && v.trim().length > 0, `${where} must be a non-empty string`);
const K = content.meta?.maxPerParadigm;

describe("meta", () => {
  test("has version, title and maxPerParadigm", () => {
    assert.match(content.meta.version, /^\d+\.\d+\.\d+$/);
    nonEmpty(content.meta.title, "meta.title");
    assert.ok(Number.isInteger(K) && K > 0);
  });
});

describe("paradigms", () => {
  test("between 3 and 8", () => {
    assert.ok(content.paradigms.length >= 3 && content.paradigms.length <= 8);
  });

  content.paradigms.forEach((p, i) => {
    const at = `paradigms[${i}]`;
    test(`${at} fields`, () => {
      for (const f of ["name", "short", "from", "to"]) nonEmpty(p[f], `${at}.${f}`);
      assert.ok(p.short.length <= 20, `${at}.short is ${p.short.length} chars, max 20`);
    });

    test(`${at} has exactly ${K} items`, () => {
      assert.equal(p.items.length, K);
      p.items.forEach((t, j) => nonEmpty(t, `${at}.items[${j}]`));
    });

    test(`${at} chapter mirrors items one to one`, () => {
      nonEmpty(p.chapter?.sub, `${at}.chapter.sub`);
      assert.equal(p.chapter.clauses.length, p.items.length);
      p.chapter.clauses.forEach((c, j) => {
        for (const f of ["old", "new", "tomorrow"]) nonEmpty(c[f], `${at}.chapter.clauses[${j}].${f}`);
        if (c.highlight !== undefined) {
          assert.ok(c.new.includes(c.highlight), `${at}.chapter.clauses[${j}].highlight not found in "new"`);
        }
        if (c.hot !== undefined) assert.equal(typeof c.hot, "boolean");
      });
    });
  });

  test("names and short labels are unique", () => {
    const names = content.paradigms.map((p) => p.name);
    const shorts = content.paradigms.map((p) => p.short);
    assert.equal(new Set(names).size, names.length);
    assert.equal(new Set(shorts).size, shorts.length);
  });
});

describe("bands", () => {
  test("cover 0..max contiguously, in order, without overlap", () => {
    const max = content.paradigms.length * K;
    const b = content.bands;
    assert.equal(b[0].min, 0);
    assert.equal(b.at(-1).max, max);
    for (let i = 0; i < b.length; i++) {
      assert.ok(b[i].min <= b[i].max, `bands[${i}] min > max`);
      if (i > 0) assert.equal(b[i].min, b[i - 1].max + 1, `gap or overlap before bands[${i}]`);
      nonEmpty(b[i].title, `bands[${i}].title`);
      nonEmpty(b[i].text, `bands[${i}].text`);
    }
  });

  test("the journey road has three zones", () => {
    // The road SVG in the markup draws exactly three colored segments.
    assert.equal(content.bands.length, 3);
  });
});

describe("tone", () => {
  test("no exclamation marks in participant-facing content", () => {
    assert.doesNotMatch(JSON.stringify(content), /!/);
  });
});
