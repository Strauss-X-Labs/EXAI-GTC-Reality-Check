// End to end: "how do I compare with everyone", against the real Code.gs running as a mock backend.
import { test, expect } from "@playwright/test";
import { content, config, loadAppsScript, variantUrl } from "./_source.mjs";

const ENDPOINT = "https://script.google.com/macros/s/TEST_DEPLOYMENT_ID/exec";
const FONT_HOSTS = ["fonts.googleapis.com", "fonts.gstatic.com"];
const V = content.meta.version;

// A copy of the shipped file pointing at a mocked endpoint. Nothing reaches the real Apps Script.
const URL_ = variantUrl(ENDPOINT);

const dev = (i) => i.toString(16).padStart(32, "f");

async function setup(page, info, { others = 0, down = false } = {}) {
  info.outsideRequests = [];
  info.posts = [];
  info.pageErrors = [];
  page.on("pageerror", (e) => info.pageErrors.push(e.message));
  const backend = loadAppsScript();
  for (let i = 1; i <= others; i++) backend.post({ v: V, d: dev(i), a: "1".repeat(i % 19).padEnd(18, "0") });
  await page.route("**/*", (route) => {
    const u = new URL(route.request().url());
    if (u.protocol === "file:" || u.protocol === "data:") return route.continue();
    if (FONT_HOSTS.includes(u.hostname)) return route.abort();
    if (u.href === ENDPOINT && route.request().method() === "POST") {
      info.posts.push({ body: route.request().postData(), type: route.request().headers()["content-type"] });
      if (down) return route.abort("internetdisconnected");
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(backend.post(route.request().postData())) });
    }
    info.outsideRequests.push(u.href);
    return route.abort();
  });
  return backend;
}

test.afterEach(async ({}, info) => {
  expect(info.outsideRequests, "requests outside the allow-list").toEqual([]);
  expect(info.pageErrors, "uncaught errors").toEqual([]);
});

async function finish(page, perParadigm) {
  await page.getByRole("button", { name: "מתחילים" }).click();
  for (let i = 0; i < perParadigm.length; i++) {
    for (let j = 0; j < perParadigm[i]; j++) await page.locator(".item").nth(j).click();
    await page.locator("#next").click();
  }
  await expect(page.locator("#result")).toBeVisible();
}

test("nothing is sent until the participant clicks", async ({ page }, info) => {
  await setup(page, info, { others: 6 });
  await page.goto(URL_);
  await expect(page.locator("#privacyCompare")).toBeVisible();
  await expect(page.locator("#privacyLocal")).toBeHidden();
  await finish(page, [3, 3, 3, 0, 0, 0]);
  await page.waitForTimeout(500);
  expect(info.posts).toHaveLength(0);
  await expect(page.locator("#compareBtn")).toBeVisible();
});

test("compare: sends only version, device id and answers, then overlays the average", async ({ page }, info) => {
  await setup(page, info, { others: 6 });
  await page.goto(URL_);
  await finish(page, [3, 3, 3, 0, 0, 0]);
  await page.getByRole("button", { name: "הראה לי איך אני למול הכלל" }).click();

  await expect(page.locator("#compareStatus")).toContainText("מתוך 7 משיבים");
  expect(info.posts).toHaveLength(1);
  expect(info.posts[0].type).toMatch(/^text\/plain/); // no CORS preflight
  const body = JSON.parse(info.posts[0].body);
  expect(Object.keys(body).sort()).toEqual(["a", "d", "v"]);
  expect(body).toMatchObject({ v: V, a: "111111111" + "000000000" });
  expect(body.d).toMatch(/^[0-9a-f]{32}$/);

  await expect(page.locator("#radar .shape.avg")).toHaveCount(1);
  await expect(page.locator("#radar .axis-avg")).toHaveCount(content.paradigms.length);
  await expect(page.locator("#compareLegend")).toBeVisible();
  await expect(page.locator("#radarDesc")).toContainText("ממוצע כל המשיבים");
});

test("one id per device: the same id across reloads and restarts", async ({ page }, info) => {
  await setup(page, info, { others: 6 });
  await page.goto(URL_);
  await finish(page, [1, 1, 1, 1, 1, 1]);
  await page.locator("#compareBtn").click();
  await expect(page.locator("#compareStatus")).toContainText("משיבים");

  await page.reload();
  await finish(page, [2, 2, 2, 2, 2, 2]);
  await page.locator("#compareBtn").click();
  await expect(page.locator("#compareStatus")).toContainText("מתוך 7 משיבים"); // still 7: same device, latest answers

  const ids = info.posts.map((p) => JSON.parse(p.body).d);
  expect(ids).toHaveLength(2);
  expect(ids[0]).toBe(ids[1]);
  const stored = await page.evaluate(() => Object.keys(localStorage));
  expect(stored).toEqual(["rc.device"]);
});

test("below the threshold: saved, but no average shown", async ({ page }, info) => {
  await setup(page, info, { others: config.minCompare - 2 });
  await page.goto(URL_);
  await finish(page, [1, 0, 1, 0, 1, 0]);
  await page.locator("#compareBtn").click();
  await expect(page.locator("#compareStatus")).toContainText(`ההשוואה תופיע מ-${config.minCompare} משיבים`);
  await expect(page.locator("#radar .shape.avg")).toHaveCount(0);
  await expect(page.locator("#compareBtn")).toHaveText("לבדוק שוב");
});

test("offline: the result stays and the button can retry", async ({ page }, info) => {
  await setup(page, info, { others: 6, down: true });
  await page.goto(URL_);
  await finish(page, [1, 1, 1, 1, 1, 1]);
  await page.locator("#compareBtn").click();
  await expect(page.locator("#compareStatus")).toContainText("לא הצלחנו להתחבר");
  await expect(page.locator("#compareBtn")).toBeEnabled();
  await expect(page.locator("#total")).toHaveText("6");
});

test("restart clears the comparison", async ({ page }, info) => {
  await setup(page, info, { others: 6 });
  await page.goto(URL_);
  await finish(page, [3, 3, 3, 3, 3, 3]);
  await page.locator("#compareBtn").click();
  await expect(page.locator("#radar .shape.avg")).toHaveCount(1);
  await page.getByRole("button", { name: "להתחיל מחדש" }).click();
  await finish(page, [0, 0, 0, 0, 0, 0]);
  await expect(page.locator("#radar .shape.avg")).toHaveCount(0);
  await expect(page.locator("#compareStatus")).toHaveText("");
});
