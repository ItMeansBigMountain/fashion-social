import { expect, test } from "@playwright/test";

const viewports = [
  { name: "320px safety", width: 320, height: 568 },
  { name: "iPhone X/XS/11 Pro", width: 375, height: 812 },
  { name: "iPhone XR/11/XS Max", width: 414, height: 896 },
  { name: "iPhone 12/13/14", width: 390, height: 844 },
  { name: "iPhone 14/15 Pro", width: 393, height: 852 },
  { name: "iPhone Pro Max", width: 430, height: 932 },
];

for (const viewport of viewports) {
  test(`${viewport.name} has no overflow and usable voting controls`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto("/");
    await expect(page.getByRole("heading", { name: /Wear what everyone/ })).toBeVisible();
    await page.locator("#shop").scrollIntoViewIfNeeded();
    const like = page.getByRole("button", { name: "Like After Dark Blazer", exact: true });
    const dislike = page.getByRole("button", { name: "Dislike After Dark Blazer", exact: true });
    await expect(like).toBeVisible();
    const likeBox = await like.boundingBox();
    const dislikeBox = await dislike.boundingBox();
    expect(likeBox?.width).toBeGreaterThanOrEqual(44);
    expect(likeBox?.height).toBeGreaterThanOrEqual(44);
    expect(dislikeBox?.width).toBeGreaterThanOrEqual(44);
    expect(dislikeBox?.height).toBeGreaterThanOrEqual(44);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width);

    await like.click();
    await expect(like).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("button", { name: "View After Dark Blazer" }).click();
    await expect(page.getByRole("dialog", { name: "After Dark Blazer" })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width);
    await expect(page.getByRole("button", { name: /Add to cart/ })).toBeVisible();
  });
}
