import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const outDir = path.resolve('docs/screenshots/bill-edit-delete');

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

test.describe('Bill Edit and Delete / Void Suite', () => {
  test('POS Udhari checkout -> Edit bill details -> Delete/Void mistaken bill and restore inventory', async ({ page }, testInfo) => {
    const browserName = testInfo.project.name;
    await page.setViewportSize({ width: 1440, height: 900 });
    await login(page);

    // 1. Go to Billing (POS)
    await page.goto('/billing');
    await page.waitForSelector('span.uppercase:has-text("Customer")', { timeout: 10000 });

    // Verify top tabs include "Udhari"
    const udhariTabBtn = page.locator('button[data-tab="udhari"]');
    await expect(udhariTabBtn).toBeVisible();

    // 2. Add product to cart with available stock
    const addBtns = page.locator('button:has-text("+ Add")');
    await addBtns.first().waitFor({ state: 'visible', timeout: 10000 });
    const count = await addBtns.count();
    for (let i = count - 1; i >= 0; i--) {
      await addBtns.nth(i).click();
      await page.waitForTimeout(200);
      const isOut = await page.locator('text=Insufficient stock').isVisible();
      if (!isOut) break;
      const removeBtn = page.locator('div.border-b button:has(svg)').last();
      if (await removeBtn.isVisible()) await removeBtn.click();
    }
    await page.waitForSelector('text=Grand Total:', { timeout: 5000 });

    // 3. Attach customer
    const newCustomerBtn = page.getByRole('button', { name: 'New customer', exact: true });
    const uniqueSuffix = Math.floor(1000 + Math.random() * 9000);
    const uniquePhone = '94' + Math.floor(10000000 + Math.random() * 90000000);
    const custName = `Viraj Lengare ${uniqueSuffix}`;

    if (await newCustomerBtn.isVisible()) {
      await newCustomerBtn.click();
      await page.waitForSelector('h3:has-text("New customer")');
      await page.fill('input[placeholder*="Ramesh"]', custName);
      await page.fill('input[placeholder="9876543210"]', uniquePhone);
      await page.click('button:has-text("Save and add to bill")');
      await page.waitForSelector(`text=${custName}`, { timeout: 8000 });
    }

    // 4. In Single-Process Counter Panel: enter partial payment to trigger Udhari
    const paidInput = page.locator('[data-testid="amount-paid-now"]');
    await paidInput.waitFor({ state: 'visible' });
    await paidInput.fill('100');

    // Verify Remaining Udhari alert badge
    await expect(page.locator('text=Remaining Udhari:')).toBeVisible();

    // 5. Click "Generate Bill with Udhari"
    const genBillBtn = page.locator('button:has-text("Generate Bill with Udhari")');
    await expect(genBillBtn).toBeVisible();
    await genBillBtn.click();

    // Wait for Sale Completed Modal and close it
    await page.waitForSelector('h3:has-text("Sale Completed!")', { timeout: 10000 });
    const doneBtn = page.locator('button:has-text("Start New Bill")');
    await doneBtn.click();
    await expect(page.locator('h3:has-text("Sale Completed!")')).not.toBeVisible();

    // 6. Switch to Udhari Tab
    await udhariTabBtn.click();
    await page.waitForSelector('text=Total Udhari', { timeout: 10000 });
    await page.waitForTimeout(600);

    // Locate the bill card for our customer
    const billCard = page.locator('div.border', { has: page.locator(`h4:has-text("${custName}")`) }).first();
    await expect(billCard).toBeVisible();

    // Capture screenshot of Udhari card showing Edit and Delete buttons
    await page.screenshot({
      path: path.join(outDir, `udhari-card-with-actions-${browserName}.png`),
      fullPage: false,
    });

    // 7. Test EDIT option
    const editBtn = billCard.locator('button:has-text("Edit")');
    await expect(editBtn).toBeVisible();
    await editBtn.click();

    // Edit modal should open
    const editModal = page.locator('h3:has-text("Edit Bill #")');
    await expect(editModal).toBeVisible();

    // Change village to "Visapur Sangli"
    const villageInput = page.locator('input[placeholder="Visapur"]');
    await villageInput.fill('Visapur Sangli');
    await page.waitForTimeout(300);

    // Screenshot of Edit modal
    await page.screenshot({
      path: path.join(outDir, `edit-bill-modal-${browserName}.png`),
      fullPage: false,
    });

    // Save changes
    await page.click('button[type="submit"]:has-text("Save Changes")');
    await page.waitForSelector('span:has-text("Bill updated successfully!")');
    await expect(editModal).not.toBeVisible({ timeout: 5000 });

    // Verify card displays updated address "Visapur Sangli"
    await expect(billCard.locator('text=Visapur Sangli')).toBeVisible();

    // 8. Test DELETE option (mistaken bill removal)
    const deleteBtn = billCard.locator('button:has-text("Delete")');
    await expect(deleteBtn).toBeVisible();
    await deleteBtn.click();

    // Delete modal should open
    const deleteModal = page.locator('h3:has-text("Delete Mistaken Bill")');
    await expect(deleteModal).toBeVisible();
    await expect(page.locator('text=All sold products will be restored back into inventory batches')).toBeVisible();

    // Screenshot of Delete modal
    await page.screenshot({
      path: path.join(outDir, `delete-bill-modal-${browserName}.png`),
      fullPage: false,
    });

    // Confirm delete
    await page.click('button[type="submit"]:has-text("Confirm Delete & Restore Stock")');
    await page.waitForSelector('span:has-text("inventory restored to stock!")');
    await expect(deleteModal).not.toBeVisible({ timeout: 5000 });

    // Verify card is removed from Udhari tab
    await expect(billCard).not.toBeVisible({ timeout: 5000 });

    // Final screenshot showing card removed
    await page.screenshot({
      path: path.join(outDir, `udhari-tab-cleared-${browserName}.png`),
      fullPage: false,
    });
  });
});
