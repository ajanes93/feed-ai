import {
  test,
  expect,
  buildDigestItem,
  feedSlide,
  buildTestData,
} from "./fixtures";
import type { Page } from "@playwright/test";

/** Mock API with items that include comment summaries */
async function mockApiWithComments(page: Page) {
  const { today, yesterday, yesterdayDigest, digestList } = buildTestData();

  const todayDigest = {
    id: `digest-${today}`,
    date: today,
    itemCount: 3,
    items: [
      {
        ...buildDigestItem(
          {
            category: "ai",
            title: "AI Model Breakthrough",
            sourceName: "r/LocalLLaMA",
            sourceUrl:
              "https://www.reddit.com/r/LocalLLaMA/comments/abc/post",
          },
          1,
        ),
        commentSummary:
          "The community was divided on whether this represents a true breakthrough.",
        commentCount: 142,
        commentScore: 523,
        commentSummarySource: "generated",
      },
      buildDigestItem(
        {
          category: "dev",
          title: "Vue 4 Announced",
          sourceName: "Vue.js Blog",
        },
        2,
      ),
      {
        ...buildDigestItem(
          {
            category: "ai",
            title: "New LLM Training Technique",
            sourceName: "Hacker News AI",
            sourceUrl: "https://example.com/llm-training",
          },
          3,
        ),
        commentSummary:
          "Commenters noted this could reduce training costs by 50%.",
        commentCount: 89,
        commentScore: 312,
        commentSummarySource: "generated",
      },
    ],
  };

  await page.route("**/api/digests", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(digestList),
    }),
  );

  await page.route(`**/api/digest/${today}`, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(todayDigest),
    }),
  );

  await page.route(`**/api/digest/${yesterday}`, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(yesterdayDigest),
    }),
  );
}

test.describe("Comment summaries", () => {
  test.beforeEach(async ({ page }) => {
    await mockApiWithComments(page);
  });

  test("shows comment count and score for items with summaries", async ({
    page,
  }) => {
    await page.goto("/");

    const aiSlide = feedSlide(page, "ai");
    await expect(
      aiSlide.locator("article").first().getByText("AI Model Breakthrough"),
    ).toBeVisible();

    // Comment toggle button shows stats
    await expect(aiSlide.getByText("142 comments").first()).toBeVisible();
    await expect(aiSlide.getByText("523 points").first()).toBeVisible();
  });

  test("does not show comments section for items without summaries", async ({
    page,
  }) => {
    await page.goto("/");

    const devSlide = feedSlide(page, "dev");
    await expect(devSlide.getByText("Vue 4 Announced")).toBeVisible();
    // Dev item should not have a comments toggle
    await expect(devSlide.getByText(/comments/)).not.toBeVisible();
  });

  test("toggles comment summary visibility on click", async ({ page }) => {
    await page.goto("/");

    const aiSlide = feedSlide(page, "ai");
    await expect(aiSlide.getByText("142 comments").first()).toBeVisible();

    // Click toggle to show/hide — verify "Discussion" label appears
    const toggleBtn = aiSlide.getByText("142 comments").first();
    await toggleBtn.click();

    // After click, the discussion section should be visible
    await expect(aiSlide.getByText("Discussion").first()).toBeVisible();
    await expect(
      aiSlide.getByText("AI-generated summary").first(),
    ).toBeVisible();

    // Click again to collapse
    await toggleBtn.click();
    await expect(
      aiSlide.getByText("AI-generated summary").first(),
    ).not.toBeVisible();
  });
});
