// End to end: the real file in a real browser, phone and desktop.
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { pathToFileURL } from "node:url";
import { HTML_PATH, content, variantUrl } from "./_source.mjs";

// Most tests run the local-only variant: the same file with an empty endpoint.
const URL_ = variantUrl("");
const SHIPPED = pathToFileURL(HTML_PATH).href;
const FONT_HOSTS = ["fonts.googleapis.com", "fonts.gstatic.com"];

// P2: any request that is not the file itself or a font fails the test.
test.beforeEach(async ({ page }, info) => {
  info.outsideRequests = [];
  await page.route("**/*", (route) => {
    const u = new URL(route.request().url());
    if (u.protocol === "file:" || u.protocol === "data:") return route.continue();
    if (FONT_HOSTS.includes(u.hostname)) return route.abort(); // offline fallback must still work
    info.outsideRequests.push(u.href);
    return route.abort();
  });
  info.pageErrors = [];
  page.on("pageerror", (e) => info.pageErrors.push(e.message));
});

test.afterEach(async ({}, info) => {
  expect(info.outsideRequests, "requests outside the allow-list").toEqual([]);
  expect(info.pageErrors, "uncaught errors").toEqual([]);
});

async function answer(page, perParadigm) {
  await page.getByRole("button", { name: "מתחילים" }).click();
  for (let i = 0; i < perParadigm.length; i++) {
    await expect(page.locator("#stepTitle")).toHaveText(content.paradigms[i].name);
    for (let j = 0; j < perParadigm[i]; j++) await page.locator(".item").nth(j).click();
    await page.locator("#next").click();
  }
}

test("full flow: questionnaire → result → rulebook", async ({ page }) => {
  await page.goto(URL_);
  await answer(page, [2, 2, 2, 0, 2, 2]);

  await expect(page.locator("#total")).toHaveText("10");
  await expect(page.locator("#maxScore")).toHaveText("מתוך 18");
  await expect(page.locator("#bandTitle")).toHaveText("באמצע המעבר");
  await expect(page.locator("#weakest")).toContainText("Scale Without Mass");
  await expect(page.locator("#radar .vertex.low")).toHaveCount(1);

  await page.getByRole("button", { name: "לספר החוקים החדש" }).click();
  await expect(page.locator("#chapter h2")).toHaveText("Scale Without Mass");
  await expect(page.locator(".clause.hot .em")).toHaveText("כדי לצמוח");
  await expect(page.locator(".chapter-score strong")).toHaveText("0/3");
});

test("answers survive going back", async ({ page }) => {
  await page.goto(URL_);
  await page.getByRole("button", { name: "מתחילים" }).click();
  await page.locator(".item").nth(1).click();
  await page.locator("#next").click();
  await page.locator("#back").click();
  await expect(page.locator("#q0-1")).toBeChecked();
  await expect(page.locator("#q0-0")).not.toBeChecked();
});

test("restart clears everything", async ({ page }) => {
  await page.goto(URL_);
  await answer(page, [3, 3, 3, 3, 3, 3]);
  await expect(page.locator("#total")).toHaveText("18");
  await expect(page.locator("#weakest")).toContainText("סימנת את כל ההיגדים");
  await page.getByRole("button", { name: "להתחיל מחדש" }).click();
  await answer(page, [0, 0, 0, 0, 0, 0]);
  await expect(page.locator("#total")).toHaveText("0");
  await expect(page.locator("#bandTitle")).toHaveText("משחקים לפי הספר הישן");
});

test("rulebook: RTL keyboard navigation and edges", async ({ page }) => {
  await page.goto(URL_);
  await answer(page, [0, 3, 3, 3, 3, 3]);
  await page.getByRole("button", { name: "לספר החוקים החדש" }).click();
  await expect(page.locator("#prevCh")).toBeDisabled();
  await page.keyboard.press("ArrowLeft");
  await expect(page.locator("#chapter h2")).toHaveText(content.paradigms[1].name);
  await page.keyboard.press("ArrowRight");
  await expect(page.locator("#chapter h2")).toHaveText(content.paradigms[0].name);
  await page.getByRole("button", { name: "פרק 6" }).click();
  await expect(page.locator("#nextCh")).toBeDisabled();
});

test("keyboard only: the whole questionnaire works without a mouse", async ({ page }) => {
  await page.goto(URL_);
  await page.getByRole("button", { name: "מתחילים" }).focus();
  await page.keyboard.press("Enter");
  for (let i = 0; i < content.paradigms.length; i++) {
    await page.locator("#q" + i + "-0").focus();
    await page.keyboard.press("Space");
    await page.locator("#next").focus();
    await page.keyboard.press("Enter");
  }
  await expect(page.locator("#total")).toHaveText(String(content.paradigms.length));
});

test("works with fonts blocked (offline fallback)", async ({ page }) => {
  await page.goto(URL_);
  const h1 = page.locator("#intro h1");
  await expect(h1).toBeVisible();
  const family = await h1.evaluate((n) => getComputedStyle(n).fontFamily);
  expect(family).toMatch(/Arial/);
});

test("no horizontal scroll on any screen", async ({ page }) => {
  await page.goto(URL_);
  const noScroll = async () =>
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await noScroll();
  await answer(page, [1, 2, 3, 0, 1, 2]);
  await noScroll();
  await page.getByRole("button", { name: "לספר החוקים החדש" }).click();
  await noScroll();
});

for (const screen of ["intro", "step", "result", "book"]) {
  test(`axe: no serious accessibility violations on ${screen}`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(URL_);
    if (screen !== "intro") await page.getByRole("button", { name: "מתחילים" }).click();
    if (screen === "result" || screen === "book") {
      for (let i = 0; i < content.paradigms.length; i++) await page.locator("#next").click();
    }
    if (screen === "book") await page.getByRole("button", { name: "לספר החוקים החדש" }).click();
    const { violations } = await new AxeBuilder({ page }).include(".wrap").analyze();
    const serious = violations.filter((v) => ["serious", "critical"].includes(v.impact));
    expect(serious.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
  });
}

test("without an endpoint there is no compare button and nothing is stored", async ({ page }) => {
  await page.goto(URL_);
  await expect(page.locator("#privacyLocal")).toBeVisible();
  await answer(page, [1, 1, 1, 1, 1, 1]);
  await expect(page.locator("#compare")).toBeHidden();
  expect(await page.evaluate(() => localStorage.length)).toBe(0);
});

test("the shipped file sends nothing until someone clicks compare", async ({ page }) => {
  await page.goto(SHIPPED);
  await answer(page, [2, 2, 2, 2, 2, 2]);
  await page.getByRole("button", { name: "לספר החוקים החדש" }).click();
  await page.getByRole("button", { name: "חזרה לתוצאה שלי" }).click();
  await page.waitForTimeout(500);
  expect(await page.evaluate(() => localStorage.length)).toBe(0); // afterEach also asserts zero requests
});
