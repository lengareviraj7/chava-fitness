import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const outDir = path.resolve('docs/screenshots/modal-alignment');

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

test.describe('Modal Alignment and Sidebar Layering Suite', () => {
  test('Inward Stock Purchase Modal opens properly unobstructed over sidebar', async ({ page, browserName }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await login(page);

    await page.goto('/stock');
    await page.waitForSelector('button:has-text("Purchases")');
    await page.click('button:has-text("Purchases")');

    // Click Inward Purchase
    const inwardBtn = page.locator('button:has-text("Inward Purchase")');
    await expect(inwardBtn).toBeVisible();
    await inwardBtn.click();

    // Verify Inward Stock Purchase modal header is visible and unobstructed
    const modalTitle = page.locator('h3:has-text("Inward Stock Purchase")');
    await expect(modalTitle).toBeVisible();

    // Verify the "Inward" text is not cut off or covered
    const box = await modalTitle.boundingBox();
    expect(box).not.toBeNull();
    // Modal header X coordinate should be well clear of 0 or sidebar
    expect(box.x).toBeGreaterThan(100);

    // Take 1440x900 screenshot
    await page.screenshot({
      path: path.join(outDir, `inward_modal_1440x900_${browserName}.png`),
      fullPage: false,
    });

    // Test on 1024x768 (where the user's screenshot was taken)
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.waitForTimeout(300);

    await page.screenshot({
      path: path.join(outDir, `inward_modal_1024x768_${browserName}.png`),
      fullPage: false,
    });
  });
});
