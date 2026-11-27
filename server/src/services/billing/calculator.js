/**
 * Pure calculation engine for billing and quotes.
 * Zero database calls, integer arithmetic, single source of truth for GST & discounts.
 */

/**
 * Calculates line items and grand totals for a cart.
 *
 * @param {Object} params
 * @param {Array<Object>} params.items - Cart lines: { variantId, qty, unitPricePaise, mrpPaise, gstRate, lineDiscount, costPaise }
 * @param {Object} [params.billDiscount] - { type: 'pct' | 'amount', value: number }
 * @param {boolean} [params.isInterState=false] - True if B2B inter-state (IGST), false if intra-state (CGST + SGST)
 * @returns {Object} Calculated quote with line items, tax breakdown, and grand totals
 */
export function calculateQuote({ items, billDiscount = null, isInterState = false }) {
  if (!Array.isArray(items) || items.length === 0) {
    return {
      lines: [],
      taxBreakdown: [],
      subtotalPaise: 0,
      lineDiscountTotalPaise: 0,
      billDiscountPaise: 0,
      totalDiscountPaise: 0,
      taxablePaise: 0,
      cgstPaise: 0,
      sgstPaise: 0,
      igstPaise: 0,
      totalGstPaise: 0,
      rawGrandTotalPaise: 0,
      roundOffPaise: 0,
      grandTotalPaise: 0,
      savingsPaise: 0,
      profitPaise: 0,
    };
  }

  // 1. Gross and Line Discounts
  const lines = items.map((item, index) => {
    const qty = Math.max(1, Math.round(Number(item.qty) || 1));
    const unitPricePaise = Math.max(0, Math.round(Number(item.unitPricePaise) || 0));
    const mrpPaise = Math.max(0, Math.round(Number(item.mrpPaise) || unitPricePaise));
    const costPaise = Math.max(0, Math.round(Number(item.costPaise) || 0));
    const gstRate = Math.max(0, Number(item.gstRate) || 0);

    const grossPaise = qty * unitPricePaise;

    let lineDiscountPaise = 0;
    if (item.lineDiscount) {
      if (item.lineDiscount.type === 'pct') {
        const pct = Math.max(0, Math.min(100, Number(item.lineDiscount.value) || 0));
        lineDiscountPaise = Math.round((grossPaise * pct) / 100);
      } else if (item.lineDiscount.type === 'amount') {
        lineDiscountPaise = Math.max(0, Math.round(Number(item.lineDiscount.value) || 0));
      }
    }
    lineDiscountPaise = Math.min(lineDiscountPaise, grossPaise);
    const postLineDiscountPaise = grossPaise - lineDiscountPaise;

    return {
      ...item,
      lineIndex: index,
      qty,
      unitPricePaise,
      mrpPaise,
      costPaise,
      gstRate,
      grossPaise,
      lineDiscountPaise,
      postLineDiscountPaise,
      billDiscountSharePaise: 0,
    };
  });

  const sumPostLineDiscount = lines.reduce((acc, l) => acc + l.postLineDiscountPaise, 0);

  // 2. Bill Discount (Hamilton-Hare / Largest-Remainder Method)
  let billDiscountPaise = 0;
  if (billDiscount && sumPostLineDiscount > 0) {
    if (billDiscount.type === 'pct') {
      const pct = Math.max(0, Math.min(100, Number(billDiscount.value) || 0));
      billDiscountPaise = Math.round((sumPostLineDiscount * pct) / 100);
    } else if (billDiscount.type === 'amount') {
      billDiscountPaise = Math.max(0, Math.round(Number(billDiscount.value) || 0));
    }
    billDiscountPaise = Math.min(billDiscountPaise, sumPostLineDiscount);

    // Distribute proportionally
    const sharesWithRemainder = lines.map((l) => {
      const exactShare = (l.postLineDiscountPaise * billDiscountPaise) / sumPostLineDiscount;
      const integerShare = Math.floor(exactShare);
      const remainder = exactShare - integerShare;
      return { line: l, integerShare, remainder };
    });

    const allocatedIntegerSum = sharesWithRemainder.reduce((sum, s) => sum + s.integerShare, 0);
    let remainingPaiseToDistribute = billDiscountPaise - allocatedIntegerSum;

    // Sort descending by remainder
    sharesWithRemainder.sort((a, b) => b.remainder - a.remainder);
    for (const item of sharesWithRemainder) {
      if (remainingPaiseToDistribute > 0) {
        item.line.billDiscountSharePaise = item.integerShare + 1;
        remainingPaiseToDistribute--;
      } else {
        item.line.billDiscountSharePaise = item.integerShare;
      }
    }
  }

  // 3. Line Net, Taxable & GST
  for (const line of lines) {
    const netPaise = line.postLineDiscountPaise - line.billDiscountSharePaise;
    const taxablePaise = Math.round((netPaise * 100) / (100 + line.gstRate));
    const gstPaise = netPaise - taxablePaise;

    let cgstPaise = 0;
    let sgstPaise = 0;
    let igstPaise = 0;

    if (isInterState) {
      igstPaise = gstPaise;
    } else {
      cgstPaise = Math.floor(gstPaise / 2);
      sgstPaise = gstPaise - cgstPaise;
    }

    line.netPaise = netPaise;
    line.taxablePaise = taxablePaise;
    line.gstPaise = gstPaise;
    line.cgstPaise = cgstPaise;
    line.sgstPaise = sgstPaise;
    line.igstPaise = igstPaise;
  }

  // 4. Totals Aggregation
  const subtotalPaise = lines.reduce((acc, l) => acc + l.grossPaise, 0);
  const lineDiscountTotalPaise = lines.reduce((acc, l) => acc + l.lineDiscountPaise, 0);
  const totalDiscountPaise = lineDiscountTotalPaise + billDiscountPaise;
  const taxablePaise = lines.reduce((acc, l) => acc + l.taxablePaise, 0);
  const cgstPaise = lines.reduce((acc, l) => acc + l.cgstPaise, 0);
  const sgstPaise = lines.reduce((acc, l) => acc + l.sgstPaise, 0);
  const igstPaise = lines.reduce((acc, l) => acc + l.igstPaise, 0);
  const totalGstPaise = cgstPaise + sgstPaise + igstPaise;

  const rawGrandTotalPaise = lines.reduce((acc, l) => acc + l.netPaise, 0);
  const rounded = Math.round(rawGrandTotalPaise / 100) * 100;
  const roundOffPaise = rounded - rawGrandTotalPaise;
  const grandTotalPaise = rounded;

  const totalMrpPaise = lines.reduce((acc, l) => acc + l.qty * l.mrpPaise, 0);
  const savingsPaise = Math.max(0, totalMrpPaise - rawGrandTotalPaise);

  const totalCostPaise = lines.reduce((acc, l) => acc + l.costPaise * l.qty, 0);
  const profitPaise = taxablePaise - totalCostPaise;

  // 5. Tax Breakdown per GST Rate
  const rateMap = {};
  for (const l of lines) {
    const rate = l.gstRate;
    if (!rateMap[rate]) {
      rateMap[rate] = { gstRate: rate, taxablePaise: 0, cgstPaise: 0, sgstPaise: 0, igstPaise: 0, totalGstPaise: 0 };
    }
    rateMap[rate].taxablePaise += l.taxablePaise;
    rateMap[rate].cgstPaise += l.cgstPaise;
    rateMap[rate].sgstPaise += l.sgstPaise;
    rateMap[rate].igstPaise += l.igstPaise;
    rateMap[rate].totalGstPaise += l.gstPaise;
  }
  const taxBreakdown = Object.values(rateMap).sort((a, b) => a.gstRate - b.gstRate);

  return {
    lines,
    taxBreakdown,
    subtotalPaise,
    lineDiscountTotalPaise,
    billDiscountPaise,
    totalDiscountPaise,
    taxablePaise,
    cgstPaise,
    sgstPaise,
    igstPaise,
    totalGstPaise,
    rawGrandTotalPaise,
    roundOffPaise,
    grandTotalPaise,
    savingsPaise,
    profitPaise,
  };
}
