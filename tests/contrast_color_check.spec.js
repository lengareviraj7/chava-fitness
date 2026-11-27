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

test('Billing Page Color Contrast & Select Option Visibility', async ({ page, browserName }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await login(page);

  await page.goto('/billing');
  await page.waitForSelector('span.uppercase:has-text("Customer")', { timeout: 10000 });

  // Wait for catalog products to load and click the first item to add to cart
  const addBtn = page.locator('span:has-text("+ Add")').first();
  await addBtn.waitFor({ state: 'visible', timeout: 10000 });
  await addBtn.click();

  // Attach customer or create one if not present
  const customerSearch = page.locator('input[placeholder*="Search customer"]');
  if (await customerSearch.isVisible()) {
    await customerSearch.fill('9876543210');
    // If not found, use quick add
    const quickAddBtn = page.getByRole('button', { name: 'New customer', exact: true });
    if (await quickAddBtn.isVisible()) {
      await quickAddBtn.click();
      await page.waitForSelector('h3:has-text("New customer")');
      const testPhone = '95' + Math.floor(10000000 + Math.random() * 90000000);
      await page.fill('input[placeholder*="Ramesh"]', 'Viraj Lengare');
      await page.fill('input[placeholder="9876543210"]', testPhone);
      await page.click('button:has-text("Save and add to bill")');
      await page.waitForSelector('text=Viraj Lengare', { timeout: 8000 });
    }
  }

  // Ensure Customer card and Totals card are visible
  await expect(page.locator('text=Grand Total:')).toBeVisible();

  // Take screenshot of billing counter with attached customer & totals
  await page.screenshot({
    path: path.join(outDir, `billing_contrast_${browserName}_1440x900.png`),
    fullPage: false,
  });

  // Check Products Page modal dropdown visibility
  await page.goto('/products');
  await page.waitForSelector('button:has-text("Add Product")', { timeout: 10000 });
  await page.click('button:has-text("Add Product")');
  await page.waitForSelector('h2:has-text("Add Product")', { timeout: 10000 });

  await page.screenshot({
    path: path.join(outDir, `product_modal_contrast_${browserName}.png`),
    fullPage: false,
  });
});
