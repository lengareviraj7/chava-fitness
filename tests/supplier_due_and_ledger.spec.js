import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const outDir = path.resolve('docs/screenshots/supplier-ledger');

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

test.describe('Supplier Due, Ledger and Bill Clearing Suite', () => {
  test('Inward stock with unpaid due -> check supplier card shows due -> open ledger -> pay & clear bill', async ({ page }, testInfo) => {
    const browserName = testInfo.project.name;
    await page.setViewportSize({ width: 1440, height: 900 });
    await login(page);

    await page.goto('/stock');
    await page.waitForSelector('button:has-text("Purchases")');
    await page.click('button:has-text("Purchases")');

    // Open Inward Purchase Modal
    const inwardBtn = page.locator('button:has-text("Inward Purchase")');
    await expect(inwardBtn).toBeVisible();
    await inwardBtn.click();

    const inwardModal = page.locator('h3:has-text("Inward Stock Purchase")');
    await expect(inwardModal).toBeVisible();

    // Discard any active draft if present
    const discardDraftBtn = page.locator('button:has-text("Discard Draft")');
    if (await discardDraftBtn.isVisible()) {
      await discardDraftBtn.click();
      await page.waitForTimeout(400);
    }

    // Register a new distinct supplier via "+ New"
    const randomSuffix = `${Date.now().toString().slice(-4)}${Math.floor(100 + Math.random() * 900)}`;
    const randomPhone = `98${Math.floor(10000000 + Math.random() * 90000000)}`;
    const supplierName = `Ram Bhau Wholesale ${randomSuffix}`;
    const newSupplierTrigger = page.locator('button:has-text("+ New")').first();
    await expect(newSupplierTrigger).toBeVisible();
    await newSupplierTrigger.click();

    await page.waitForSelector('h3:has-text("Register New Supplier")');
    await page.fill('input[placeholder*="Bright Commodities"]', supplierName);
    await page.fill('input[placeholder="10-digit mobile number"]', randomPhone);
    await page.fill('input[placeholder*="Warehouse"]', 'Vita');
    await page.click('button[type="submit"]:has-text("Add Supplier")');

    // Wait for supplier modal to close
    await expect(page.locator('h3:has-text("Register New Supplier")')).not.toBeVisible();

    // Ensure the new supplier is selected
    const supplierSelect = page.locator('select').first();
    await supplierSelect.selectOption({ label: `${supplierName} (${randomPhone})` });

    // Fill invoice details
    const invNo = `INV-${randomSuffix}`;
    await page.fill('input[placeholder*="INV-2026-981"]', invNo);

    // Create an inline product
    const newProductBtn = page.locator('button:has-text("+ New Product")');
    await newProductBtn.click();
    await page.waitForSelector('h3:has-text("New Product & Stock Inward")');

    const productName = `Whey Isolate Protein ${randomSuffix}`;
    await page.fill('input[placeholder*="Gold Standard"]', productName);
    await page.fill('input[placeholder*="Optimum Nutrition"]', 'Chava Nutrition');

    // Variant details
    await page.fill('input[placeholder*="Double Rich Chocolate"]', `Dark Chocolate ${randomSuffix}`);
    await page.fill('input[placeholder*="2 kg or 5 lbs"]', '1 kg');
    await page.fill('input[placeholder="4500"]', '2800'); // MRP
    await page.fill('input[placeholder="3999"]', '2500'); // Selling Price
    await page.fill('input[placeholder="10"]', '10');     // Qty: 10 units -> Total = 10 × 2000 = ₹20,000
    await page.fill('input[placeholder="2800"]', '2000'); // Purchase Price/Unit -> Total = 10 × ₹2,000 = ₹20,000
    await page.fill('input[placeholder="ON-26-A1"]', `BATCH-${randomSuffix}`);
    await page.fill('input[placeholder="MM/YYYY"]', '112027');

    // Save product & add to purchase
    await page.click('button:has-text("Done & Add to Purchase")');
    await page.waitForTimeout(600);

    // In payment section, set Paid Now to 18,000 so remaining due is 2,000 (of 20,000 total)
    const paidNowInput = page.locator('input[placeholder="0"]');
    await paidNowInput.fill('18000');
    await page.waitForTimeout(300);

    // Verify Remaining Due displays ₹2,000.00
    const remainingDueText = page.locator('span:has-text("₹2,000.00")').first();
    await expect(remainingDueText).toBeVisible();

    // Confirm Purchase Inward
    await page.click('button[type="submit"]:has-text("Confirm Purchase Inward")');
    await page.waitForSelector('h4:has-text("Confirm Purchase Inward")');

    // Confirm & Save
    await page.click('button:has-text("Confirm & Save Inward")');
    await page.waitForTimeout(1500);
    await expect(inwardModal).not.toBeVisible({ timeout: 10000 });

    // Switch to Suppliers tab
    await page.click('button:has-text("Suppliers")');
    await page.waitForTimeout(1000);

    // Locate supplier card for Ram Bhau
    const supplierCard = page.locator('div.group', { has: page.locator(`h3:has-text("${supplierName}")`) });
    await expect(supplierCard).toBeVisible();

    // Verify supplier card shows remaining due: ₹2,000.00
    await expect(supplierCard.locator('span:has-text("Remaining to Pay:")')).toBeVisible();
    await expect(supplierCard.locator('span.text-amber-400:has-text("₹2,000.00")')).toBeVisible();

    // Screenshot of Supplier card with due
    await page.screenshot({
      path: path.join(outDir, `supplier-card-with-due-${browserName}.png`),
      fullPage: false,
    });

    // Click on the supplier card / "Pay Due" button
    await supplierCard.click();

    // Verify Supplier Ledger Modal opens
    const ledgerModalHeading = page.locator('h3.font-extrabold', { hasText: supplierName });
    await expect(ledgerModalHeading).toBeVisible();

    // Verify Balance to Pay shows ₹2,000.00
    const balanceToPayBox = page.locator('p:has-text("Balance to Pay")').locator('..');
    await expect(balanceToPayBox).toContainText('₹2,000.00');

    // Verify Inward Purchase Receipts lists the invoice
    await expect(page.locator(`span:has-text("${invNo}")`)).toBeVisible();

    // Verify Amount to Pay input is pre-filled with 2000
    const amountInput = page.locator('input[placeholder="e.g. 2000"]');
    await expect(amountInput).toHaveValue('2000');

    // Screenshot of Supplier Ledger Modal
    await page.screenshot({
      path: path.join(outDir, `supplier-ledger-modal-${browserName}.png`),
      fullPage: false,
    });

    // Click "Pay ₹2,000 & Clear Bill"
    const paySubmitBtn = page.locator('button[type="submit"]:has-text("Pay ₹2,000 & Clear Bill")');
    await expect(paySubmitBtn).toBeVisible();
    await paySubmitBtn.click();

    // Verify success banner and cleared status
    const successAlert = page.locator('span:has-text("All bills are completely cleared")');
    await expect(successAlert).toBeVisible({ timeout: 10000 });

    // Verify Balance to Pay in modal updates to ₹0.00 (All Cleared)
    await expect(balanceToPayBox).toContainText('₹0.00 (All Cleared)');

    // Screenshot of Cleared Supplier Ledger
    await page.screenshot({
      path: path.join(outDir, `supplier-ledger-cleared-${browserName}.png`),
      fullPage: false,
    });

    // Close the modal
    const closeBtn = page.locator('button:has-text("Close Modal")');
    await closeBtn.click();
    await expect(ledgerModalHeading).not.toBeVisible();

    // Verify on Suppliers tab that supplier card shows "All Cleared" / "₹0.00"
    await expect(supplierCard.locator('span:has-text("₹0.00 (All Cleared)")')).toBeVisible();
    await expect(supplierCard.locator('button:has-text("View Ledger & Receipts")')).toBeVisible();

    // Final screenshot
    await page.screenshot({
      path: path.join(outDir, `supplier-card-cleared-${browserName}.png`),
      fullPage: false,
    });
  });
});
