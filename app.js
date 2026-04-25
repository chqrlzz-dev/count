// ─── Constants ───────────────────────────────────────────────────────────────

const TAX_RATE_DEFAULT = 12;
const DEFAULT_COPIES = 1;
const MAX_RECENT_INVOICES = 20;
const DOCX_BYTES_PER_PAGE = 2400;
const COPY_IMAGE_SCALE = 2;
const INVOICE_EXPORT_WIDTH_PX = 680;
const TOAST_DURATION_MS = 2500;
const DISCOUNT_TIERS_DEFAULT = [
  { minPages: 25, discountPct: 5 },
  { minPages: 50, discountPct: 10 },
  { minPages: 100, discountPct: 12 },
];

// ─── Centralized Pricing Config ───────────────────────────────────────────────
// PRICING[colorMode][paperSize] = price per page (₱)
const PRICING_DEFAULTS = {
  bw: { long: 3.5, short: 2.5, a4: 2.75 },
  color: { long: 4.75, short: 2.5, a4: 3.75 },
};

const KAKILALA_PRICING_DEFAULTS = {
  bw: { long: 2.25, short: 2.0, a4: 2.0 },
  color: { long: 4.25, short: 3.25, a4: 3.5 },
};

const STORAGE_KEYS = {
  shopInfo: "ig_shop_info",
  recentInvoices: "ig_recent_invoices",
  settings: "ig_settings",
  theme: "ig_theme",
  pricing: "ig_pricing",
  pricingStandard: "ig_pricing_standard",
  pricingKMode: "ig_pricing_kmode",
  fileItems: "ig_file_items",
};

// ─── State ───────────────────────────────────────────────────────────────────

const state = {
  fileItems: [],
  // Each item: { id, fileName, pages, copies, colorMode, paperSize, unitPrice, isPageExact, isManual, needsPageEntry }
  nextItemId: 1,
  discountTiers: structuredClone(DISCOUNT_TIERS_DEFAULT),
  pricing: structuredClone(PRICING_DEFAULTS),
  pricingStandard: structuredClone(PRICING_DEFAULTS),
  pricingKMode: structuredClone(KAKILALA_PRICING_DEFAULTS),
  settings: {
    taxRate: TAX_RATE_DEFAULT,
    isTaxEnabled: true,
    isVatVisibleOnInvoice: true,
    shouldRoundUp: false,
    defaultCopies: DEFAULT_COPIES,
    isKMode: false,
  },
  shopInfo: {
    name: "Syempre kay Charles",
    address: "",
    phone: "",
    email: "",
    paymentTerms: "Due on receipt",
  },
  invoiceRef: generateRef(),
  invoiceDate: formatDate(new Date()),
};

// ─── DOM Helpers ─────────────────────────────────────────────────────────────

function el(id) {
  return document.getElementById(id);
}

function buildElement(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, val] of Object.entries(attrs)) {
    if (key === "className") node.className = val;
    else if (key === "innerHTML") node.innerHTML = val;
    else if (key === "textContent") node.textContent = val;
    else node.setAttribute(key, val);
  }
  for (const child of children) {
    if (child)
      node.appendChild(
        typeof child === "string" ? document.createTextNode(child) : child,
      );
  }
  return node;
}

// ─── Utilities ───────────────────────────────────────────────────────────────

function generateRef() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const nums = "0123456789";
  const rand = (pool, n) =>
    Array.from(
      { length: n },
      () => pool[Math.floor(Math.random() * pool.length)],
    ).join("");
  return rand(chars, 4) + "-" + rand(nums, 4);
}

function formatDate(date) {
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatPeso(amount) {
  return "₱" + amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function stripExtension(filename) {
  return filename.replace(/\.[^/.]+$/, "");
}

function truncateText(text, maxLen) {
  return text.length > maxLen ? text.slice(0, maxLen) + "…" : text;
}

function readLocalStorage(key, fallback = null) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeLocalStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage full */
  }
}

// ─── Pricing Helpers ─────────────────────────────────────────────────────────

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

function syncPricingMatrixToState() {
  state.pricing = getPricingMatrixValues();
  if (state.settings.isKMode) {
    state.pricingKMode = structuredClone(state.pricing);
  } else {
    state.pricingStandard = structuredClone(state.pricing);
  }
}

function applyPricingMatrixToUI() {
  el("price-bw-long").value = state.pricing.bw.long;
  el("price-bw-short").value = state.pricing.bw.short;
  el("price-bw-a4").value = state.pricing.bw.a4;
  el("price-color-long").value = state.pricing.color.long;
  el("price-color-short").value = state.pricing.color.short;
  el("price-color-a4").value = state.pricing.color.a4;
}

function toggleKMode(enabled) {
  state.settings.isKMode = enabled;
  
  // Switch pricing set
  state.pricing = structuredClone(enabled ? state.pricingKMode : state.pricingStandard);
  
  // Update UI inputs
  applyPricingMatrixToUI();
  
  // Reprice all current items
  for (const item of state.fileItems) {
    item.unitPrice = getPriceForItem(item.colorMode, item.paperSize);
  }
  
  refreshAllRows();
  updateTotals();
  updateInvoicePreview();
  
  showToast(enabled ? "K-Mode Active 🤝" : "Standard Pricing Restored", "info");
}

// ─── Status Pill ─────────────────────────────────────────────────────────────

function updateClock() {
  const now = new Date();
  const timeEl = el("clock-time");
  const dateEl = el("clock-date");
  
  if (timeEl) {
    timeEl.textContent = now.toLocaleTimeString("en-US", {
      hour12: true,
      hour: "2-digit",
      minute: "2-digit"
    });
  }
  
  if (dateEl) {
    dateEl.textContent = now.toLocaleDateString("en-US", {
      month: "short",
      day: "2-digit",
      year: "numeric"
    });
  }
}

