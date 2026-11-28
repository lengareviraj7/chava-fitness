import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const outDir = path.resolve('docs/screenshots/udhari-flow');

test.beforeAll(async () => {
  fs.mkdirSync(outDir, { recursive: true });

  // Ensure test product and stock batches exist
  try {
    const loginRes = await fetch('http://localhost:5001/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: '9876543210', password: 'Owner@123' })
    });
    const cookie = loginRes.headers.get('set-cookie');
    if (cookie) {
      const prodRes = await fetch('http://localhost:5001/api/products', { headers: { Cookie: cookie } });
      let prods = (await prodRes.json()).data?.products || [];
      
      if (prods.length === 0) {
        const catRes = await fetch('http://localhost:5001/api/categories', { headers: { Cookie: cookie } });
        const cats = (await catRes.json()).data?.categories || [];
        const categoryId = cats[0]?._id;

        const createProd = await fetch('http://localhost:5001/api/products', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Cookie: cookie },
          body: JSON.stringify({
            name: 'Pro Gold Whey Protein',
            brand: 'Chava Nutrition',
            category: categoryId,
            hsn: '21069099',
            gstRate: 0,
            variants: [{
              flavour: 'Belgian Chocolate',
              size: '1 kg',
              sku: 'CG-WPI-' + Date.now().toString().slice(-4),
              mrp: 3500,
              sellingPrice: 3000,
              purchasePrice: 2200,
              stock: 50
            }]
          })
        });
        const createdJson = await createProd.json();
        if (createdJson.data?.product) {
          prods = [createdJson.data.product];
        }
      }

      const p = prods[0];
      const v = p?.variants?.[0];

      let suppRes = await fetch('http://localhost:5001/api/suppliers', { headers: { Cookie: cookie } });
      let suppliers = (await suppRes.json()).data?.suppliers || [];
      let supplierId = suppliers[0]?._id;
      if (!supplierId) {
        const createSup = await fetch('http://localhost:5001/api/suppliers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Cookie: cookie },
          body: JSON.stringify({ name: 'Chava Wholesale Suppliers', phone: '9876500000', state: 'Maharashtra' })
        });
        const supJson = await createSup.json();
        supplierId = supJson.data?.supplier?._id;
      }

      if (p && v && supplierId) {
        await fetch('http://localhost:5001/api/purchases', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Cookie: cookie },
          body: JSON.stringify({
            supplierId,
            supplierInvoiceNo: 'INV-' + Date.now(),
            invoiceDate: new Date().toISOString().slice(0, 10),
            items: [{
              productId: p._id,
              variantId: v._id,
              qty: 50,
              unitCostPaise: 220000,
              batchNo: 'BATCH-' + Date.now().toString().slice(-4),
              expiryMonth: '12/2028',
              mrpPaise: 350000,
              sellingPricePaise: 300000
            }],
            paidAmountPaise: 11000000,
            paymentMode: 'cash'
          })
        });
      }
    }
  } catch (e) {
    console.warn('Pre-seeding stock notice:', e.message);
  }
});

async function login(page) {
  await page.goto('/login');
  await page.waitForSelector('input[type="tel"]');
  await page.fill('input[type="tel"]', '9876543210');
  await page.fill('input[type="password"]', 'Owner@123');
  await page.click('button[type="submit"]');
  await page.waitForSelector('#app-sidebar', { timeout: 10000 });
}

test.describe.configure({ mode: 'serial' });

