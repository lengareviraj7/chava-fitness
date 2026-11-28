import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const outDir = path.resolve('docs/screenshots/color-contrast');

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

test.describe('Color Appearance & Contrast Verification', () => {
  test('Stock Table Row Hover and Clicked Appearance (Chromium & WebKit)', async ({ page, browserName }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await login(page);

    await page.goto('/stock');
    await page.waitForSelector('text=Stock & Inventory', { timeout: 10000 });

    const row = page.locator('tbody tr').first();
    await row.waitFor({ state: 'visible', timeout: 8000 });

    // Hover over the row
    await row.hover();
    await page.waitForTimeout(300);

    // Capture hovered screenshot
    await page.screenshot({
      path: path.join(outDir, `stock_row_hover_${browserName}.png`),
      fullPage: false,
    });

    // Click on the row
    await row.click();
    await page.waitForTimeout(400);

    // Capture drawer open screenshot with selected row
    await page.screenshot({
      path: path.join(outDir, `stock_row_clicked_${browserName}.png`),
      fullPage: false,
    });

    // Close drawer
    const closeBtn = page.locator('button:has(svg.lucide-x)').first();
    if (await closeBtn.isVisible()) {
      await closeBtn.click();
    }

    // Go to Billing Bills & Returns table
    await page.goto('/billing');
    await page.waitForSelector('button:has-text("Bills & Returns")');
    await page.click('button:has-text("Bills & Returns")');
    await page.waitForTimeout(600);

    const billRow = page.locator('tbody tr').first();
    if (await billRow.isVisible()) {
      await billRow.hover();
      await page.waitForTimeout(200);
      await page.screenshot({
        path: path.join(outDir, `bills_row_hover_${browserName}.png`),
        fullPage: false,
      });
    }
  });
});