function setStatus(text, type = "ready") {
  const dot = el("status-dot");
  const span = el("status-text");
  span.textContent = text;
  dot.className = "status-dot";
  if (type === "analyzing") {
    dot.style.background = "var(--blue)";
    dot.classList.add("pulse");
  } else if (type === "unsaved") {
    dot.style.background = "var(--amber)";
  } else if (type === "copied") {
    dot.style.background = "var(--green)";
  } else {
    dot.style.background = "var(--green)";
  }
}

// ─── Toast ───────────────────────────────────────────────────────────────────

function showToast(message, type = "success") {
  const container = el("toast-container");

  const icons = {
    success:
      '<svg class="toast-icon success" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>',
    error:
      '<svg class="toast-icon error" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
    info: '<svg class="toast-icon info" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>',
  };

  const toast = buildElement("div", {
    className: `toast ${type}`,
    role: "alert",
  });
  toast.innerHTML = (icons[type] || icons.info) + `<span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = `toast-out 0.2s ease-in forwards`;
    setTimeout(() => toast.remove(), 200);
  }, TOAST_DURATION_MS);
}

// ─── PDF Processing ───────────────────────────────────────────────────────────

// Checks if two dimensions match (either orientation) within tolerance of 20pt
function isSizePt(w1, h1, w2, h2, tol = 20) {
  return (
    (Math.abs(w1 - w2) < tol && Math.abs(h1 - h2) < tol) ||
    (Math.abs(w1 - h2) < tol && Math.abs(h1 - w2) < tol)
  );
}

async function readPdfPageCountAsync(file) {
  const pdfjsLib = window.pdfjsLib;
  if (!pdfjsLib) throw new Error("pdf.js not loaded");

  // Set worker source for better performance and reliability
  pdfjsLib.GlobalWorkerOptions.workerSrc = "lib/pdf.worker.min.js";

  const arrayBuffer = await file.arrayBuffer();
  // Using Uint8Array is more robust for pdf.js
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) })
    .promise;
  const numPages = pdf.numPages;

  if (!Number.isInteger(numPages) || numPages < 1 || numPages > 9999) {
    throw new Error(`Bad page count: ${numPages}`);
  }

  let detectedSize = "short";
  // Iterate through pages to ensure full parsing (helps with some malformed PDFs)
  // and detect size from first page or mixed sizes if needed.
  for (let i = 1; i <= numPages; i++) {
    try {
      const page = await pdf.getPage(i);
      if (i === 1) {
        const v = page.view;
        const width = Math.abs(v[2] - v[0]);
        const height = Math.abs(v[3] - v[1]);
        if (isSizePt(width, height, 612, 936)) detectedSize = "long";
        else if (isSizePt(width, height, 595, 842)) detectedSize = "a4";
        else if (isSizePt(width, height, 612, 792)) detectedSize = "short";
        else {
          const longest = Math.max(width, height);
          if (longest > 870) detectedSize = "long";
          else if (longest > 810) detectedSize = "a4";
          else detectedSize = "short";
        }
      }
    } catch (e) {
      console.warn(`Failed to parse page ${i}`, e);
    }
  }

  return { numPages, detectedSize };
}

async function readDocxPageCountAsync(file) {
  try {
    const arrayBuffer = await file.arrayBuffer();

    // 1. Try metadata first (fastest)
    const zip = new JSZip();
    const loadedZip = await zip.loadAsync(arrayBuffer);
    const appXml = await loadedZip.file("docProps/app.xml")?.async("string");
    let metadataPages = 0;
    if (appXml) {
      const m = appXml.match(/<Pages>(\d+)<\/Pages>/);
      if (m) metadataPages = parseInt(m[1]);
    }

    // 2. Count explicit page breaks in document.xml
    const docXml = await loadedZip.file("word/document.xml")?.async("string");
    let breakCount = 1;
    if (docXml) {
      const explicit = (docXml.match(/<w:br\s+[^>]*w:type="page"/g) || [])
        .length;
      const rendered = (docXml.match(/<w:lastRenderedPageBreak/g) || []).length;
      breakCount = 1 + Math.max(explicit, rendered);
    }

    // 3. Use Mammoth to extract text and estimate based on content density
    // This handles files where metadata is stale and no explicit breaks exist.
    let contentPages = 0;
    if (window.mammoth) {
      const result = await mammoth.extractRawText({ arrayBuffer });
      const text = result.value || "";
      // Standard page: ~2500-3000 characters or ~400-500 words
      // We'll use a slightly conservative 2400 chars per page
      contentPages = Math.ceil(text.length / 2400);

      // If there's very little text but high break count, breaks win.
      // If there's lots of text but no breaks, text density wins.
    }

    const finalPages = Math.max(metadataPages, breakCount, contentPages, 1);

    // Safety check: if metadata is suspiciously high/low compared to text, trust text/breaks
    if (metadataPages > 0 && contentPages > 0) {
      // If metadata says 50 pages but text is 100 chars, metadata is likely wrong
      if (metadataPages > contentPages * 3)
        return Math.max(breakCount, contentPages);
    }

    return finalPages;
  } catch (e) {
    console.warn("DOCX reliable count failed", e);
    return estimateDocxPageCount(file);
  }
}

function estimateDocxPageCount(file) {
  return Math.max(1, Math.ceil(file.size / DOCX_BYTES_PER_PAGE));
}

// ─── File Processing ──────────────────────────────────────────────────────────

async function processUploadedFileAsync(file) {
  const ext = file.name.split(".").pop().toLowerCase();
  const isPdf = ext === "pdf";
  const isDocx = ext === "docx" || ext === "doc";
  const itemId = state.nextItemId++;
  const fileName = stripExtension(file.name);
  const copies =
    parseInt(el("default-copies").value) || state.settings.defaultCopies;

  const colorMode = "bw";
  const paperSize = "short";
  const unitPrice = getPriceForItem(colorMode, paperSize);

  const item = {
    id: itemId,
    fileName,
    fileExt: ext,
    pages: 0,
    copies,
    colorMode,
    paperSize,
    unitPrice,
    isPageExact: false,
    isManual: false,
    needsPageEntry: false,
  };

  state.fileItems.push(item);
  renderFileTableRow(item);
  showCompactDropZone();

  if (isPdf) {
    setStatus("Analyzing…", "analyzing");
    try {
      const result = await readPdfPageCountAsync(file);
      // Apply detected paper size
      item.paperSize = result.detectedSize;
      item.unitPrice = getPriceForItem(item.colorMode, item.paperSize);
      mutateItemPages(item.id, result.numPages, true);
    } catch {
      mutateItemNeedsPageEntry(item.id);
    } finally {
      setStatus("Ready");
    }
  } else if (isDocx) {
    setStatus("Analyzing…", "analyzing");
    try {
      const pages = await readDocxPageCountAsync(file);
      mutateItemPages(item.id, pages, true);
    } catch {
      const estimated = estimateDocxPageCount(file);
      mutateItemPages(item.id, estimated, false);
    } finally {
      setStatus("Ready");
    }
  } else {
    mutateItemNeedsPageEntry(item.id);
  }
}

function mutateItemPages(id, pages, isExact) {
  const item = findItemById(id);
  if (!item) return;
  item.pages = pages;
  item.isPageExact = isExact;
  item.needsPageEntry = false;
  refreshItemRow(id);
  updateTotals();
  updateInvoicePreview();
}

function mutateItemNeedsPageEntry(id) {
  const item = findItemById(id);
  if (!item) return;
  item.needsPageEntry = true;
  refreshItemRow(id);
}

function findItemById(id) {
  return state.fileItems.find((i) => i.id === id);
}

// ─── File Table ───────────────────────────────────────────────────────────────

function renderFileTableRow(item) {
  const tbody = el("file-table-body");
  const tr = buildElement("tr", {
    className: "file-row",
    id: `row-${item.id}`,
  });
  tbody.appendChild(tr);
  refreshItemRow(item.id);
  el("file-table-container").style.display = "block";
  updateTotals();
  updateInvoicePreview();
}

function refreshItemRow(id) {
  const item = findItemById(id);
  const tr = el(`row-${id}`);
  if (!item || !tr) return;

  const rowIndex = state.fileItems.indexOf(item) + 1;
  const rowTotal = computeItemTotal(item);
  const isActive = checkIfRowPushesTierActive(item);

  tr.className = "file-row" + (isActive ? " row-discount-active" : "");

  const metaPills = buildMetaPills(item);
  const fileTypePill = item.isManual
    ? ""
    : `<span class="meta-pill pill-filetype">${(item.fileExt || "file").toUpperCase()}</span>`;
  const pagesInputClass = item.needsPageEntry ? "num-input warn" : "num-input";
  const pagesValue = item.pages > 0 ? item.pages : "";

  const sizeLabel =
    { long: "Long", short: "Short", a4: "A4" }[item.paperSize] || "Short";
  const modeLabel = item.colorMode === "color" ? "Color" : "B&W";

  tr.innerHTML = `
    <td style="color:var(--text-3);font-size:12px;font-family:var(--font-mono)">${rowIndex}</td>
    <td class="file-name-cell">
      <span class="file-name-text" title="${item.fileName}">${item.fileName}</span>
      <div class="file-meta">${fileTypePill}${metaPills}${isActive ? '<span class="meta-pill pill-discount">✦ Tier</span>' : ""}</div>
    </td>
    <td>
      <select class="row-select" data-id="${id}" data-field="paperSize" aria-label="Paper size for ${item.fileName}">
        <option value="short"${item.paperSize === "short" ? " selected" : ""}>Short</option>
        <option value="long"${item.paperSize === "long" ? " selected" : ""}>Long</option>
        <option value="a4"${item.paperSize === "a4" ? " selected" : ""}>A4</option>
      </select>
    </td>
    <td>
      <select class="row-select" data-id="${id}" data-field="colorMode" aria-label="Color mode for ${item.fileName}">
        <option value="bw"${item.colorMode === "bw" ? " selected" : ""}>B&amp;W</option>
        <option value="color"${item.colorMode === "color" ? " selected" : ""}>Color</option>
      </select>
    </td>
    <td>
      <input type="number" class="${pagesInputClass}" value="${pagesValue}" min="1"
        data-id="${id}" data-field="pages" aria-label="Pages for ${item.fileName}" />
    </td>
    <td>
      <input type="number" class="num-input" value="${item.copies}" min="1"
        data-id="${id}" data-field="copies" aria-label="Copies for ${item.fileName}" />
    </td>
    <td class="total-cell" id="total-${id}">${formatPeso(rowTotal)}</td>
    <td>
      <button class="remove-btn" data-id="${id}" aria-label="Remove ${item.fileName}">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </td>
  `;
}

function buildMetaPills(item) {
  if (item.isManual)
    return '<span class="meta-pill pill-estimated">Manual</span>';
  if (item.needsPageEntry)
    return '<span class="meta-pill pill-warn">⚠ Enter pages</span>';
  if (item.isPageExact)
    return '<span class="meta-pill pill-exact">● Exact</span>';
  return '<span class="meta-pill pill-estimated" title="Estimated from file size">~Est.</span>';
}

function checkIfRowPushesTierActive(targetItem) {
  const totalWithout = state.fileItems
    .filter((i) => i.id !== targetItem.id)
    .reduce((sum, i) => sum + i.pages * i.copies, 0);
  const totalWith = totalWithout + targetItem.pages * targetItem.copies;
  const activeTier = resolveActiveTier(totalWith);
  const tierWithout = resolveActiveTier(totalWithout);
  return activeTier && activeTier !== tierWithout;
}

function refreshAllRows() {
  for (const item of state.fileItems) {
    refreshItemRow(item.id);
  }
}

function removeItemFromState(id) {
  state.fileItems = state.fileItems.filter((i) => i.id !== id);
  const tr = el(`row-${id}`);
  if (tr) {
    tr.style.opacity = "0";
    tr.style.transform = "translateX(-8px)";
    tr.style.transition = "all 0.15s";
    setTimeout(() => tr.remove(), 150);
  }
  if (state.fileItems.length === 0) {
    el("file-table-container").style.display = "none";
    showFullDropZone();
  }
  updateTotals();
  updateInvoicePreview();
}

function addManualItem() {
  const id = state.nextItemId++;
  const copies =
    parseInt(el("default-copies").value) || state.settings.defaultCopies;
  const colorMode = "bw";
  const paperSize = "short";
  const item = {
    id,
    fileName: "Custom Item",
    pages: 1,
    copies,
    colorMode,
    paperSize,
    unitPrice: getPriceForItem(colorMode, paperSize),
    isPageExact: true,
    isManual: true,
    needsPageEntry: false,
  };
  state.fileItems.push(item);
  renderFileTableRow(item);
  showCompactDropZone();
  updateTotals();
  updateInvoicePreview();
  setStatus("Unsaved", "unsaved");
}

// ─── Drop Zone State ──────────────────────────────────────────────────────────

function showFullDropZone() {
  el("drop-zone").style.display = "block";
  el("drop-zone-compact").style.display = "none";
}

function showCompactDropZone() {
  el("drop-zone").style.display = "none";
  el("drop-zone-compact").style.display = "flex";
}

// ─── Billing Calculations ─────────────────────────────────────────────────────

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

// ─── Totals Update ────────────────────────────────────────────────────────────

function updateTotals() {
  const totalPages = computeTotalPrintedPages();
  const totals = computeGrandTotal();

  el("tfoot-total-pages").textContent = totalPages;
  el("tfoot-subtotal").textContent = formatPeso(totals.subtotal);
  
  // Update "Collect" amount on Place Order button
  el("btn-collect-amount").textContent = formatPeso(totals.grandTotal);

  refreshDiscountTierHighlights(totalPages);
  updateInvoicePreview();
  persistSettingsToStorage();
  setStatus(
    state.fileItems.length > 0 ? "Unsaved" : "Ready",
    state.fileItems.length > 0 ? "unsaved" : "ready",
  );
}

function refreshTotalCell(id) {
  const item = findItemById(id);
  const cell = el(`total-${id}`);
  if (!item || !cell) return;

  const newTotal = formatPeso(computeItemTotal(item));
  if (cell.textContent !== newTotal) {
    cell.textContent = newTotal;
    cell.classList.add("total-flash");
    setTimeout(() => cell.classList.remove("total-flash"), 200);
  }
}

// ─── Discount Tiers UI ────────────────────────────────────────────────────────

function renderDiscountTiers() {
  const container = el("discount-tiers");
  container.innerHTML = "";

  const totalPages = computeTotalPrintedPages();
  const activeTier = resolveActiveTier(totalPages);

  for (let i = 0; i < state.discountTiers.length; i++) {
    const tier = state.discountTiers[i];
    const isActive = activeTier === tier;
    const row = buildElement("div", {
      className: `tier-row${isActive ? " active" : ""}`,
    });

    row.innerHTML = `
      <span class="tier-label">${isActive ? "✦" : "○"}</span>
      <input type="number" class="tier-input" value="${tier.minPages}" min="1" step="1"
        data-tier="${i}" data-field="minPages" aria-label="Minimum pages for tier ${i + 1}" />
      <span class="tier-label">pages</span>
      <span class="tier-label">→</span>
      <input type="number" class="tier-input" value="${tier.discountPct}" min="0" max="100" step="1"
        data-tier="${i}" data-field="discountPct" aria-label="Discount percent for tier ${i + 1}" />
      <span class="tier-label">% off</span>
      <button class="tier-remove-btn" data-tier="${i}" aria-label="Remove tier ${i + 1}" title="Remove tier">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    `;

    container.appendChild(row);
  }

  updateTierHint(totalPages, activeTier);
}

function updateTierHint(totalPages, activeTier) {
  const hint = el("tier-hint");
  if (activeTier) {
    hint.style.display = "none";
    return;
  }

  const sorted = [...state.discountTiers].sort(
    (a, b) => a.minPages - b.minPages,
  );
  const next = sorted.find((t) => t.minPages > totalPages);

  if (next) {
    const needed = next.minPages - totalPages;
    hint.textContent = `Add ${needed} more printed pages to unlock ${next.discountPct}% discount`;
    hint.style.display = "block";
  } else {
    hint.style.display = "none";
  }
}

function refreshDiscountTierHighlights(totalPages) {
  const activeTier = resolveActiveTier(totalPages);
  const rows = el("discount-tiers").querySelectorAll(".tier-row");
  rows.forEach((row, i) => {
    const tier = state.discountTiers[i];
    const isActive = tier === activeTier;
    row.className = `tier-row${isActive ? " active" : ""}`;
    const label = row.querySelector(".tier-label");
    if (label) label.textContent = isActive ? "✦" : "○";
  });
  updateTierHint(totalPages, activeTier);
}

function addDiscountTier() {
  const lastTier = state.discountTiers[state.discountTiers.length - 1];
  const newMinPages = lastTier ? lastTier.minPages + 15 : 15;
  state.discountTiers.push({ minPages: newMinPages, discountPct: 5 });
  renderDiscountTiers();
  updateTotals();
}

function removeDiscountTier(index) {
  state.discountTiers.splice(index, 1);
  renderDiscountTiers();
  updateTotals();
}

// ─── Invoice Preview (Clean SaaS — no recipient, logo, QR, signature) ────────

function updateInvoicePreview() {
  updateInvoiceHeader();
  updateInvoiceLineItems();
  updateInvoiceTotals();
  updateInvoiceRemarks();

  // ─── Dynamic Portrait Adjustment ───
  // We want the invoice to always feel like a "portrait" document (height > width).
  // The height should grow as more files are added, but never be shorter than a
  // standard portrait ratio (roughly 1.3 to 1.4 of its width).
  const preview = el("invoice-preview");
  const width = preview.offsetWidth || INVOICE_EXPORT_WIDTH_PX;
  const itemCount = state.fileItems.length;

  // Base height to ensure portrait for small invoices (e.g., 1 item)
  // For 0 items, show a standard A4-ish empty page.
  // For 1+ items, set min-height to ensure it looks like a vertical document.
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

// ─── Copy as Image ───────────────────────────────────────────────────────────

async function captureInvoiceCanvas() {
  // Clone #invoice-preview into a temp off-screen container
  const previewEl = el("invoice-preview");
  const clone = previewEl.cloneNode(true);

  // Apply dynamic portrait styles to the clone for a perfect export
  clone.style.boxShadow = "none";
  clone.style.borderRadius = "0";
  clone.style.margin = "0";
  clone.style.width = `${INVOICE_EXPORT_WIDTH_PX}px`;

  // Standard portrait ratio (A4 is 1.41)
  const minExportHeight = INVOICE_EXPORT_WIDTH_PX * 1.41;
  clone.style.minHeight = `${minExportHeight}px`;

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
    const canvas = await html2canvas(container, {
      scale: COPY_IMAGE_SCALE,
      useCORS: true,
      backgroundColor: "#ffffff",
      logging: false,
      width: INVOICE_EXPORT_WIDTH_PX,
      windowWidth: INVOICE_EXPORT_WIDTH_PX,
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
    saveInvoiceToRecentHistory();
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
      // Fall through to download
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

// ─── Recent Invoices & History ────────────────────────────────────────────────

function saveInvoiceToRecentHistory() {
  const totals = computeGrandTotal();
  const snapshot = {
    ref: state.invoiceRef,
    date: state.invoiceDate,
    grandTotal: totals.grandTotal,
    itemCount: state.fileItems.length,
    fileItems: state.fileItems.map(i => ({ fileName: i.fileName, pages: i.pages, copies: i.copies })),
    isDone: false,
    isPaid: false,
    timestamp: Date.now()
  };

  const history = readLocalStorage(STORAGE_KEYS.recentInvoices, []);
  history.unshift(snapshot);
  if (history.length > MAX_RECENT_INVOICES) history.pop();
  writeLocalStorage(STORAGE_KEYS.recentInvoices, history);
}

function renderHistoryList() {
  const container = el("history-list");
  const history = readLocalStorage(STORAGE_KEYS.recentInvoices, []);

  if (history.length === 0) {
    container.innerHTML = '<div class="dropdown-empty">No recent invoices</div>';
    return;
  }

  container.innerHTML = "";
  history.forEach((entry, idx) => {
    const item = buildElement("div", { 
      className: `history-item${entry.isDone ? ' is-done' : ''}${entry.isPaid ? ' is-paid' : ''}`,
      id: `history-item-${idx}`
    });

    const fileRows = entry.fileItems ? entry.fileItems.map(f => `
      <div class="history-file-row">
        <span class="history-file-name">${truncateText(f.fileName, 24)}</span>
        <span>${f.pages} pg × ${f.copies}</span>
      </div>
    `).join('') : '';

    item.innerHTML = `
      <div class="history-item-header" onclick="toggleHistoryExpanded(${idx})">
        <div class="history-item-top">
          <span class="history-item-ref">${entry.ref}</span>
          <span class="history-item-total">${formatPeso(entry.grandTotal)}</span>
        </div>
        <div class="history-item-meta">
          <span>${entry.date}</span>
          <span>•</span>
          <span>${entry.itemCount || 0} items</span>
        </div>
      </div>
      <div class="history-item-body">
        <div class="history-files">
          ${fileRows}
        </div>
        <div class="history-actions">
          <button class="btn-history-action${entry.isDone ? ' active-done' : ''}" onclick="toggleHistoryStatus(${idx}, 'isDone')">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
            Done
          </button>
          <button class="btn-history-action${entry.isPaid ? ' active-paid' : ''}" onclick="toggleHistoryStatus(${idx}, 'isPaid')">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
            Paid
          </button>
        </div>
      </div>
    `;
    container.appendChild(item);
  });
}

function toggleHistoryExpanded(idx) {
  const item = el(`history-item-${idx}`);
  if (item) item.classList.toggle("expanded");
}

function toggleHistoryStatus(idx, field) {
  const history = readLocalStorage(STORAGE_KEYS.recentInvoices, []);
  if (history[idx]) {
    history[idx][field] = !history[idx][field];
    writeLocalStorage(STORAGE_KEYS.recentInvoices, history);
    renderHistoryList();
    // Keep it expanded after toggle
    el(`history-item-${idx}`).classList.add("expanded");
  }
}

// ─── Drawer Management ───────────────────────────────────────────────────────

function openDrawer(view = "history") {
  switchDrawerView(view);
  el("app-drawer").classList.add("open");
  el("drawer-overlay").classList.add("open");
  document.body.style.overflow = "hidden";
  if (view === "history") renderHistoryList();
  else loadSettingsIntoDrawer();
}

function closeDrawer() {
  el("app-drawer").classList.remove("open");
  el("drawer-overlay").classList.remove("open");
  document.body.style.overflow = "";
}

function switchDrawerView(view) {
  if (view === "history") {
    el("history-view").style.display = "flex";
    el("settings-view").style.display = "none";
    el("tab-history").classList.add("active");
    el("tab-settings").classList.remove("active");
    renderHistoryList();
  } else {
    el("history-view").style.display = "none";
    el("settings-view").style.display = "flex";
    el("tab-history").classList.remove("active");
    el("tab-settings").classList.add("active");
    loadSettingsIntoDrawer();
  }
}

// ─── Settings ────────────────────────────────────────────────────────────────

function loadSettingsIntoDrawer() {
  const s = state.shopInfo;
  el("s-shop-name").value = s.name;
  el("s-shop-address").value = s.address;
  el("s-shop-phone").value = s.phone;
  el("s-shop-email").value = s.email;
  el("s-payment-terms").value = s.paymentTerms;
  el("s-tax-rate").value = state.settings.taxRate;
  el("s-default-copies").value = state.settings.defaultCopies;
}

function saveSettingsFromDrawer() {
  state.shopInfo = {
    name: el("s-shop-name").value.trim() || "",
    address: el("s-shop-address").value.trim(),
    phone: el("s-shop-phone").value.trim(),
    email: el("s-shop-email").value.trim(),
    paymentTerms: el("s-payment-terms").value.trim() || "Due on receipt",
  };

  state.settings.taxRate =
    parseFloat(el("s-tax-rate").value) || TAX_RATE_DEFAULT;
  state.settings.defaultCopies =
    parseInt(el("s-default-copies").value) || DEFAULT_COPIES;

  // Sync to main inputs
  el("tax-rate").value = state.settings.taxRate;
  el("default-copies").value = state.settings.defaultCopies;
  el("tax-rate-sub").textContent = `${state.settings.taxRate}%`;

  persistSettingsToStorage();
  updateInvoicePreview();
  closeDrawer();
  showToast("Settings saved", "success");
}

function persistSettingsToStorage() {
  writeLocalStorage(STORAGE_KEYS.shopInfo, state.shopInfo);
  writeLocalStorage(STORAGE_KEYS.settings, {
    taxRate: state.settings.taxRate,
    isTaxEnabled: state.settings.isTaxEnabled,
    isVatVisibleOnInvoice: state.settings.isVatVisibleOnInvoice,
    shouldRoundUp: state.settings.shouldRoundUp,
    defaultCopies: state.settings.defaultCopies,
    isKMode: state.settings.isKMode,
    discountTiers: state.discountTiers,
  });
  writeLocalStorage(STORAGE_KEYS.pricing, state.pricing);
  writeLocalStorage(STORAGE_KEYS.pricingStandard, state.pricingStandard);
  writeLocalStorage(STORAGE_KEYS.pricingKMode, state.pricingKMode);
  writeLocalStorage(STORAGE_KEYS.fileItems, state.fileItems);
}

function loadSettingsFromStorage() {
  const shopInfo = readLocalStorage(STORAGE_KEYS.shopInfo);
  if (shopInfo) Object.assign(state.shopInfo, shopInfo);

  const settings = readLocalStorage(STORAGE_KEYS.settings);
  if (settings) {
    state.settings.taxRate = settings.taxRate ?? TAX_RATE_DEFAULT;
    state.settings.isTaxEnabled = settings.isTaxEnabled ?? true;
    state.settings.isVatVisibleOnInvoice =
      settings.isVatVisibleOnInvoice ?? true;
    state.settings.shouldRoundUp = settings.shouldRoundUp ?? false;
    state.settings.defaultCopies = settings.defaultCopies ?? DEFAULT_COPIES;
    state.settings.isKMode = settings.isKMode ?? false;
    if (settings.discountTiers) state.discountTiers = settings.discountTiers;
  }

  const pricing = readLocalStorage(STORAGE_KEYS.pricing);
  if (pricing) Object.assign(state.pricing, pricing);

  const pricingStandard = readLocalStorage(STORAGE_KEYS.pricingStandard);
  if (pricingStandard) Object.assign(state.pricingStandard, pricingStandard);

  const pricingKMode = readLocalStorage(STORAGE_KEYS.pricingKMode);
  if (pricingKMode) Object.assign(state.pricingKMode, pricingKMode);

  const savedItems = readLocalStorage(STORAGE_KEYS.fileItems);
  if (savedItems && Array.isArray(savedItems)) {
    state.fileItems = savedItems;
    if (state.fileItems.length > 0) {
      state.nextItemId = Math.max(...state.fileItems.map((i) => i.id)) + 1;
    }
  }
}

function applyLoadedSettingsToUI() {
  el("default-copies").value = state.settings.defaultCopies;
  el("tax-rate").value = state.settings.taxRate;
  el("tax-enabled").checked = state.settings.isTaxEnabled;
  el("round-up").checked = state.settings.shouldRoundUp;
  el("vat-show-invoice").checked = state.settings.isVatVisibleOnInvoice;
  el("header-kmode-toggle").checked = state.settings.isKMode;
  el("tax-rate-sub").textContent = `${state.settings.taxRate}%`;
  el("tax-rate-row").style.display = state.settings.isTaxEnabled
    ? "flex"
    : "none";
  el("vat-show-row").style.display = state.settings.isTaxEnabled
    ? "flex"
    : "none";
  applyPricingMatrixToUI();
}

function resetSettingsToDefaults() {
  if (!confirm("Reset all settings to defaults?")) return;
  localStorage.removeItem(STORAGE_KEYS.settings);
  localStorage.removeItem(STORAGE_KEYS.shopInfo);
  localStorage.removeItem(STORAGE_KEYS.pricing);
  localStorage.removeItem(STORAGE_KEYS.pricingStandard);
  localStorage.removeItem(STORAGE_KEYS.pricingKMode);
  state.settings = {
    taxRate: TAX_RATE_DEFAULT,
    isTaxEnabled: true,
    isVatVisibleOnInvoice: true,
    shouldRoundUp: false,
    defaultCopies: DEFAULT_COPIES,
    isKMode: false,
  };
  state.shopInfo = {
    name: "Printing Shop",
    address: "",
    phone: "",
    email: "",
    paymentTerms: "Due on receipt",
  };
  state.pricing = structuredClone(PRICING_DEFAULTS);
  state.pricingStandard = structuredClone(PRICING_DEFAULTS);
  state.pricingKMode = structuredClone(KAKILALA_PRICING_DEFAULTS);
  state.discountTiers = structuredClone(DISCOUNT_TIERS_DEFAULT);
  applyLoadedSettingsToUI();
  renderDiscountTiers();
  closeDrawer();
  showToast("Settings reset to defaults", "info");
}

function clearAllInvoiceData() {
  state.fileItems = [];
  state.nextItemId = 1;
  state.invoiceRef = generateRef();
  el("file-table-body").innerHTML = "";
  el("file-table-container").style.display = "none";
  showFullDropZone();
  el("remarks").value = "";
  updateTotals();
  updateInvoicePreview();
}

// ─── Theme ───────────────────────────────────────────────────────────────────

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  el("icon-sun").style.display = theme === "dark" ? "block" : "none";
  el("icon-moon").style.display = theme === "dark" ? "none" : "block";
}

function toggleTheme() {
  const current = document.documentElement.getAttribute("data-theme");
  const next = current === "dark" ? "light" : "dark";
  applyTheme(next);
  writeLocalStorage(STORAGE_KEYS.theme, next);
}

// ─── Place Order ─────────────────────────────────────────────────────────────

function placeOrder() {
  if (state.fileItems.length === 0) {
    showToast(
      "Please upload at least one file before placing an order.",
      "error",
    );
    el("drop-zone").scrollIntoView({ behavior: "smooth", block: "center" });
    return;
  }

  const hasUnfilledPages = state.fileItems.some(
    (i) => i.needsPageEntry || i.pages < 1,
  );
  if (hasUnfilledPages) {
    showToast(
      "Please enter page counts for all items before placing an order.",
      "error",
    );
    return;
  }

  const totals = computeGrandTotal();
  
  // Final confirmation to ensure clarity on collection
  const collectMsg = `Confirm Order?\n\nTotal to collect: ${formatPeso(totals.grandTotal)}\nItems: ${state.fileItems.length}\nPages: ${computeTotalPrintedPages()}`;
  if (!confirm(collectMsg)) return;

  saveInvoiceToRecentHistory();

  // Copy invoice as image and confirm
  copyInvoiceAsImageAsync().then(() => {
    showToast(
      `✓ Order placed! Collect ${formatPeso(totals.grandTotal)}`,
      "success",
    );
    setStatus("Order Placed", "copied");
    
    // Automatically start new invoice as requested
    setTimeout(() => {
      clearAllInvoiceData();
      state.invoiceDate = formatDate(new Date());
      updateInvoicePreview();
      setStatus("Ready");
    }, 2000);
  });
}

// ─── Event Binding ────────────────────────────────────────────────────────────

function bindDropZoneEvents() {
  const zone = el("drop-zone");
  const compact = el("drop-zone-compact");
  const input = el("file-input");
  const overlay = el("file-drop-overlay");

  const openFilePicker = () => input.click();

  zone.addEventListener("click", openFilePicker);
  compact.addEventListener("click", openFilePicker);
  zone.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") openFilePicker();
  });
  compact.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") openFilePicker();
  });

  // Full-page drag-drop with overlay
  let dragCounter = 0;

  window.addEventListener("dragenter", (e) => {
    e.preventDefault();
    dragCounter++;
    if (e.dataTransfer.types.includes("Files")) {
      overlay.classList.add("active");
    }
  });

  window.addEventListener("dragover", (e) => {
    e.preventDefault();
  });

  window.addEventListener("dragleave", (e) => {
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
    handleFiles(Array.from(input.files));
    input.value = "";
  });
}

async function handleFiles(files) {
  const supported = files.filter((f) => /\.(pdf|docx|doc)$/i.test(f.name));
  if (supported.length === 0) {
    showToast("Only PDF and DOCX files are supported", "error");
    return;
  }
  for (const file of supported) {
    await processUploadedFileAsync(file);
  }
}

function bindFileTableEvents() {
  el("file-table-body").addEventListener("change", (e) => {
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

  el("file-table-body").addEventListener("click", (e) => {
    const btn = e.target.closest(".remove-btn");
    if (!btn) return;
    const id = parseInt(btn.dataset.id);
    if (id) removeItemFromState(id);
  });
}

function bindPricingMatrixEvents() {
  el("pricing-matrix-table").addEventListener("input", () => {
    syncPricingMatrixToState();
    // Reprice all items based on their current colorMode and paperSize
    for (const item of state.fileItems) {
      item.unitPrice = getPriceForItem(item.colorMode, item.paperSize);
    }
    refreshAllRows();
    updateTotals();
    updateInvoicePreview();
  });
}

function bindPricingEvents() {
  el("tax-rate").addEventListener("input", () => {
    state.settings.taxRate =
      parseFloat(el("tax-rate").value) || TAX_RATE_DEFAULT;
    el("tax-rate-sub").textContent = `${state.settings.taxRate}%`;
    updateTotals();
  });

  el("tax-enabled").addEventListener("change", () => {
    state.settings.isTaxEnabled = el("tax-enabled").checked;
    el("tax-rate-row").style.display = state.settings.isTaxEnabled
      ? "flex"
      : "none";
    el("vat-show-row").style.display = state.settings.isTaxEnabled
      ? "flex"
      : "none";
    updateTotals();
    updateInvoicePreview();
  });

  el("vat-show-invoice").addEventListener("change", () => {
    state.settings.isVatVisibleOnInvoice = el("vat-show-invoice").checked;
    updateInvoicePreview();
  });

  el("round-up").addEventListener("change", () => {
    state.settings.shouldRoundUp = el("round-up").checked;
    updateTotals();
  });
}

function bindDiscountTierEvents() {
  el("discount-tiers").addEventListener("change", (e) => {
    const input = e.target;
    const tierIdx = parseInt(input.dataset.tier);
    const field = input.dataset.field;
    if (isNaN(tierIdx) || !field) return;

    state.discountTiers[tierIdx][field] = parseFloat(input.value) || 0;
    updateTotals();
    refreshDiscountTierHighlights(computeTotalPrintedPages());
  });

  el("discount-tiers").addEventListener("click", (e) => {
    const btn = e.target.closest(".tier-remove-btn");
    if (!btn) return;
    const idx = parseInt(btn.dataset.tier);
    if (!isNaN(idx)) removeDiscountTier(idx);
  });

  el("btn-add-tier").addEventListener("click", addDiscountTier);
}

function bindExportEvents() {
  el("btn-place-order").addEventListener("click", placeOrder);
  el("btn-copy-image").addEventListener("click", copyInvoiceAsImageAsync);
  el("btn-print").addEventListener("click", () => window.print());
  el("btn-save-png").addEventListener("click", saveAsPngAsync);
  el("btn-new-invoice").addEventListener("click", () => {
    if (!confirm("Start a new invoice? Current data will be cleared.")) return;
    clearAllInvoiceData();
    state.invoiceRef = generateRef();
    state.invoiceDate = formatDate(new Date());
    updateInvoicePreview();
  });

  el("btn-add-item").addEventListener("click", addManualItem);
  el("btn-reset-copies").addEventListener("click", () => {
    for (const item of state.fileItems) {
      item.copies = 1;
    }
    refreshAllRows();
    updateTotals();
    updateInvoicePreview();
  });

  el("remarks").addEventListener("input", updateInvoiceRemarks);

  // Keyboard shortcut: Ctrl/Cmd+Shift+C
  document.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "C") {
      e.preventDefault();
      copyInvoiceAsImageAsync();
    }
  });
}

function bindSettingsEvents() {
  el("btn-settings-toggle").addEventListener("click", () => openDrawer("settings"));
  el("drawer-close").addEventListener("click", closeDrawer);
  el("drawer-overlay").addEventListener("click", closeDrawer);
  el("btn-drawer-cancel").addEventListener("click", closeDrawer);
  el("btn-save-settings").addEventListener("click", saveSettingsFromDrawer);
  el("btn-clear-all").addEventListener("click", () => {
    if (!confirm("Clear current invoice data?")) return;
    clearAllInvoiceData();
    showToast("Invoice cleared", "info");
  });
  el("btn-reset-settings").addEventListener("click", resetSettingsToDefaults);

  // Tabs
  el("tab-history").addEventListener("click", () => switchDrawerView("history"));
  el("tab-settings").addEventListener("click", () => switchDrawerView("settings"));
}

/**
 * Prevents non-digit characters in number inputs and blocks decimals/exponents
 */
function bindNumericInputEvents() {
  document.addEventListener("keydown", (e) => {
    // Only target inputs with type="number"
    if (e.target.tagName === "INPUT" && e.target.type === "number") {
      // List of keys to allow (Digits, Backspace, Delete, Arrows, Tab, Home, End, Enter, Period)
      const allowedKeys = [
        "0",
        "1",
        "2",
        "3",
        "4",
        "5",
        "6",
        "7",
        "8",
        "9",
        ".",
        "Backspace",
        "Delete",
        "ArrowLeft",
        "ArrowRight",
        "Tab",
        "Home",
        "End",
        "Enter",
      ];

      // Allow Ctrl+A, Ctrl+C, Ctrl+V, etc.
      if (e.ctrlKey || e.metaKey) return;

      if (!allowedKeys.includes(e.key)) {
        e.preventDefault();
      }
    }
  });

  // Also prevent pasting non-numeric content
  document.addEventListener("paste", (e) => {
    if (e.target.tagName === "INPUT" && e.target.type === "number") {
      const data = e.clipboardData.getData("text");
      if (!/^\d+\.?\d*$/.test(data)) {
        e.preventDefault();
      }
    }
  });
}

function bindHeaderEvents() {
  el("btn-theme").addEventListener("click", toggleTheme);

  el("header-kmode-toggle").addEventListener("change", () => {
    toggleKMode(el("header-kmode-toggle").checked);
  });

  el("btn-recent").addEventListener("click", () => {
    openDrawer("history");
  });

  el("btn-clear-recent-history").addEventListener("click", () => {
    if (!confirm("Clear all invoice history?")) return;
    localStorage.removeItem(STORAGE_KEYS.recentInvoices);
    renderHistoryList();
    showToast("History cleared", "info");
  });
}

function bindMobilePreviewEvents() {
  el("preview-fab").addEventListener("click", () => {
    el("preview-modal").classList.add("open");
    const clone = el("invoice-preview").cloneNode(true);
    clone.id = "invoice-preview-clone";
    el("preview-modal-content").innerHTML = "";
    el("preview-modal-content").appendChild(clone);
  });

  el("preview-modal-close").addEventListener("click", () => {
    el("preview-modal").classList.remove("open");
  });

  el("preview-modal").addEventListener("click", (e) => {
    if (e.target === el("preview-modal"))
      el("preview-modal").classList.remove("open");
  });
}

// ─── Initialization ───────────────────────────────────────────────────────────

function init() {
  // Load persisted theme
  const savedTheme = readLocalStorage(STORAGE_KEYS.theme, "dark");
  applyTheme(savedTheme);

  // Load settings
  loadSettingsFromStorage();
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
  bindDropZoneEvents();
  bindFileTableEvents();
  bindPricingMatrixEvents();
  bindPricingEvents();
  bindDiscountTierEvents();
  bindExportEvents();
  bindSettingsEvents();
  bindHeaderEvents();
  bindMobilePreviewEvents();

  setStatus("Ready");
}

document.addEventListener("DOMContentLoaded", init);
