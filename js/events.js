/**
 * Event Bindings
 */

function bindDropZoneEvents() {
  const zone = el("drop-zone");
  const compact = el("drop-zone-compact");
  const input = el("file-input");
  const overlay = el("file-drop-overlay");

  if (!zone || !input || !overlay) return;

  const openFilePicker = () => input.click();

  zone.addEventListener("click", openFilePicker);
  compact.addEventListener("click", openFilePicker);
  
  zone.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      openFilePicker();
    }
  });
  
  compact.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      openFilePicker();
    }
  });

  let dragCounter = 0;
  window.addEventListener("dragenter", (e) => {
    e.preventDefault();
    if (e.dataTransfer.types.includes("Files")) {
      dragCounter++;
      overlay.classList.add("active");
    }
  });

  window.addEventListener("dragover", (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  });

  window.addEventListener("dragleave", (e) => {
    e.preventDefault();
    dragCounter--;
    if (dragCounter <= 0) {
      overlay.classList.remove("active");
      dragCounter = 0;
    }
  });

  window.addEventListener("drop", (e) => {
    e.preventDefault();
    dragCounter = 0;
    overlay.classList.remove("active");
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(Array.from(e.dataTransfer.files));
    }
  });

  input.addEventListener("change", () => {
    if (input.files && input.files.length > 0) {
      handleFiles(Array.from(input.files));
    }
    input.value = "";
  });
}

async function handleFiles(files) {
  const supported = files.filter((f) => /\.(pdf|docx|doc)$/i.test(f.name));
  if (supported.length === 0) {
    showToast("Only PDF and DOCX files are supported", "error");
    return;
  }
  
  setStatus(`Processing ${supported.length} file(s)...`, "analyzing");
  for (const file of supported) {
    try {
      await processUploadedFileAsync(file);
    } catch (err) {
      console.error("Failed to process file:", file.name, err);
      showToast(`Error processing ${file.name}`, "error");
    }
  }
  setStatus("Ready");
}

function bindFileTableEvents() {
  const body = el("file-table-body");
  if (!body) return;

  body.addEventListener("change", (e) => {
    const input = e.target;
    const id = parseInt(input.dataset.id);
    const field = input.dataset.field;
    if (!id || !field) return;

    const item = findItemById(id);
    if (!item) return;

    if (field === "pages") {
      item.pages = parseInt(input.value) || 0;
      item.isPageExact = true;
      item.needsPageEntry = item.pages < 1;
      input.className = item.needsPageEntry ? "num-input warn" : "num-input";
    } else if (field === "fileName") {
      item.fileName = input.value || "Custom Item";
    } else if (field === "copies") {
      item.copies = parseInt(input.value) || 1;
    } else if (field === "paperSize") {
      item.paperSize = input.value;
      item.unitPrice = getPriceForItem(item.colorMode, item.paperSize);
    } else if (field === "colorMode") {
      item.colorMode = input.value;
      item.unitPrice = getPriceForItem(item.colorMode, item.paperSize);
    }

    refreshTotalCell(id);
    updateTotals();
    refreshAllRows();
    updateInvoicePreview();
  });

  body.addEventListener("click", (e) => {
    const btn = e.target.closest(".remove-btn");
    if (!btn) return;
    const id = parseInt(btn.dataset.id);
    if (id) removeItemFromState(id);
  });
}

function bindPricingMatrixEvents() {
  const table = el("pricing-matrix-table");
  if (!table) return;

  table.addEventListener("input", () => {
    syncPricingMatrixToState();
    for (const item of state.fileItems) {
      item.unitPrice = getPriceForItem(item.colorMode, item.paperSize);
    }
    refreshAllRows();
    updateTotals();
    updateInvoicePreview();
  });
}

function bindPricingEvents() {
  el("tax-rate")?.addEventListener("input", (e) => {
    state.settings.taxRate = parseFloat(e.target.value) || 0;
    const sub = el("tax-rate-sub");
    if (sub) sub.textContent = `${state.settings.taxRate}%`;
    updateTotals();
    updateInvoicePreview();
  });

  el("tax-enabled")?.addEventListener("change", (e) => {
    state.settings.isTaxEnabled = e.target.checked;
    const row = el("tax-rate-row");
    const vatRow = el("vat-show-row");
    if (row) row.style.display = state.settings.isTaxEnabled ? "flex" : "none";
    if (vatRow) vatRow.style.display = state.settings.isTaxEnabled ? "flex" : "none";
    updateTotals();
    updateInvoicePreview();
  });

  el("vat-show-invoice")?.addEventListener("change", (e) => {
    state.settings.isVatVisibleOnInvoice = e.target.checked;
    updateInvoicePreview();
  });

  el("round-up")?.addEventListener("change", (e) => {
    state.settings.shouldRoundUp = e.target.checked;
    updateTotals();
    updateInvoicePreview();
  });
}

function bindDiscountTierEvents() {
  const container = el("discount-tiers");
  if (!container) return;

  container.addEventListener("change", (e) => {
    const input = e.target;
    const tierIdx = parseInt(input.dataset.tier);
    const field = input.dataset.field;
    if (isNaN(tierIdx) || !field) return;

    state.discountTiers[tierIdx][field] = parseFloat(input.value) || 0;
    updateTotals();
    renderDiscountTiers(); // Re-render to highlight active
  });

  container.addEventListener("click", (e) => {
    const btn = e.target.closest(".tier-remove-btn");
    if (!btn) return;
    const idx = parseInt(btn.dataset.tier);
    if (!isNaN(idx)) removeDiscountTier(idx);
  });

  el("btn-add-tier")?.addEventListener("click", addDiscountTier);
}

