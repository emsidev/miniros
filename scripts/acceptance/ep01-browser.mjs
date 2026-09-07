/** EP01 running-UI acceptance. See EP01_EVIDENCE.md for the isolated runner command. */
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium } = require(
  process.env.MINIROS_PLAYWRIGHT_MODULE || "playwright",
);
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.MINIROS_CHROMIUM_PATH,
});
const page = await browser.newPage();
const errors = [];
const apiRequests = [];
page.on("pageerror", (error) => errors.push(error.message));
page.on("request", (request) => {
  if (new URL(request.url()).pathname.startsWith("/api/"))
    apiRequests.push(request.url());
});
let checks = 0;
const button = (name) =>
  page
    .getByRole("button", {
      name: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i"),
    })
    .click();
const fill = (label, value) =>
  page.getByLabel(label, { exact: true }).fill(value);
async function check(condition, label) {
  assert(
    await page.evaluate((condition) => Boolean(eval(condition)), condition),
    label,
  );
  console.log(`PASS: ${label}`);
  checks++;
}
try {
  await page.goto("http://localhost:3101/dev/workflow-skeleton");
  await page.getByRole("heading", { name: "Shift walkthrough" }).waitFor();
  await check(
    'document.body.innerText.includes("Nothing is saved or sent")',
    "persistent walkthrough disclosure",
  );
  await button("Schedule");
  await check(
    'JSON.stringify(Array.from(document.querySelectorAll("form input,form select")).map(e => e.closest("label").firstChild.textContent.trim())) === JSON.stringify(["Date","Planned open","Planned close","Venue","Address","Cashier","Prep"])',
    "EP01-T02 exactly seven scheduling essentials, no allocation",
  );
  await check(
    'Array.from(document.querySelectorAll("form input,form select")).every(e => e.required)',
    "all scheduling essentials required",
  );
  await fill("Address", "");
  await button("Preview schedule validation");
  await check(
    '!document.querySelector("form").checkValidity()',
    "empty essential fails browser validation",
  );
  await fill("Address", "Synthetic fixture address");
  await button("Preview schedule validation");
  await check(
    'document.querySelector("[role=status]").textContent.includes("fields are valid")',
    "valid schedule preview without data write",
  );
  await button("Setup");
  await check(
    'document.body.innerText.includes("Packing checklist") && !document.querySelector("form")',
    "business setup remains separate",
  );
  await button("Staff");
  await button("Offline");
  await button("Preview prepare while connected");
  await check(
    'document.querySelector("[role=status]").textContent.includes("connected first")',
    "first preparation does not succeed offline",
  );
  await button("Ready");
  await button("2. Pack");
  await check(
    'Array.from(document.querySelectorAll("button")).find(e=>e.textContent.trim()==="Preview departure check").disabled',
    "critical missing supplies block departure",
  );
  await button("Preview resolve fixture supplies");
  await button("Preview departure check");
  await check(
    'document.querySelector("[role=status]").textContent.includes("departure ready is allowed")',
    "explicit fixture supply resolution",
  );
  await button("3. Count");
  assert.equal(
    await page.getByLabel("Milk count", { exact: true }).inputValue(),
    "",
  );
  assert.equal(
    await page.getByLabel("Paper cups count", { exact: true }).inputValue(),
    "0",
  );
  await check(
    'Array.from(document.querySelectorAll("article")).find(e=>e.querySelector("h3").textContent === "Oat milk").textContent.includes("Not brought") && document.body.innerText.includes("1 unresolved item")',
    "EP01-T03 blank, counted zero, Not brought and unresolved remain distinct",
  );
  await page
    .getByLabel("Count filter", { exact: true })
    .selectOption("uncounted");
  await check(
    'document.querySelectorAll("article").length === 1 && document.querySelector("article h3").textContent === "Milk"',
    "uncounted filter exposes unresolved line",
  );
  await page.getByLabel("Count filter", { exact: true }).selectOption("all");
  await button("Preview count review");
  await check(
    'document.querySelector("[role=status]").textContent.includes("Resolve and review")',
    "unresolved opening cannot pass review",
  );
  await fill("Milk count", "-3");
  assert.equal(
    await page.getByLabel("Milk count", { exact: true }).inputValue(),
    "-3",
  );
  await check(
    'document.querySelector("[role=status]").textContent.includes("non-negative")',
    "invalid text remains visible with validation error",
  );
  await button("Interrupted");
  await fill("Milk count", "3");
  assert.equal(
    await page.getByLabel("Milk count", { exact: true }).inputValue(),
    "3",
  );
  await check(
    'document.querySelector("[role=status]").textContent.includes("not applied or saved") && document.body.innerText.includes("1 unresolved item")',
    "interrupted edit preserves text without applying quantity",
  );
  await button("Ready");
  await button("Preview count review");
  await check(
    'document.querySelector("[role=status]").textContent.includes("invalid or interrupted")',
    "interrupted draft cannot slip through review",
  );
  await fill("Milk count", "0");
  await page
    .getByLabel("I reviewed every opening count and declaration.")
    .check();
  await button("Preview count review");
  await check(
    'document.querySelector("[role=status]").textContent.includes("open is allowed")',
    "resolved counts plus explicit review enable preview",
  );
  await fill("Search count items", "Oat milk");
  await check(
    'document.querySelectorAll("article").length === 1',
    "count search",
  );
  await button("Mark uncounted");
  await check(
    'document.querySelector("article").textContent.includes("Uncounted")',
    "Not brought to uncounted is explicit",
  );
  await button("Mark not brought");
  await check(
    'document.querySelector("article").textContent.includes("Not brought")',
    "explicit Not brought declaration",
  );
  await fill("Search count items", "");
  await page
    .getByLabel("Count category", { exact: true })
    .selectOption("packaging");
  await check(
    'document.querySelectorAll("article").length === 1 && document.querySelector("article h3").textContent === "Paper cups"',
    "category filtering",
  );
  await page.getByLabel("Count category", { exact: true }).selectOption("all");
  for (const width of [360, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await check(
      "document.documentElement.scrollWidth <= window.innerWidth",
      `count page no horizontal overflow at ${width}px`,
    );
  }
  await page.screenshot({
    path: "/tmp/miniros-ep01-count.png",
    fullPage: true,
  });
  await button("4. Sell / Prep");
  await button("Missing");
  await check(
    'Array.from(document.querySelectorAll("button")).find(e=>e.textContent.trim()==="Preview sale action").disabled',
    "missing catalog disables sale preview",
  );
  await button("Loading");
  await check(
    'document.body.innerText.includes("Loading fixture data")',
    "loading state visible",
  );
  await button("Ready");
  await button("Preview sale action");
  await check(
    'document.querySelector("[role=status]").textContent.includes("No sale, stock movement or payment has been saved")',
    "sale preview has no false receipt",
  );
  await button("Preview prep Making");
  await button("Preview prep Done");
  await check(
    'document.body.innerText.includes("Fixture order: done")',
    "prep preview reaches Done",
  );
  await button("5. Close");
  await button("Offline");
  await button("Preview reviewed local close");
  await check(
    'document.querySelector("[role=status]").textContent.includes("closed locally is allowed")',
    "offline closure preview separate from cloud",
  );
  await check(
    '!document.querySelector("[data-nextjs-dialog]")',
    "no framework overlay",
  );
  assert.deepEqual(apiRequests, [], "no application API requests");
  assert.deepEqual(errors, [], "no browser errors");
  console.log(
    `EP01-T02 and EP01-T03 PASSED; ${checks} named assertions plus 6 value/API/error assertions; W only, no native/hosted/persistence claim.`,
  );
} finally {
  await browser.close();
}
