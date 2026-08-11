import { expect, test } from "@playwright/test";

test("shopper adds a sized product to a persistent cart", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "View After Dark Blazer" }).click();
  await page.getByLabel("Choose size").selectOption("XS");
  await page.getByRole("button", { name: /Add to cart/ }).click();
  await expect(page.getByRole("button", { name: /Cart, 1 item/ })).toBeVisible();
  await expect(page.getByRole("dialog", { name: "Shopping cart" })).toContainText("After Dark Blazer");
  await expect(page.getByRole("dialog", { name: "Shopping cart" })).toContainText("$148.00");
  await page.reload();
  await page.getByRole("button", { name: /Cart, 1 item/ }).click();
  await expect(page.getByRole("dialog", { name: "Shopping cart" })).toContainText("After Dark Blazer");
});
