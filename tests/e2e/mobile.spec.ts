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