function bindExportEvents() {
  el("btn-place-order")?.addEventListener("click", placeOrder);
  el("btn-copy-image")?.addEventListener("click", copyInvoiceAsImageAsync);
  el("btn-print")?.addEventListener("click", () => printInvoice());
  el("btn-save-png")?.addEventListener("click", saveAsPngAsync);
  
  el("btn-new-invoice")?.addEventListener("click", () => {
    showModal({
      title: "New Invoice",
      body: "Start a new invoice? Current data will be cleared.",
      type: "confirm",
      confirmText: "Start New",
      onConfirm: () => startNewInvoice()
    });
  });

  el("btn-add-item")?.addEventListener("click", addManualItem);
  
  el("btn-reset-copies")?.addEventListener("click", () => {
    for (const item of state.fileItems) item.copies = 1;
    refreshAllRows();
    updateTotals();
    updateInvoicePreview();
    showToast("All copies reset to 1", "info");
  });
  
  el("btn-clear-table")?.addEventListener("click", () => {
    if (state.fileItems.length === 0) return;
    showModal({
      title: "Clear Invoice",
      body: "Are you sure you want to clear all items from this invoice?",
      type: "danger",
      confirmText: "Clear All",
      onConfirm: () => clearAllInvoiceData()
    });
  });

  el("remarks")?.addEventListener("input", updateInvoiceRemarks);

  document.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toUpperCase() === "C") {
      e.preventDefault();
      copyInvoiceAsImageAsync();
    }
  });
}

function bindSettingsEvents() {
  el("btn-settings-toggle")?.addEventListener("click", () => openDrawer("settings"));
  el("drawer-close")?.addEventListener("click", closeDrawer);
  el("drawer-overlay")?.addEventListener("click", closeDrawer);
  el("btn-drawer-cancel")?.addEventListener("click", closeDrawer);
  el("btn-save-settings")?.addEventListener("click", saveSettingsFromDrawer);
  
  el("btn-clear-all")?.addEventListener("click", () => {
    if (state.fileItems.length === 0) return;
    showModal({
      title: "Clear Invoice",
      body: "Are you sure you want to clear the current invoice data?",
      type: "danger",
      confirmText: "Clear",
      onConfirm: () => clearAllInvoiceData()
    });
  });
  
  el("btn-reset-settings")?.addEventListener("click", resetSettingsToDefaults);

  el("tab-history")?.addEventListener("click", () => switchDrawerView("history"));
  el("tab-settings")?.addEventListener("click", () => switchDrawerView("settings"));
}

function bindNumericInputEvents() {
  document.addEventListener("keydown", (e) => {
    if (e.target.tagName === "INPUT" && e.target.type === "number") {
      const allowedKeys = ["0","1","2","3","4","5","6","7","8","9",".","Backspace","Delete","ArrowLeft","ArrowRight","Tab","Home","End","Enter"];
      if (e.ctrlKey || e.metaKey) return;
      if (!allowedKeys.includes(e.key)) e.preventDefault();
    }
  });
  document.addEventListener("paste", (e) => {
    if (e.target.tagName === "INPUT" && e.target.type === "number") {
      const data = e.clipboardData.getData("text");
      if (!/^\d+\.?\d*$/.test(data)) e.preventDefault();
    }
  });
}

function bindHeaderEvents() {
  el("btn-theme")?.addEventListener("click", toggleTheme);
  
  const kmodeToggle = el("header-kmode-toggle");
  if (kmodeToggle) {
    kmodeToggle.addEventListener("change", (e) => {
      toggleKMode(e.target.checked);
    });
  }
  
  el("btn-recent")?.addEventListener("click", () => openDrawer("history"));
  el("btn-revenue-dashboard")?.addEventListener("click", () => showRevenueDashboard());
  el("btn-clear-recent-history")?.addEventListener("click", () => clearAllHistory());
}

function bindMobilePreviewEvents() {
  const fab = el("preview-fab");
  if (fab) {
    fab.addEventListener("click", () => {
      const modal = el("preview-modal");
      if (modal) {
        modal.classList.add("open");
        const preview = el("invoice-preview");
        if (preview) {
           const clone = preview.cloneNode(true);
           clone.id = "invoice-preview-clone";
           const content = el("preview-modal-content");
           if (content) {
             content.innerHTML = "";
             content.appendChild(clone);
           }
        }
      }
    });
  }
  
  el("preview-modal-close")?.addEventListener("click", () => el("preview-modal").classList.remove("open"));
  el("preview-modal")?.addEventListener("click", (e) => {
    if (e.target === el("preview-modal")) el("preview-modal").classList.remove("open");
  });
}

function bindAllEvents() {
  bindDropZoneEvents();
  bindFileTableEvents();
  bindPricingMatrixEvents();
  bindPricingEvents();
  bindDiscountTierEvents();
  bindExportEvents();
  bindSettingsEvents();
  bindNumericInputEvents();
  bindHeaderEvents();
  bindMobilePreviewEvents();
  bindModalEvents();
}
