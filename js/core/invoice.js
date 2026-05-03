/**
 * Invoice Rendering & Exports
 */

function updateInvoicePreview() {
  updateInvoiceHeader();
  updateInvoiceLineItems();
  updateInvoiceTotals();
  updateInvoiceRemarks();

  // Set QR Code
  const qrImg = el("inv-qr-image");
  if (qrImg) {
    qrImg.src = GCASH_QR_B64;
    qrImg.style.width = `${INVOICE_QR_SIZE_PX}px`;
    qrImg.style.height = `${INVOICE_QR_SIZE_PX}px`;
  }

  // ─── Dynamic Portrait Adjustment ───
  const preview = el("invoice-preview");
  const width = preview.offsetWidth || INVOICE_EXPORT_WIDTH_PX;
  const itemCount = state.fileItems.length;

  const minPortraitHeight = width * 1.35;
  const itemHeightBuffer =
    itemCount > 0 ? 400 + itemCount * 40 : minPortraitHeight;

  preview.style.minHeight = `${Math.max(minPortraitHeight, itemHeightBuffer)}px`;

  persistSettingsToStorage();
}

function updateInvoiceHeader() {
  el("inv-ref").textContent = `REF# ${state.invoiceRef}`;
  el("inv-date").textContent = `DATE: ${state.invoiceDate}`;
}

function updateInvoiceLineItems() {
  const tbody = el("inv-items-body");

  if (state.fileItems.length === 0) {
    tbody.innerHTML =
      '<tr><td colspan="7" style="text-align:center;padding:48px;color:#a09a94;font-size:12px">Upload files to see line items</td></tr>';
    return;
  }

  tbody.innerHTML = "";

  for (const item of state.fileItems) {
    const total = computeItemTotal(item);
    const tr = document.createElement("tr");

    const sizeLabel =
      { long: "Long", short: "Short", a4: "A4" }[item.paperSize] || "Short";
    const modeLabel = item.colorMode === "color" ? "Color" : "B&W";

    tr.innerHTML = `
      <td class="inv-item-name">${truncateText(item.fileName, 32)}${item.isManual ? ' <span style="font-size:9px;color:#a09a94">[manual]</span>' : ""}</td>
      <td class="inv-size">${sizeLabel}</td>
      <td class="inv-mode">${modeLabel}</td>
      <td class="inv-num">${item.pages}</td>
      <td class="inv-num">${item.copies}</td>
      <td class="inv-price">${formatPeso(item.unitPrice)}</td>
      <td class="inv-total">${formatPeso(total)}</td>
    `;
    tbody.appendChild(tr);
  }
}

function updateInvoiceTotals() {
  const totals = computeGrandTotal();

  el("inv-subtotal").textContent = formatPeso(totals.subtotal);

  const grandEl = el("inv-grand-total");
  const prevText = grandEl.textContent;
  grandEl.textContent = formatPeso(totals.grandTotal);

  if (prevText !== grandEl.textContent) {
    grandEl.style.transition = "color 0.3s";
    grandEl.style.color = "var(--green)";
    setTimeout(() => {
      grandEl.style.color = "";
    }, 400);
  }

  const discountRow = el("inv-discount-row");
  const discountedRow = el("inv-discounted-row");
  const taxRow = el("inv-tax-row");

  if (totals.activeTier) {
    discountRow.style.display = "flex";
    discountedRow.style.display = "flex";
    el("inv-discount-label").textContent =
      `Discount (${totals.activeTier.discountPct}%)`;
    el("inv-discount-val").textContent = `−${formatPeso(totals.discountAmt)}`;
    el("inv-discounted-val").textContent = formatPeso(totals.discountedPrice);
  } else {
    discountRow.style.display = "none";
    discountedRow.style.display = "none";
  }

  if (state.settings.isTaxEnabled && state.settings.isVatVisibleOnInvoice) {
    taxRow.style.display = "flex";
    el("inv-tax-label").textContent = `Tax / VAT (${state.settings.taxRate}%)`;
    el("inv-tax-val").textContent = formatPeso(totals.taxAmt);
  } else {
    taxRow.style.display = "none";
  }
}

function updateInvoiceRemarks() {
  const text = el("remarks").value.trim();
  const block = el("inv-remarks-block");
  const textEl = el("inv-remarks-text");
  block.style.display = text ? "block" : "none";
  textEl.textContent = text;
}

