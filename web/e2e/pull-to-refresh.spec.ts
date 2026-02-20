import { test, expect, feedSlide } from "./fixtures";

test.describe("Pull-to-refresh", () => {
  test("pushes content down instead of overlapping header and filters", async ({
    mockPage,
  }) => {
    await mockPage.goto("/");
    await expect(
      feedSlide(mockPage).getByText("AI Breakthrough")
    ).toBeVisible();

    const content = mockPage.getByTestId("pull-content");

    // Verify no transform initially
    const styleBefore = await content.getAttribute("style");
    expect(styleBefore ?? "").not.toContain("translateY");

    // Simulate pull-to-refresh gesture
    const box = (await content.boundingBox())!;
    const x = box.width / 2;
    await mockPage.dispatchEvent("[data-testid='pull-content']", "touchstart", {
      touches: [{ clientX: x, clientY: 100, identifier: 0 }],
      changedTouches: [{ clientX: x, clientY: 100, identifier: 0 }],
    });
    // Move enough to pass dead zone (25px) but not enough to trigger refresh
    for (let y = 130; y <= 250; y += 20) {
      await mockPage.dispatchEvent(
        "[data-testid='pull-content']",
        "touchmove",
        {
          touches: [{ clientX: x, clientY: y, identifier: 0 }],
          changedTouches: [{ clientX: x, clientY: y, identifier: 0 }],
        }
      );
    }

    // Content container should be translated down
    const styleAfter = await content.getAttribute("style");
    expect(styleAfter).toContain("translateY");

    // Pull indicator should NOT use fixed positioning (scoped to content area)
    const fixedIndicator = content.locator(".fixed");
    await expect(fixedIndicator).toHaveCount(0);

    // Pull indicator should be absolutely positioned above content
    const indicator = content.locator(".absolute.z-20");
    await expect(indicator).toBeVisible();
    const indicatorStyle = await indicator.getAttribute("style");
    expect(indicatorStyle).toContain("top: -");

    // Date header should still be visible (pushed down, not hidden behind overlay)
    const formatted = new Date().toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
    });
    await expect(mockPage.getByText(formatted)).toBeVisible();

    // Release without reaching threshold — content snaps back
    await mockPage.dispatchEvent("[data-testid='pull-content']", "touchend", {
      touches: [],
      changedTouches: [{ clientX: x, clientY: 250, identifier: 0 }],
    });

    // After release, pull indicator should disappear
    await expect(indicator).not.toBeVisible();
  });
});
