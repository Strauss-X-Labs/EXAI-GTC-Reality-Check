import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { loadDomain, content } from "./_source.mjs";

const D = loadDomain();
const plain = (x) => JSON.parse(JSON.stringify(x)); // the domain lives in another vm realm
const N = content.paradigms.length;
const K = content.meta.maxPerParadigm;
const MAX = N * K;

const answersFrom = (per) => per.map((n) => Array.from({ length: K }, (_, j) => j < n));

describe("domain is a frozen pure API", () => {
  test("exposes the documented functions", () => {
    for (const fn of ["emptyAnswers", "perParadigm", "total", "maxScore", "bandFor", "bandEdges",
      "weakest", "weakestMessage", "startChapter", "radarPoint", "splitHighlight", "result"]) {
      assert.equal(typeof D[fn], "function", fn);
    }
    assert.ok(Object.isFrozen(D));
  });

  test("same input, same output", () => {
    const a = answersFrom([1, 2, 0, 3, 1, 2]);
    assert.deepEqual(plain(D.result(a, content)), plain(D.result(a, content)));
  });
});

describe("scoring", () => {
  test("empty answers score 0", () => {
    const a = D.emptyAnswers(content.paradigms);
    assert.equal(a.length, N);
    assert.ok(a.every((row) => row.length === K && row.every((v) => v === false)));
    assert.equal(D.total(D.perParadigm(a)), 0);
  });

  test("max score derives from the spec", () => {
    assert.equal(D.maxScore(content.paradigms), MAX);
  });

  test("per paradigm counts only checked items", () => {
    assert.deepEqual(plain(D.perParadigm([[true, false, true], [false, false, false]])), [2, 0]);
  });
});

describe("bands", () => {
  test("every score from 0 to max lands in exactly one band", () => {
    for (let s = 0; s <= MAX; s++) {
      const hits = content.bands.filter((b) => s >= b.min && s <= b.max);
      assert.equal(hits.length, 1, `score ${s}`);
      assert.equal(D.bandFor(s, content.bands).title, hits[0].title);
    }
  });

  test("boundaries", () => {
    assert.equal(D.bandFor(6, content.bands).title, "משחקים לפי הספר הישן");
    assert.equal(D.bandFor(7, content.bands).title, "באמצע המעבר");
    assert.equal(D.bandFor(12, content.bands).title, "באמצע המעבר");
    assert.equal(D.bandFor(13, content.bands).title, "כבר כותבים את הספר החדש");
  });

  test("an uncovered score fails loudly", () => {
    assert.throws(() => D.bandFor(MAX + 1, content.bands), (e) => e.name === "RangeError");
  });

  test("band edges match the original road (6.5/18, 12.5/18)", () => {
    const e = plain(D.bandEdges(content.bands, MAX));
    assert.equal(e.length, content.bands.length + 1);
    assert.equal(e[0], 0);
    assert.equal(e.at(-1), 1);
    assert.ok(Math.abs(e[1] - 6.5 / 18) < 1e-9);
    assert.ok(Math.abs(e[2] - 12.5 / 18) < 1e-9);
  });
});

describe("weakest paradigm", () => {
  test("single weakest", () => {
    const w = plain(D.weakest([2, 2, 2, 0, 2, 2]));
    assert.deepEqual(w, { min: 0, indices: [3], allEqual: false });
    assert.match(D.weakestMessage([2, 2, 2, 0, 2, 2], content.paradigms), /Scale Without Mass/);
  });

  test("ties list every weakest paradigm, in order", () => {
    const msg = D.weakestMessage([1, 3, 1, 3, 3, 3], content.paradigms);
    assert.ok(msg.indexOf(content.paradigms[0].name) < msg.indexOf(content.paradigms[2].name));
  });

  test("all equal and all full", () => {
    assert.match(D.weakestMessage(Array(N).fill(K), content.paradigms), /סימנת את כל ההיגדים/);
  });

  test("all equal and not full", () => {
    assert.match(D.weakestMessage(Array(N).fill(1), content.paradigms), /באותה רמה/);
    assert.match(D.weakestMessage(Array(N).fill(0), content.paradigms), /באותה רמה/);
  });

  test("the rulebook opens on the first weakest chapter", () => {
    assert.equal(D.startChapter([3, 1, 2, 1, 3, 3]), 1);
    assert.equal(D.startChapter(Array(N).fill(2)), 0);
  });

  test("the message never judges: no failure language", () => {
    for (const per of [Array(N).fill(0), [0, 1, 2, 3, 0, 1], Array(N).fill(K)]) {
      assert.doesNotMatch(D.weakestMessage(per, content.paradigms), /נכשל|גרוע|חלש|ציון נמוך/);
    }
  });
});

describe("geometry", () => {
  test("first spoke points straight up", () => {
    const [x, y] = plain(D.radarPoint(0, 100, 6, 240, 200));
    assert.ok(Math.abs(x - 240) < 1e-9);
    assert.ok(Math.abs(y - 100) < 1e-9);
  });

  test("spokes are evenly spaced on the circle", () => {
    for (let i = 0; i < 6; i++) {
      const [x, y] = D.radarPoint(i, 100, 6, 0, 0);
      assert.ok(Math.abs(Math.hypot(x, y) - 100) < 1e-9);
    }
  });
});

describe("highlight", () => {
  test("splits around the highlight", () => {
    assert.deepEqual(plain(D.splitHighlight("AI כדי לצמוח", "כדי לצמוח")), ["AI ", "כדי לצמוח", ""]);
  });

  test("missing or absent highlight leaves text whole", () => {
    assert.deepEqual(plain(D.splitHighlight("טקסט", undefined)), ["טקסט"]);
    assert.deepEqual(plain(D.splitHighlight("טקסט", "אחר")), ["טקסט"]);
  });
});

describe("result", () => {
  test("matches the scenario from the original file", () => {
    const r = D.result(answersFrom([2, 2, 2, 0, 2, 2]), content);
    assert.equal(r.score, 10);
    assert.equal(r.max, 18);
    assert.equal(r.band.title, "באמצע המעבר");
  });
});