async function captureInvoiceCanvas() {
  const previewEl = el("invoice-preview");
  const clone = previewEl.cloneNode(true);

  clone.style.boxShadow = "none";
  clone.style.borderRadius = "0";
  clone.style.margin = "0";
  clone.style.width = `${INVOICE_EXPORT_WIDTH_PX}px`;
  clone.style.height = "auto";
  clone.style.minHeight = "auto";

  const container = document.createElement("div");
  container.setAttribute("data-theme", "light");
  container.style.cssText = [
    "position:fixed",
    "top:-99999px",
    "left:-99999px",
    `width:${INVOICE_EXPORT_WIDTH_PX}px`,
    "height:auto",
    "overflow:visible",
    "z-index:-1",
    "background:#ffffff",
    "padding:0",
    "margin:0",
  ].join(";");

  container.appendChild(clone);
  document.body.appendChild(container);

  try {
    const images = clone.getElementsByTagName("img");
    await Promise.all(
      Array.from(images).map((img) => {
        if (img.complete) return Promise.resolve();
        return new Promise((resolve) => {
          img.onload = resolve;
          img.onerror = resolve;
        });
      }),
    );

    const canvas = await html2canvas(container, {
      scale: COPY_IMAGE_SCALE,
      useCORS: true,
      backgroundColor: "#ffffff",
      logging: false,
      width: INVOICE_EXPORT_WIDTH_PX,
    });
    return canvas;
  } finally {
    document.body.removeChild(container);
  }
}

async function copyInvoiceAsImageAsync() {
  try {
    setStatus("Capturing…", "analyzing");
    const canvas = await captureInvoiceCanvas();
    await attemptCopyCanvasToClipboard(canvas);
    setStatus("Copied!", "copied");
    setTimeout(() => setStatus("Ready"), 2000);
  } catch {
    setStatus("Ready");
    showToast("Failed to capture invoice", "error");
  }
}

async function attemptCopyCanvasToClipboard(canvas) {
  const blob = await new Promise((resolve) =>
    canvas.toBlob(resolve, "image/png"),
  );

  if (navigator.clipboard && window.ClipboardItem) {
    try {
      await navigator.clipboard.write([
        new ClipboardItem({ "image/png": blob }),
      ]);
      showToast("✓ Copied to clipboard!", "success");
      return;
    } catch {
      // Fall through
    }
  }

  triggerPngDownload(canvas);
  showToast("📥 Saved as PNG (clipboard unavailable)", "info");
}

function triggerPngDownload(canvas) {
  const link = document.createElement("a");
  const dateStr = new Date().toISOString().slice(0, 10);
  link.download = `invoice-${state.invoiceRef}-${dateStr}.png`;
  link.href = canvas.toDataURL("image/png");
  link.click();
}

async function saveAsPngAsync() {
  try {
    const canvas = await captureInvoiceCanvas();
    triggerPngDownload(canvas);
    showToast("📥 Invoice saved as PNG", "info");
  } catch {
    showToast("Failed to save PNG", "error");
  }
}

function printInvoice() {
  window.print();
}

function startNewInvoice() {
  clearAllInvoiceData();
  state.invoiceRef = generateRef();
  state.invoiceDate = formatDate(new Date());
  updateInvoicePreview();
  showToast("New invoice started", "info");
}

function clearAllInvoiceData() {
  state.fileItems = [];
  state.nextItemId = 1;
  el("file-table-body").innerHTML = "";
  el("file-table-container").style.display = "none";
  showFullDropZone();
  el("remarks").value = "";
  updateTotals();
  updateInvoicePreview();
}

function placeOrder() {
  if (state.fileItems.length === 0) {
    showToast("Please upload at least one file before placing an order.", "error");
    el("drop-zone").scrollIntoView({ behavior: "smooth", block: "center" });
    return;
  }

  const hasUnfilledPages = state.fileItems.some((i) => i.needsPageEntry || i.pages < 1);
  if (hasUnfilledPages) {
    showToast("Please enter page counts for all items before placing an order.", "error");
    return;
  }

  const totals = computeGrandTotal();
  const collectMsg = `Total to collect: ${formatPeso(totals.grandTotal)}\nItems: ${state.fileItems.length}\nPages: ${computeTotalPrintedPages()}`;
  
  showModal({
    title: "Confirm Order",
    body: collectMsg,
    type: "confirm",
    confirmText: "Place Order",
    onConfirm: async () => {
      // Update Cumulative Stats
      for (const item of state.fileItems) {
        const totalPages = item.pages * item.copies;
        if (item.paperSize === "long") state.cumulativeStats.pagesLong += totalPages;
        else if (item.paperSize === "a4") state.cumulativeStats.pagesA4 += totalPages;
        else state.cumulativeStats.pagesShort += totalPages;
      }
      state.cumulativeStats.totalRevenue += totals.grandTotal;
      state.cumulativeStats.totalOrders += 1;
      
      await writeDb(STORAGE_KEYS.cumulativeStats, state.cumulativeStats);

      saveInvoiceToRecentHistory();

      showProcessing("Listing items...");
      
      setTimeout(() => {
        updateProcessingMessage("Generating Invoice...");
        
        copyInvoiceAsImageAsync().then(() => {
          updateProcessingMessage("Order Placed!", true);
          showToast(`✓ Order placed! Collect ${formatPeso(totals.grandTotal)}`, "success");
          setStatus("Order Placed", "copied");

          setTimeout(() => {
            hideProcessing();
            clearAllInvoiceData();
            state.invoiceRef = generateRef();
            state.invoiceDate = formatDate(new Date());
            updateInvoicePreview();
            setStatus("Ready");
          }, 1500);
        });
      }, 800);
    }
  });
}
