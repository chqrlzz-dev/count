/**
 * Pricing Helpers
 */
function getPriceForItem(colorMode, paperSize) {
  const mode = (colorMode || "bw").toLowerCase();
  const size = (paperSize || "short").toLowerCase();
  return (state.pricing[mode] && state.pricing[mode][size]) || 3.0;
}

function getPricingMatrixValues() {
  return {
    bw: {
      long: parseFloat(el("price-bw-long").value) || 3.5,
      short: parseFloat(el("price-bw-short").value) || 2.5,
      a4: parseFloat(el("price-bw-a4").value) || 2.75,
    },
    color: {
      long: parseFloat(el("price-color-long").value) || 4.75,
      short: parseFloat(el("price-color-short").value) || 2.5,
      a4: parseFloat(el("price-color-a4").value) || 3.75,
    },
  };
}

/**
 * Billing Calculations
 */
function computeItemTotal(item) {
  return item.pages * item.copies * item.unitPrice;
}

function computeTotalPrintedPages() {
  return state.fileItems.reduce((sum, i) => sum + i.pages * i.copies, 0);
}

function computeSubtotal() {
  return state.fileItems.reduce((sum, i) => sum + computeItemTotal(i), 0);
}

function resolveActiveTier(totalPages) {
  const sorted = [...state.discountTiers].sort(
    (a, b) => b.minPages - a.minPages,
  );
  return sorted.find((t) => totalPages >= t.minPages) || null;
}

function computeGrandTotal() {
  const subtotal = computeSubtotal();
  const totalPages = computeTotalPrintedPages();
  const activeTier = resolveActiveTier(totalPages);

  const discountAmt = activeTier
    ? subtotal * (activeTier.discountPct / 100)
    : 0;
  const discountedPrice = subtotal - discountAmt;
  const taxAmt = state.settings.isTaxEnabled
    ? discountedPrice * (state.settings.taxRate / 100)
    : 0;
  let grandTotal = discountedPrice + taxAmt;

  if (state.settings.shouldRoundUp && grandTotal % 1 >= 0.25) {
    grandTotal = Math.ceil(grandTotal);
  }

  return {
    subtotal,
    discountAmt,
    discountedPrice,
    taxAmt,
    grandTotal,
    activeTier,
  };
}

function updateTotals() {
  const totals = computeGrandTotal();
  const totalPages = computeTotalPrintedPages();

  const totalPagesEl = el("tfoot-total-pages");
  const subtotalEl = el("tfoot-subtotal");
  const collectEl = el("btn-collect-amount");

  if (totalPagesEl) totalPagesEl.textContent = totalPages;
  if (subtotalEl) subtotalEl.textContent = formatPeso(totals.subtotal);
  if (collectEl) collectEl.textContent = formatPeso(totals.grandTotal);

  renderDiscountTiers();
  updateInvoicePreview();
}
