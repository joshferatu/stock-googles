import { expect, test } from "@playwright/test";

import { login, mockMarketApi, seedFavorites } from "./helpers";

test.describe("dashboard", () => {
  test.beforeEach(async ({ page }) => {
    await mockMarketApi(page);
    await seedFavorites(page);
    await login(page);
  });

  test("renders watchlist first, then movers and news", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Market overview" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Your watchlist" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Open Apple Inc." })).toBeVisible();
    await expect(page.getByRole("link", { name: "Open Microsoft Corporation" })).toBeVisible();
    await expect(page.getByText("$342.56").first()).toBeVisible();
    await expect(page.getByText("+1.86%").first()).toBeVisible();

    await expect(page.getByText("Market movers")).toBeVisible();
    await page.getByRole("tab", { name: "Losers" }).click();
    await expect(page.getByText("$180.00")).toBeVisible();

    await expect(page.getByText("Apple unveils new chips at its developer event")).toBeVisible();
    await expect(page.getByText("S&P 500")).toBeVisible();

    await page.screenshot({ path: "/tmp/sg-dashboard.png", fullPage: true });
  });

  test("light theme applies and survives a reload", async ({ page }) => {
    await page.getByRole("button", { name: "Switch to light theme" }).first().click();
    await expect(page.locator("html")).not.toHaveClass(/dark/);
    await page.reload();
    await expect(page.locator("html")).not.toHaveClass(/dark/);
  });

  test("currency switch converts quote prices", async ({ page }) => {
    await page.getByLabel("Display currency").first().selectOption("EUR");
    await expect(page.getByText("€311.42").first()).toBeVisible();
  });
});

test.describe("private alpha auth", () => {
  test("password → Google → app, shows the email and signs out", async ({ page }) => {
    await mockMarketApi(page);
    await page.goto("/login");
    await expect(page.getByText(/Private Alpha — early access/)).toBeVisible();

    await page.getByLabel("Shared password").fill("test-pass");
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page).toHaveURL(/\/login\/google/);
    await expect(page.getByText("Step 2 of 2")).toBeVisible();

    await page.getByLabel("Google email").fill("alpha@gmail.com");
    await page.getByRole("button", { name: "Continue with Google" }).click();
    await expect(page.getByRole("heading", { name: "Market overview" })).toBeVisible();

    await page.getByRole("button", { name: "Settings" }).last().click();
    await expect(page.getByText("alpha@gmail.com")).toBeVisible();
    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/login/);
  });

  test("rejects a non-gmail mock account", async ({ page }) => {
    await mockMarketApi(page);
    await page.goto("/login");
    await page.getByLabel("Shared password").fill("test-pass");
    await page.getByRole("button", { name: "Continue" }).click();
    await page.waitForURL((url) => url.pathname === "/login/google");
    await page.getByLabel("Google email").fill("alpha@company.com");
    await page.getByRole("button", { name: "Continue with Google" }).click();
    await expect(page.getByText(/Use an @gmail\.com email address/)).toBeVisible();
  });
});

test.describe("search and favourites", () => {
  test("star from search persists after reload", async ({ page }) => {
    await mockMarketApi(page);
    await login(page);

    await page.goto("/search");
    await page.getByLabel("Search companies, ETFs and indices").fill("telefonica");
    const result = page.getByRole("option").filter({ hasText: "Telefónica" });
    await expect(result).toBeVisible();

    await page.getByRole("button", { name: "Add TEF.MC to favourites" }).click();
    await expect(page.getByText("TEF.MC added to favourites")).toBeVisible();

    await page.reload();
    const stored = await page.evaluate(() => window.localStorage.getItem("sg:favorites:v1"));
    expect(stored).toContain("TEF.MC");

    await page.goto("/favorites");
    await expect(page.getByRole("heading", { name: "Your favourites" })).toBeVisible();
    await expect(page.getByText("Telefónica, S.A.").first()).toBeVisible();
    await expect(page.getByText("€3.36").first()).toBeVisible();
  });

  test("search palette opens with the keyboard shortcut", async ({ page }) => {
    await mockMarketApi(page);
    await login(page);

    await page.keyboard.press("Control+k");
    const input = page.getByLabel("Search companies, ETFs and indices");
    await expect(input).toBeVisible();
    await input.fill("nvidia");
    await expect(page.getByRole("option").filter({ hasText: "NVIDIA" })).toBeVisible();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("heading", { name: "NVIDIA Corporation" })).toBeVisible();
  });

  test("empty watchlist invites the user to add companies", async ({ page }) => {
    await mockMarketApi(page);
    await login(page);
    await expect(page.getByText("Build your own watchlist")).toBeVisible();
    await expect(page.getByRole("button", { name: "Search the market" })).toBeVisible();
  });
});

test.describe("stock detail", () => {
  test("shows quote, chart, statistics and news; ranges refetch", async ({ page }) => {
    // Delay the chart response: the chart must initialise even when data is not
    // available on the first render (a production race condition regression).
    await mockMarketApi(page, { chartDelayMs: 800 });
    await login(page);
    await page.goto("/stock/AAPL");

    await expect(page.getByRole("heading", { name: "Apple Inc." })).toBeVisible();
    await expect(page.getByText("$342.56").first()).toBeVisible();
    await expect(page.getByText("Key statistics")).toBeVisible();
    await expect(page.getByText("52-week range")).toBeVisible();
    await expect(page.getByText("Apple unveils new chips at its developer event")).toBeVisible();
    await expect(page.locator("canvas").first()).toBeVisible();

    const chartRequest = page.waitForRequest(
      (request) => request.url().includes("/api/chart") && request.url().includes("range=1M"),
    );
    await page.getByRole("tab", { name: "1M" }).click();
    await chartRequest;
    await expect(page.getByRole("tab", { name: "1M" })).toHaveAttribute("aria-selected", "true");

    await page.screenshot({ path: "/tmp/sg-stock.png", fullPage: true });
  });

  test("favourites star toggles from the detail header", async ({ page }) => {
    await mockMarketApi(page);
    await login(page);
    await page.goto("/stock/TEF.MC");

    await expect(page.getByRole("heading", { name: "Telefónica, S.A." })).toBeVisible();
    await page.getByRole("button", { name: "Add TEF.MC to favourites" }).click();
    await expect(page.getByRole("button", { name: "Remove TEF.MC from favourites" })).toBeVisible();
    await page.getByRole("button", { name: "Remove TEF.MC from favourites" }).click();
    await expect(page.getByRole("button", { name: "Add TEF.MC to favourites" })).toBeVisible();
  });
});
