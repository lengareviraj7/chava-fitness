import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const outDir = path.resolve('docs/screenshots/header-search-notifications');

test.beforeAll(() => {
  fs.mkdirSync(outDir, { recursive: true });
});

async function login(page) {
  await page.goto('/login');
  await page.waitForSelector('input[type="tel"]');
  await page.fill('input[type="tel"]', '9876543210');
  await page.fill('input[type="password"]', 'Owner@123');
  await page.click('button[type="submit"]');
  await page.waitForSelector('#app-sidebar', { timeout: 10000 });
}

test.describe('Header Global Search & Notification Suite', () => {
  test('Search pill and Cmd+K palette work across products and pages', async ({ page }, testInfo) => {
    const browserName = testInfo.project.name;
    await page.setViewportSize({ width: 1440, height: 900 });
    await login(page);

    // 1. Verify Top Header Search Pill is visible
    const searchPill = page.locator('header').locator('text=Search anything...');
    await expect(searchPill).toBeVisible();

    // 2. Click the Search Pill to open Command Palette
    await searchPill.click();
    const searchModal = page.locator('input[placeholder*="Search products, customers, bills"]');
    await expect(searchModal).toBeVisible();

    // Verify initial quick navigation shortcuts
    await expect(page.locator('text=Quick Navigation')).toBeVisible();

    // Screenshot of initial Command Palette
    await page.screenshot({
      path: path.join(outDir, `command-palette-initial-${browserName}.png`),
    });

    // 3. Type a search query (e.g. "Bill")
    await searchModal.fill('Bill');
    await page.waitForTimeout(400);

    // Verify search modal matches navigation or bill items
    await expect(page.locator('button:has-text("New Bill (Counter POS)")')).toBeVisible();

    // Screenshot of Search Results
    await page.screenshot({
      path: path.join(outDir, `command-palette-results-${browserName}.png`),
    });

    // 4. Press Escape to close
    await page.keyboard.press('Escape');
    await expect(searchModal).not.toBeVisible();

    // 5. Test global hotkey (Meta+k or Control+k)
    const modifier = process.platform === 'darwin' ? 'Meta' : 'Control';
    await page.keyboard.press(`${modifier}+k`);
    await expect(searchModal).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(searchModal).not.toBeVisible();
  });

  test('Notification bell opens alerts drawer with filter tabs', async ({ page }, testInfo) => {
    const browserName = testInfo.project.name;
    await page.setViewportSize({ width: 1440, height: 900 });
    await login(page);

    // 1. Find and click Notification Bell in header
    const bellBtn = page.locator('header button[title="Notifications"]');
    await expect(bellBtn).toBeVisible();
    await bellBtn.click();

    // 2. Verify Notification Drawer appears
    const drawerTitle = page.locator('h3:has-text("Notifications")');
    await expect(drawerTitle).toBeVisible();

    // Verify filter pills
    await expect(page.locator('button:has-text("Stock & Expiry")')).toBeVisible();
    await expect(page.locator('button:has-text("Dues & Credit")')).toBeVisible();

    // Screenshot of Notifications Drawer
    await page.screenshot({
      path: path.join(outDir, `notification-drawer-${browserName}.png`),
    });

    // 3. Click Stock filter
    await page.locator('button:has-text("Stock & Expiry")').click();
    await page.waitForTimeout(200);

    // 4. Close drawer
    const closeBtn = page.locator('button[aria-label="Close notifications"]');
    await closeBtn.click();
    await expect(drawerTitle).not.toBeVisible();
  });
});