test.describe('Unified Single-Process Billing & Udhari Credit Management', () => {
  test('POS Counter Single-Process Checkout with Udhari and WhatsApp Greeting', async ({ page, browserName }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await login(page);

    await page.goto('/billing');
    await page.waitForSelector('span.uppercase:has-text("Customer")', { timeout: 10000 });

    // Verify top tabs include "Udhari"
    const udhariTabBtn = page.locator('button[data-tab="udhari"]');
    await expect(udhariTabBtn).toBeVisible();

    // 1. Add product to cart
    const addBtn = page.locator('span:has-text("+ Add")').first();
    await addBtn.waitFor({ state: 'visible', timeout: 10000 });
    await addBtn.click();

    // Wait for cart totals to render
    await page.waitForSelector('text=Grand Total:', { timeout: 5000 });

    // 2. Attach or create customer
    const newCustomerBtn = page.getByRole('button', { name: 'New customer', exact: true });
    if (await newCustomerBtn.isVisible()) {
      await newCustomerBtn.click();
      await page.waitForSelector('h3:has-text("New customer")');
      const uniquePhone = '94' + Math.floor(10000000 + Math.random() * 90000000);
      await page.fill('input[placeholder*="Ramesh"]', 'Sanjay Shinde');
      await page.fill('input[placeholder="9876543210"]', uniquePhone);
      await page.click('button:has-text("Save and add to bill")');
      await page.waitForSelector('text=Sanjay Shinde', { timeout: 8000 });
    }

    // 3. In Single-Process Counter Panel: enter partial payment to trigger Udhari
    const paidInput = page.locator('[data-testid="amount-paid-now"]');
    await paidInput.waitFor({ state: 'visible' });
    await paidInput.fill('10');

    // Verify Remaining Udhari alert badge and Promised Date field are visible
    await expect(page.locator('text=Remaining Udhari:')).toBeVisible();
    await expect(page.locator('input[type="date"]')).toBeVisible();

    // Take screenshot of Single-Process Counter with Udhari
    await page.screenshot({
      path: path.join(outDir, `1440x900_counter_udhari_${browserName}.png`),
      fullPage: false,
    });

    // 4. Click "Generate Bill with Udhari"
    const genBillBtn = page.locator('button:has-text("Generate Bill with Udhari")');
    await expect(genBillBtn).toBeVisible();
    await genBillBtn.click();

    // Wait for Sale Completed Modal
    await page.waitForSelector('h3:has-text("Sale Completed!")', { timeout: 10000 });
    await expect(page.locator('text=Greetings from Chava Fitness Club, Visapur!')).toBeVisible();
    await expect(page.locator('text=Remaining Balance (Udhari):')).toBeVisible();

    // Take screenshot of Receipt with WhatsApp greeting
    await page.screenshot({
      path: path.join(outDir, `receipt_greeting_${browserName}.png`),
      fullPage: false,
    });

    // Close completed modal
    await page.click('button:has-text("Start New Bill")');

    // 5. Navigate to Udhari Tab
    await udhariTabBtn.click();
    await page.waitForSelector('text=Total Udhari', { timeout: 10000 });

    // Verify Sanjay Shinde is listed with due
    await expect(page.locator('text=Sanjay Shinde').first()).toBeVisible();
    await expect(page.locator('text=Visapur').first()).toBeVisible();

    // Take screenshot of Udhari Section
    await page.screenshot({
      path: path.join(outDir, `udhari_tab_${browserName}.png`),
      fullPage: false,
    });

    // 6. Test Collect & Clear
    const collectBtn = page.locator('button:has-text("Collect & Clear")').first();
    await collectBtn.click();
    await page.waitForSelector('h3:has-text("Collect & Clear Udhari")');

    // Confirm settlement
    await page.click('button:has-text("Confirm Payment & Clear")');
    await page.waitForSelector('text=Settled successfully!', { timeout: 8000 });

    // 7. Verify in Bills & Returns that bill history is preserved
    const historyTabBtn = page.locator('button:has-text("Bills & Returns")');
    await historyTabBtn.click();
    await page.waitForSelector('th:has-text("Bill No")', { timeout: 10000 });
    await expect(page.locator('text=Sanjay Shinde').first()).toBeVisible();
  });

  test('Multi-Viewport Responsive Verification (1440x900, 1024x768, 768x1024, 390x844)', async ({ page, browserName }) => {
    const viewports = [
      { width: 1440, height: 900, name: '1440x900' },
      { width: 1024, height: 768, name: '1024x768' },
      { width: 768, height: 1024, name: '768x1024' },
      { width: 390, height: 844, name: '390x844' },
    ];

    await login(page);

    for (const vp of viewports) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto('/billing');
      await page.waitForSelector('h1:has-text("Billing & POS Counter")', { timeout: 10000 });

      // Click Udhari Tab
      await page.locator('button[data-tab="udhari"]').click();
      await page.waitForSelector('text=Total Udhari', { timeout: 10000 });

      await page.screenshot({
        path: path.join(outDir, `${vp.name}_udhari_${browserName}.png`),
        fullPage: false,
      });
    }
  });
});
