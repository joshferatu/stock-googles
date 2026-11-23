import { expect, test } from "@playwright/test";

import { login, mockMarketApi, seedFavorites } from "./helpers";

test("mobile layout uses the bottom navigation", async ({ page }) => {
  await mockMarketApi(page);
  await seedFavorites(page);
  await login(page);

  await expect(page.getByRole("heading", { name: "Market overview" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Open Apple Inc." })).toBeVisible();

  const favouritesTab = page.getByRole("link", { name: /Favourites/ }).last();
  await expect(favouritesTab).toBeVisible();
  await favouritesTab.click();
  await expect(page.getByRole("heading", { name: "Your favourites" })).toBeVisible();

  await page.screenshot({ path: "/tmp/sg-mobile-favorites.png", fullPage: true });
});

test("dashboard stays within the viewport width", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await mockMarketApi(page);
  await seedFavorites(page);
  await login(page);

  await expect(page.getByRole("heading", { name: "Market overview" })).toBeVisible();
  await expect(page.getByText("Market movers")).toBeVisible();
  await expect(page.getByText("Market news")).toBeVisible();

  // Long headlines and instrument names must wrap or truncate, never widen the page.
  const widths = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth,
  }));
  expect(widths.scroll).toBeLessThanOrEqual(widths.client);

  // The fixed bottom bar must match the viewport, not the scrollable area.
  const nav = page.getByRole("navigation", { name: "Main navigation" }).last();
  const box = await nav.boundingBox();
  expect(box).not.toBeNull();
  expect(Math.round(box!.width)).toBe(widths.client);
  expect(Math.round(box!.x)).toBe(0);
});

test("sticky chrome survives a long dashboard scroll", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 640 });
  await mockMarketApi(page);
  await seedFavorites(page);
  await login(page);
  await expect(page.getByRole("heading", { name: "Market overview" })).toBeVisible();

  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(300);

  const header = page.locator("header");
  const headerBox = await header.boundingBox();
  expect(Math.round(headerBox!.y)).toBe(0);

  const nav = page.getByRole("navigation", { name: "Main navigation" }).last();
  const navBox = await nav.boundingBox();
  expect(Math.round(navBox!.y + navBox!.height)).toBe(640);
});
