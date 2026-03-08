import { test, expect } from "@playwright/test";

test("track order lookup with mock data", async ({ page }) => {
  await page.goto("/track-order");

  await page.getByLabel("Order number").fill("UOOTD-24001");
  await page.getByLabel("Email").fill("guest@uootd.com");
  await page.getByRole("button", { name: /track order/i }).click();

  await expect(page.getByText("UOOTD-24001")).toBeVisible();
  await expect(page.getByText("MOCK-TRACK")).toBeVisible();
});
