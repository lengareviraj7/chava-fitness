import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const outDir = path.resolve('docs/screenshots/one-step-purchase');

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

test.describe('Quick Add Supplier in Purchase Inward Suite', () => {
  test('Clicking + New next to Supplier opens modal and registers supplier with auto-select', async ({ page, browserName }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await login(page);

    await page.goto('/stock');
    await page.waitForSelector('button:has-text("Purchases")');
    await page.click('button:has-text("Purchases")');

    // Click Inward Purchase
    const inwardBtn = page.locator('button:has-text("Inward Purchase")');
    await expect(inwardBtn).toBeVisible();
    await inwardBtn.click();

    // Verify Inward Purchase Modal is visible
    const modalTitle = page.locator('h3:has-text("Inward Stock Purchase")');
    await expect(modalTitle).toBeVisible();

    // Click "+ New" next to Supplier
    const newSupplierTrigger = page.locator('button:has-text("+ New")').first();
    await expect(newSupplierTrigger).toBeVisible();
    await newSupplierTrigger.click();

    // Verify Register New Supplier modal appears ON TOP
    const supplierModalTitle = page.locator('h3:has-text("Register New Supplier")');
    await expect(supplierModalTitle).toBeVisible();

    // Fill supplier form
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const supplierName = `Apex Global Nutrition ${randomSuffix}`;
    await page.fill('input[placeholder*="Bright Commodities"]', supplierName);
    await page.fill('input[placeholder="10-digit mobile number"]', `98${randomSuffix}1234`);
    await page.fill('input[placeholder*="27AABCC"]', '27AAPCA1234F1Z5');
    await page.fill('input[placeholder*="Warehouse"]', 'Pune Industrial Area');

    // Capture screenshot of open Quick Supplier modal
    await page.screenshot({
      path: path.join(outDir, `quick-add-supplier-modal-${browserName}.png`),
      fullPage: false,
    });

    // Submit
    const addBtn = page.locator('button[type="submit"]:has-text("Add Supplier")');
    await addBtn.click();

    // Verify modal closes
    await expect(supplierModalTitle).not.toBeVisible();

    // Verify that the new supplier is selected in the supplier dropdown
    const supplierSelect = page.locator('select').first();
    const selectedText = await supplierSelect.locator('option:checked').textContent();
    expect(selectedText).toContain(supplierName);

    // Capture screenshot after supplier is auto-selected
    await page.screenshot({
      path: path.join(outDir, `quick-add-supplier-selected-${browserName}.png`),
      fullPage: false,
    });
  });
});
