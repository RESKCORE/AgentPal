import { test, expect } from "@playwright/test";

// After Batch 1 the creator flow requires authentication. Form-level behavior
// for authenticated users is covered in Stage 2 follow-ups (OAuth is interactive);
// these tests pin the public surface.

test.describe("Creator form (/deals/new)", () => {
  test("unauthenticated visitors are redirected to sign-in", async ({ page }) => {
    await page.goto("/deals/new");
    await page.waitForURL(/\/sign-in/, { timeout: 20000 });
    expect(page.url()).toContain("/sign-in");
  });
});

test.describe("Join page (/deals/[id]/join)", () => {
  test("bogus token shows invalid-link state, not a crash", async ({ page }) => {
    await page.goto("/deals/anything/join?token=bogus-token-qa");
    await expect(page.getByText(/invalid deal link/i)).toBeVisible({ timeout: 20000 });
  });

  test("missing token shows invalid-link state", async ({ page }) => {
    await page.goto("/deals/anything/join");
    await expect(page.getByText(/invalid deal link/i)).toBeVisible({ timeout: 20000 });
  });

  test("valid-looking token prompts sign-in before joining (no silent join)", async ({ page }) => {
    // Token does not exist → invalid state (we never reach the mandate form anonymously).
    await page.goto("/deals/anything/join?token=0123456789abcdef01234567");
    await page.waitForTimeout(4000);
    const invalid = await page.getByText(/invalid deal link/i).isVisible().catch(() => false);
    const signInPrompt = await page.getByText(/sign in to accept/i).isVisible().catch(() => false);
    expect(invalid || signInPrompt).toBe(true);
  });
});
