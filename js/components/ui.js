/**
 * UI Components (Modals, Toasts, Clock, Status, Tables)
 */

// ─── Modal System ───────────────────────────────────────────────────────────

function showModal(options = {}) {
  const overlay = el("global-modal-overlay");
  const contentEl = el("global-modal-content");
  const titleEl = el("global-modal-title");
  const bodyEl = el("global-modal-body");
  const footerEl = el("global-modal-footer");

  if (!overlay || !contentEl || !titleEl || !bodyEl || !footerEl) return;

  // Reset classes
  contentEl.className = "modal-content";
  if (options.modalClass) {
    contentEl.classList.add(options.modalClass);
  }

  titleEl.textContent = options.title || "Notification";
  
  if (options.bodyHtml) {
    bodyEl.innerHTML = options.bodyHtml;
  } else {
    bodyEl.textContent = options.body || "";
  }
  
  footerEl.innerHTML = "";

  const type = options.type || "info"; // info, confirm, danger

  if (type === "confirm" || type === "danger" || options.showCancel) {
    const cancelBtn = buildElement("button", {
      className: "modal-btn modal-btn-secondary",
      textContent: options.cancelText || "Cancel",
    });
    cancelBtn.onclick = () => {
      closeModal();
      if (options.onCancel) options.onCancel();
    };
    footerEl.appendChild(cancelBtn);
  }

  const confirmBtn = buildElement("button", {
    className: `modal-btn ${type === "danger" ? "modal-btn-danger" : "modal-btn-primary"}`,
    textContent: options.confirmText || (type === "info" ? "Close" : "OK"),
  });
  confirmBtn.onclick = () => {
    closeModal();
    if (options.onConfirm) options.onConfirm();
  };
  footerEl.appendChild(confirmBtn);

  overlay.classList.add("open");
  document.body.style.overflow = "hidden";
}

function closeModal() {
  const overlay = el("global-modal-overlay");
  if (overlay) overlay.classList.remove("open");
  document.body.style.overflow = "";
}

function bindModalEvents() {
  const closeBtn = el("global-modal-close");
  const overlay = el("global-modal-overlay");
  
  if (closeBtn) closeBtn.onclick = closeModal;
  if (overlay) {
    overlay.onclick = (e) => {
      if (e.target === overlay) closeModal();
    };
  }
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeModal();
  });
}

// ─── Status Pill ─────────────────────────────────────────────────────────────

function setStatus(text, type = "ready") {
  const dot = el("status-dot");
  const span = el("status-text");
  if (!dot || !span) return;

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

// ─── Clock ───────────────────────────────────────────────────────────────────

function updateClock() {
  const now = new Date();
  const timeEl = el("clock-time");
  const dateEl = el("clock-date");

  if (timeEl) {
    timeEl.textContent = now.toLocaleTimeString("en-US", {
      hour12: true,
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  if (dateEl) {
    dateEl.textContent = now.toLocaleDateString("en-US", {
      month: "short",
      day: "2-digit",
      year: "numeric",
    });
  }
}

// ─── Toast ───────────────────────────────────────────────────────────────────

function showToast(message, type = "success") {
  const container = el("toast-container");
  if (!container) return;

  const icons = {
    success: '<svg class="toast-icon success" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>',
    error: '<svg class="toast-icon error" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
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

// ─── File Table Rendering ────────────────────────────────────────────────────

function renderFileTableRow(item) {
  const tbody = el("file-table-body");
  if (!tbody) return;

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

  const nameContent = item.isManual
    ? `<input type="text" class="row-name-input" value="${item.fileName}" data-id="${id}" data-field="fileName" />`
    : `<span class="file-name-text" title="${item.fileName}">${item.fileName}</span>`;

  tr.innerHTML = `
    <td style="color:var(--text-3);font-size:12px;font-family:var(--font-mono)">${rowIndex}</td>
    <td class="file-name-cell">
      ${nameContent}
      <div class="file-meta">${fileTypePill}${metaPills}${isActive ? '<span class="meta-pill pill-discount">✦ Tier</span>' : ""}</div>
    </td>
    <td>
      <select class="row-select" data-id="${id}" data-field="paperSize">
        <option value="short"${item.paperSize === "short" ? " selected" : ""}>Short</option>
        <option value="long"${item.paperSize === "long" ? " selected" : ""}>Long</option>
        <option value="a4"${item.paperSize === "a4" ? " selected" : ""}>A4</option>
      </select>
    </td>
    <td>
      <select class="row-select" data-id="${id}" data-field="colorMode">
        <option value="bw"${item.colorMode === "bw" ? " selected" : ""}>B&amp;W</option>
        <option value="color"${item.colorMode === "color" ? " selected" : ""}>Color</option>
      </select>
    </td>
    <td>
      <input type="number" class="${pagesInputClass}" value="${pagesValue}" min="1"
        data-id="${id}" data-field="pages" />
    </td>
    <td>
      <input type="number" class="num-input" value="${item.copies}" min="1"
        data-id="${id}" data-field="copies" />
    </td>
    <td class="total-cell" id="total-${id}">${formatPeso(rowTotal)}</td>
    <td>
      <button class="remove-btn" data-id="${id}" title="Remove item">
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
  const copies = parseInt(el("default-copies")?.value) || state.settings.defaultCopies;
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

function showFullDropZone() {
  const dz = el("drop-zone");
  const cdz = el("drop-zone-compact");
  if (dz) dz.style.display = "block";
  if (cdz) cdz.style.display = "none";
}

function showCompactDropZone() {
  const dz = el("drop-zone");
  const cdz = el("drop-zone-compact");
  if (dz) dz.style.display = "none";
  if (cdz) cdz.style.display = "flex";
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
