import { test, expect } from "./fixtures";

test.describe("Navigation", () => {
  test("navigates from home to methodology", async ({ mockPage }) => {
    await mockPage.goto("/");
    await mockPage.getByText("Methodology").click();
    await expect(
      mockPage.getByRole("heading", { name: "Methodology" })
    ).toBeVisible();
  });

  test("navigates from methodology back to home", async ({ mockPage }) => {
    await mockPage.goto("/methodology");
    await mockPage.getByText("Back to score").first().click();
    await expect(
      mockPage.getByRole("heading", { name: /Will AI replace/i })
    ).toBeVisible();
  });

  test("logo navigates to home from methodology", async ({ mockPage }) => {
    await mockPage.goto("/methodology");
    // The logo is a link with "one?" text
    await mockPage.locator('a[href="/"]').first().click();
    await expect(
      mockPage.getByRole("heading", { name: /Will AI replace/i })
    ).toBeVisible();
  });
});
