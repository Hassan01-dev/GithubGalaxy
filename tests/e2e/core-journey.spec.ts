import { expect, test } from "@playwright/test";

test("landing → explore → search → details → copy link → share page", async ({ page, isMobile }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));

  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Explore the universe of open source." })).toBeVisible();
  await page.getByRole("link", { name: /Enter the Galaxy/ }).click();
  await expect(page).toHaveURL(/\/galaxy\/trending/);

  // Keyboard path: search, pick the first result with Enter.
  const search = page.getByRole("combobox", { name: "Search repositories" });
  await search.click();
  await search.fill("ai");
  const first = page.getByRole("listbox", { name: "Search results" }).getByRole("option").first();
  await expect(first).toBeVisible();
  const fullName = (await first.locator("span.truncate").first().textContent())!.trim();
  await search.press("Enter");

  await expect(page).toHaveURL(new RegExp(`repo=${encodeURIComponent(fullName).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`));
  const panel = page.getByRole("complementary", { name: `${fullName} details` });
  await expect(panel).toBeVisible();
  await expect(panel.getByRole("link", { name: /Open on GitHub/ })).toHaveAttribute("href", `https://github.com/${fullName}`);

  // Save survives reload; the deep link restores the panel.
  await panel.getByRole("button", { name: "Save planet" }).click();
  await page.reload();
  await expect(page.getByRole("complementary", { name: `${fullName} details` }).getByRole("button", { name: "Saved" })).toBeVisible();

  if (!isMobile) {
    await page.getByRole("complementary").getByRole("button", { name: "Copy link" }).click();
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    expect(copied).toMatch(new RegExp(`/repo/${fullName}$`, "i"));
  }

  // Escape returns to the overview.
  await page.keyboard.press("Escape");
  await expect(page).not.toHaveURL(/repo=/);

  // The share page works without WebGL.
  await page.goto(`/repo/${fullName}`);
  await expect(page.getByRole("heading", { name: fullName.split("/")[1] })).toBeVisible();
  await expect(page.getByRole("link", { name: /See it in / }).first()).toBeVisible();

  expect(errors).toEqual([]);
});

test("list view and filters are usable and reflected in the URL", async ({ page }) => {
  await page.goto("/galaxy/trending?view=list&minStars=1000");
  await expect(page.getByText(/repositories$/).first()).toBeVisible();
  await page.getByRole("button", { name: /Filters/ }).click();
  await expect(page.getByLabel("Minimum stars")).toHaveValue("1000");
  await page.getByRole("button", { name: "Clear filters" }).click();
  await expect(page).not.toHaveURL(/minStars/);
});

test("unknown repository shows a not-found state", async ({ page }) => {
  await page.goto("/repo/this-owner-does-not-exist-zz/nothing-here-zz");
  // Without a token GitHub's 60/h core quota can run out; then the honest answer is "rate limited", not 404.
  await expect(page.getByRole("heading", { name: "Lost in space" }).or(page.getByText(/rate limit reached/))).toBeVisible();
});

test("AI galaxy shows its topic systems with their definitions", async ({ page }) => {
  await page.goto("/galaxy/ai?view=list");
  for (const name of ["Agents", "Retrieval & RAG", "Computer vision"]) await expect(page.getByRole("heading", { name })).toBeVisible();
  await expect(page.getByText(/Tagged with the GitHub topic “rag”/)).toBeVisible();
});

test("flight mode flies the ship and Esc returns to orbit", async ({ page, isMobile }) => {
  test.skip(isMobile, "Flight mode is keyboard-only and hidden on touch devices");
  await page.goto("/galaxy/trending");
  await page.getByRole("img", { name: /3D galaxy view/ }).locator("canvas").waitFor(); // the scene loads lazily; controls attach with it
  await page.getByRole("button", { name: /Flight mode/ }).click();
  await page.waitForTimeout(300);
  const hud = page.getByRole("status").filter({ hasText: "Flight mode" });
  await expect(hud).toBeVisible();
  await page.keyboard.down("KeyW");
  await expect(hud).toContainText(/[1-9]\d* u\/s/, { timeout: 5000 });
  await page.keyboard.up("KeyW");
  await page.keyboard.press("Escape");
  await expect(hud).toBeHidden();
  await expect(page.getByRole("button", { name: "Zoom in" })).toBeVisible();
});

test("guided journey: index → route page → fly → next stop, with a first-visit achievement", async ({ page }) => {
  await page.goto("/journeys");
  await page.getByRole("link", { name: /Start journey/ }).first().click();
  await expect(page).toHaveURL(/\/journeys\/[a-z-]+$/);
  await page.getByRole("link", { name: /Fly this journey/ }).click();
  await expect(page).toHaveURL(/\/galaxy\/constellations\?journey=/);

  const hud = page.getByRole("region", { name: /Editorial journey/ }).or(page.getByLabel(/Editorial journey:/));
  await expect(hud.first()).toContainText("Stop 1 of");
  // Reaching the first stop logs a visit, which unlocks "First contact".
  await expect(page.getByText("First contact").first()).toBeVisible({ timeout: 10_000 });

  await page.getByRole("button", { name: "Next stop", exact: true }).click();
  await expect(page).toHaveURL(/stop=1/);
  await expect(hud.first()).toContainText("Stop 2 of");
});

test("progress and chosen ship persist in the browser across visits", async ({ page, isMobile }) => {
  await page.goto("/galaxy/trending?view=list");
  await page.getByRole("button", { name: /★/ }).first().click(); // open a planet → visit logged → XP
  const badge = page.getByRole("button", { name: /XP/ }).first();
  await expect(badge).toHaveAttribute("aria-label", /[1-9]\d* XP/);
  const before = await badge.getAttribute("aria-label");

  await page.goto("/galaxy/trending");
  await page.getByRole("button", { name: /Hangar/ }).click();
  await page.getByRole("radio", { name: /Manta/ }).click();
  await page.getByRole("button", { name: "Select Manta" }).click();
  await page.keyboard.press("Escape");

  await page.reload();
  await expect(page.getByRole("button", { name: /XP/ }).first()).toHaveAttribute("aria-label", before!);
  await page.getByRole("button", { name: /Hangar/ }).click();
  await expect(page.getByRole("radio", { name: /Manta/ })).toContainText(/in use/i);

  // The landing progress card is desktop-only by design (on phones it would cover the map).
  if (!isMobile) {
    await page.goto("/");
    await expect(page.getByText(/Welcome back/)).toBeVisible();
  }
});
