/**
 * History Management
 */

function saveInvoiceToRecentHistory() {
  const totals = computeGrandTotal();
  const snapshot = {
    ref: state.invoiceRef,
    date: state.invoiceDate,
    grandTotal: totals.grandTotal,
    itemCount: state.fileItems.length,
    fileItems: state.fileItems.map((i) => ({
      fileName: i.fileName,
      pages: i.pages,
      copies: i.copies,
      fileSize: i.fileSize,
      paperSize: i.paperSize,
      colorMode: i.colorMode,
    })),
    remarks: el("remarks").value.trim(),
    isDone: false,
    isPaid: false,
    timestamp: Date.now(),
  };

  const history = readLocalStorage(STORAGE_KEYS.recentInvoices, []);
  history.unshift(snapshot);
  if (history.length > MAX_RECENT_INVOICES) history.pop();
  writeLocalStorage(STORAGE_KEYS.recentInvoices, history);
}

window.deleteHistoryItem = function(idx) {
  showModal({
    title: "Remove History Item",
    body: "Are you sure you want to remove this item from your history?",
    type: "danger",
    confirmText: "Remove",
    onConfirm: () => {
      const history = readLocalStorage(STORAGE_KEYS.recentInvoices, []);
      history.splice(idx, 1);
      writeLocalStorage(STORAGE_KEYS.recentInvoices, history);
      renderHistoryList();
      showToast("Item removed from history", "info");
    },
  });
}

window.clearAllHistory = function() {
  showModal({
    title: "Clear History",
    body: "This will permanently remove all saved invoices from your history. This action cannot be undone.",
    type: "danger",
    confirmText: "Clear All",
    onConfirm: () => {
      writeLocalStorage(STORAGE_KEYS.recentInvoices, []);
      renderHistoryList();
      showToast("History cleared", "info");
    },
  });
}

window.toggleHistoryStatus = function(idx, field) {
  const history = readLocalStorage(STORAGE_KEYS.recentInvoices, []);
  if (history[idx]) {
    history[idx][field] = !history[idx][field];
    writeLocalStorage(STORAGE_KEYS.recentInvoices, history);
    renderHistoryList();
    // Keep it expanded after toggle
    el(`history-item-${idx}`).classList.add("expanded");
  }
}

window.toggleHistoryExpanded = function(idx) {
  const item = el(`history-item-${idx}`);
  if (item) item.classList.toggle("expanded");
}

function renderHistoryList() {
  const container = el("history-list");
  const history = readLocalStorage(STORAGE_KEYS.recentInvoices, []);

  if (history.length === 0) {
    container.innerHTML =
      '<div class="dropdown-empty">No recent invoices</div>';
    return;
  }

  container.innerHTML = "";
  history.forEach((entry, idx) => {
    const item = buildElement("div", {
      className: `history-item${entry.isDone ? " is-done" : ""}${entry.isPaid ? " is-paid" : ""}`,
      id: `history-item-${idx}`,
    });

    const fileRows = entry.fileItems
      ? entry.fileItems
          .map((f) => {
            const sizeStr = f.fileSize ? ` <span class="history-file-size">(${formatSize(f.fileSize)})</span>` : "";
            const paperLabel = { long: "Long", short: "Short", a4: "A4" }[f.paperSize] || "Short";
            const modeLabel = f.colorMode === "color" ? "Color" : "B&W";
            
            return `
      <div class="history-file-row">
        <div class="history-file-info">
          <span class="history-file-name">${truncateText(f.fileName, 24)}</span>
          <div style="display:flex;gap:4px;align-items:center">
            <span class="meta-pill" style="font-size:8px;padding:1px 4px;background:var(--bg-card);border:1px solid var(--border)">${paperLabel}</span>
            <span class="meta-pill" style="font-size:8px;padding:1px 4px;background:var(--bg-card);border:1px solid var(--border)">${modeLabel}</span>
            ${sizeStr}
          </div>
        </div>
        <span class="history-file-calc">${f.pages} pg × ${f.copies} qty</span>
      </div>
    `;
          })
          .join("")
      : "";

    const remarksHtml = entry.remarks
      ? `
      <div class="history-remarks">
        <div class="history-remarks-header">
           <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
           <span>Special Instructions</span>
        </div>
        <div class="history-remarks-content">${entry.remarks}</div>
      </div>
    `
      : "";

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
        ${remarksHtml}
        <div class="history-actions">
          <button class="btn-history-action${entry.isDone ? " active-done" : ""}" onclick="toggleHistoryStatus(${idx}, 'isDone')">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
            Done
          </button>
          <button class="btn-history-action${entry.isPaid ? " active-paid" : ""}" onclick="toggleHistoryStatus(${idx}, 'isPaid')">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
            Paid
          </button>
          <button class="btn-history-action danger" onclick="deleteHistoryItem(${idx})">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/></svg>
          </button>
        </div>
      </div>
    `;
    container.appendChild(item);
  });
}
