/**
 * Pure return calculation engine.
 * Computes partial and full returns using cumulative proportional rounding.
 */

/**
 * Calculates refund lines and credit note totals.
 *
 * @param {Object} params
 * @param {Object} params.bill - Original bill document
 * @param {Array<{ lineId: string, qty: number, isDamaged?: boolean, unitCostPaise?: number }>} params.returnLines
 * @returns {Object} Credit note calculation
 */
export function calculateReturn({ bill, returnLines }) {
  if (!bill || !Array.isArray(returnLines) || returnLines.length === 0) {
    throw new Error('Valid bill and return lines required.');
  }

  const lines = [];
  let totalNetReturned = 0;
  let totalTaxableReturned = 0;
  let totalCgstReturned = 0;
  let totalSgstReturned = 0;
  let totalIgstReturned = 0;
  let totalCostAdjustment = 0;

  for (const ret of returnLines) {
    const originalLine = bill.items.find((i) => i.lineId === ret.lineId || i._id?.toString() === ret.lineId);
    if (!originalLine) {
      throw new Error(`Line ${ret.lineId} not found in bill.`);
    }

    const prevReturned = originalLine.returnedQty || 0;
    const qtyToReturn = Math.max(1, Math.round(Number(ret.qty) || 1));
    if (prevReturned + qtyToReturn > originalLine.qty) {
      throw new Error(`Cannot return ${qtyToReturn} units. Maximum returnable: ${originalLine.qty - prevReturned}.`);
    }

    // Cumulative proportional rounding:
    // refund(c) = Math.round(originalLine.netPaise * c / originalLine.qty)
    const refundAtC = (c) => Math.round((originalLine.netPaise * c) / originalLine.qty);
    const taxableAtC = (c) => Math.round((originalLine.taxablePaise * c) / originalLine.qty);
    const cgstAtC = (c) => Math.round(((originalLine.cgstPaise || 0) * c) / originalLine.qty);
    const sgstAtC = (c) => Math.round(((originalLine.sgstPaise || 0) * c) / originalLine.qty);
    const igstAtC = (c) => Math.round(((originalLine.igstPaise || 0) * c) / originalLine.qty);

    const thisNet = refundAtC(prevReturned + qtyToReturn) - refundAtC(prevReturned);
    const thisTaxable = taxableAtC(prevReturned + qtyToReturn) - taxableAtC(prevReturned);
    const thisCgst = cgstAtC(prevReturned + qtyToReturn) - cgstAtC(prevReturned);
    const thisSgst = sgstAtC(prevReturned + qtyToReturn) - sgstAtC(prevReturned);
    const thisIgst = igstAtC(prevReturned + qtyToReturn) - igstAtC(prevReturned);
    const thisGst = thisCgst + thisSgst + thisIgst;

    const unitCostPaise = ret.unitCostPaise || originalLine.unitCostPaise || 0;
    // Damaged units do not restore inventory, so their cost remains a loss
    const isDamaged = Boolean(ret.isDamaged);
    const costRestored = isDamaged ? 0 : unitCostPaise * qtyToReturn;

    lines.push({
      lineId: ret.lineId,
      nameSnapshot: originalLine.nameSnapshot || originalLine.name,
      qty: qtyToReturn,
      isDamaged,
      netPaise: thisNet,
      taxablePaise: thisTaxable,
      cgstPaise: thisCgst,
      sgstPaise: thisSgst,
      igstPaise: thisIgst,
      gstPaise: thisGst,
      costRestoredPaise: costRestored,
    });

    totalNetReturned += thisNet;
    totalTaxableReturned += thisTaxable;
    totalCgstReturned += thisCgst;
    totalSgstReturned += thisSgst;
    totalIgstReturned += thisIgst;
    totalCostAdjustment += costRestored;
  }

  // Check if this return fully completes the entire bill return
  const isFullBillReturn = bill.items.every((item) => {
    const matchingReturn = lines.find((l) => l.lineId === item.lineId || l.lineId === item._id?.toString());
    const returnedNow = matchingReturn ? matchingReturn.qty : 0;
    return (item.returnedQty || 0) + returnedNow >= item.qty;
  });

  const rawGrandTotalPaise = totalNetReturned;
  let rounded = Math.round(rawGrandTotalPaise / 100) * 100;
  let roundOffPaise = rounded - rawGrandTotalPaise;
  let grandTotalPaise = rounded;

  // Absorb rounding discrepancy if fully returned
  if (isFullBillReturn) {
    const priorReturnsTotalPaise = bill.returnsTotalPaise || 0;
    grandTotalPaise = Math.max(0, bill.grandTotalPaise - priorReturnsTotalPaise);
    roundOffPaise = grandTotalPaise - rawGrandTotalPaise;
  }

  // Profit adjustment: - (taxableReturned - costOfSealedReturned)
  const profitAdjustmentPaise = -(totalTaxableReturned - totalCostAdjustment);

  return {
    lines,
    taxablePaise: totalTaxableReturned,
    cgstPaise: totalCgstReturned,
    sgstPaise: totalSgstReturned,
    igstPaise: totalIgstReturned,
    totalGstPaise: totalCgstReturned + totalSgstReturned + totalIgstReturned,
    rawGrandTotalPaise,
    roundOffPaise,
    grandTotalPaise,
    profitAdjustmentPaise,
    isFullBillReturn,
  };
}
