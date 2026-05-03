/**
 * Main Entry Point
 */

async function init() {
  // Generate initial invoice metadata if needed
  if (!state.invoiceRef) state.invoiceRef = generateRef();
  if (!state.invoiceDate) state.invoiceDate = formatDate(new Date());

  // Load settings (now async via IndexedDB)
  await loadSettingsFromStorage();
  
  applyLoadedSettingsToUI();
  applyPricingMatrixToUI();

  // Render loaded items
  if (state.fileItems.length > 0) {
    el("file-table-container").style.display = "block";
    showCompactDropZone();
    for (const item of state.fileItems) {
      renderFileTableRow(item);
    }
  }

  // Render discount tiers
  renderDiscountTiers();

  // Set invoice date
  el("inv-date").textContent = `DATE: ${state.invoiceDate}`;

  // Start real-time clock
  updateClock();
  setInterval(updateClock, 1000);

  // Initial preview render
  updateTotals();
  updateInvoicePreview();

  // Bind all events
  bindAllEvents();

  setStatus("Ready");
}

document.addEventListener("DOMContentLoaded", () => {
  init().catch(err => console.error("Initialization failed:", err));
});
