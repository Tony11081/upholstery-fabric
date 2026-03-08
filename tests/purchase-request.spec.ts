import { test, expect } from "@playwright/test";

test("search -> pdp -> buy now -> checkout address", async ({ page, request }) => {
  const res = await request.get("/api/products?limit=1");
  const json = await res.json();
  const product = json?.data?.products?.[0] ?? json?.products?.[0];
  if (!product) {
    test.skip(true, "No products available for purchase flow test.");
  }

  const query = String(product.titleEn ?? product.slug ?? "bag").split(" ")[0];

  await page.goto(`/search/results?q=${encodeURIComponent(query)}`);
  await page.getByRole("link", { name: String(product.titleEn) }).first().click();

  await page.getByRole("button", { name: /buy now/i }).first().click();

  await expect(page).toHaveURL(/\/checkout\/address/);
  await expect(page.getByRole("heading", { name: /shipping address/i })).toBeVisible();
});
