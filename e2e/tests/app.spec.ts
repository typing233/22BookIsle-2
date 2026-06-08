import { test, expect } from '@playwright/test';

test.describe('Authentication Flow', () => {
  test('should show login page when not authenticated', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL('/login');
    await expect(page.locator('h2')).toContainText('登录');
  });

  test('should login with valid credentials', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="text"]', 'admin');
    await page.fill('input[type="password"]', 'admin123');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL('/');
  });

  test('should show error with invalid credentials', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="text"]', 'admin');
    await page.fill('input[type="password"]', 'wrongpassword');
    await page.click('button[type="submit"]');
    await expect(page.locator('.error')).toBeVisible();
  });

  test('should redirect to login after logout', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="text"]', 'admin');
    await page.fill('input[type="password"]', 'admin123');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL('/');

    await page.click('text=退出');
    await expect(page).toHaveURL('/login');
  });
});

test.describe('Library Browsing', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="text"]', 'admin');
    await page.fill('input[type="password"]', 'admin123');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL('/');
  });

  test('should display dashboard with libraries', async ({ page }) => {
    await expect(page.locator('.section-title')).toContainText('我的书库');
  });

  test('should navigate to library detail', async ({ page }) => {
    const libraryCard = page.locator('.library-card').first();
    if (await libraryCard.isVisible()) {
      await libraryCard.click();
      await expect(page.locator('.page-title')).toBeVisible();
    }
  });

  test('should search books', async ({ page }) => {
    const searchInput = page.locator('input[placeholder*="搜索"]');
    if (await searchInput.isVisible()) {
      await searchInput.fill('test');
      await searchInput.press('Enter');
      await expect(page).toHaveURL(/q=test/);
    }
  });
});

test.describe('Reader', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="text"]', 'admin');
    await page.fill('input[type="password"]', 'admin123');
    await page.click('button[type="submit"]');
  });

  test('should open reader page', async ({ page }) => {
    await page.goto('/read/1');
    await page.waitForTimeout(2000);
    const readerPage = page.locator('.reader-page');
    const loading = page.locator('.loading');
    await expect(readerPage.or(loading)).toBeVisible();
  });
});

test.describe('Statistics', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="text"]', 'admin');
    await page.fill('input[type="password"]', 'admin123');
    await page.click('button[type="submit"]');
  });

  test('should display statistics page', async ({ page }) => {
    await page.goto('/stats');
    await expect(page.locator('.page-title')).toContainText('阅读统计');
  });
});
