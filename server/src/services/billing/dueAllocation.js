/**
 * Pure customer due payment allocation engine.
 * Allocates payment amounts across opening due and outstanding bills in strict FIFO order.
 */

/**
 * Allocates a due payment amount.
 *
 * @param {Object} params
 * @param {number} params.openingDueRemainingPaise - Remaining opening balance
 * @param {Array<Object>} params.billsWithDues - Bills with duePaise > 0 sorted by createdAt ASC
 * @param {number} params.paymentAmountPaise - Payment amount in paise
 * @returns {Object} Allocations and remaining due
 */
export function allocateDuePayment({ openingDueRemainingPaise = 0, billsWithDues = [], paymentAmountPaise = 0 }) {
  const paymentPaise = Math.max(0, Math.round(Number(paymentAmountPaise) || 0));
  let unallocated = paymentPaise;
  const allocations = [];

  // 1. Allocate against opening due first
  let openingAllocated = 0;
  if (openingDueRemainingPaise > 0 && unallocated > 0) {
    openingAllocated = Math.min(openingDueRemainingPaise, unallocated);
    allocations.push({
      target: 'opening',
      amountPaise: openingAllocated,
    });
    unallocated -= openingAllocated;
  }

  // 2. Allocate against bills FIFO
  for (const bill of billsWithDues) {
    if (unallocated <= 0) break;
    const dueOnBill = bill.duePaise || 0;
    if (dueOnBill <= 0) continue;

    const allocatedToBill = Math.min(dueOnBill, unallocated);
    allocations.push({
      target: bill._id?.toString() || bill.id,
      billNo: bill.billNo,
      amountPaise: allocatedToBill,
      priorDuePaise: dueOnBill,
      newDuePaise: dueOnBill - allocatedToBill,
    });
    unallocated -= allocatedToBill;
  }

  // Calculate remaining due across all targets
  const newOpeningDueRemaining = openingDueRemainingPaise - openingAllocated;
  const totalBillsDueRemaining = billsWithDues.reduce((sum, b) => {
    const alloc = allocations.find((a) => a.target === (b._id?.toString() || b.id));
    const paid = alloc ? alloc.amountPaise : 0;
    return sum + (b.duePaise - paid);
  }, 0);

  const remainingDuePaise = newOpeningDueRemaining + totalBillsDueRemaining;

  return {
    allocations,
    allocatedTotalPaise: paymentPaise - unallocated,
    unallocatedPaise: unallocated,
    remainingDuePaise,
  };
}
