/**
 * Revenue Dashboard Component
 * Improved design with better visual hierarchy, Syne font, and progress bars.
 */

window.resetCumulativeStats = function() {
  showModal({
    title: "Reset Statistics",
    body: "Are you sure you want to reset all cumulative print statistics? This will not affect your invoice history.",
    type: "danger",
    confirmText: "Reset",
    onConfirm: () => {
      state.cumulativeStats = {
        pagesLong: 0,
        pagesShort: 0,
        pagesA4: 0,
        totalRevenue: 0,
        totalOrders: 0,
      };
      writeLocalStorage(STORAGE_KEYS.cumulativeStats, state.cumulativeStats);
      showToast("Statistics reset", "info");
      showRevenueDashboard(); // Refresh
    }
  });
}

function showRevenueDashboard() {
  const c = state.cumulativeStats;
  const r = state.revenueConfig;

  // Unit costs
  const costPaperLong = r.reamPriceLong / r.sheetsPerReam;
  const costPaperShort = r.reamPriceShort / r.sheetsPerReam;
  const costPaperA4 = r.reamPriceA4 / r.sheetsPerReam;
  const costInk = r.inkCostBottle / r.inkPagesYield;
  const costElec = (r.printerWattage / 1000) * (5 / 3600) * r.elecKwhRate;

  // Total Expenses
  const expPaper = (c.pagesLong * costPaperLong) + (c.pagesShort * costPaperShort) + (c.pagesA4 * costPaperA4);
  const totalPages = c.pagesLong + c.pagesShort + c.pagesA4;
  const expInk = totalPages * costInk;
  const expElec = totalPages * costElec;
  const totalExpenses = expPaper + expInk + expElec;
  const profit = c.totalRevenue - totalExpenses;
  const margin = c.totalRevenue > 0 ? (profit / c.totalRevenue) * 100 : 0;

  // Suggested Pricing (Markup based)
  const baseCostLong = costPaperLong + costInk + costElec;
  const baseCostShort = costPaperShort + costInk + costElec;
  const baseCostA4 = costPaperA4 + costInk + costElec;

  const suggestPrice = (base) => {
    const suggested = base * 2.5; // 150% markup
    return Math.max(suggested, 2.0).toFixed(2);
  };

  const getReamStats = (printed, sheets) => {
    const remaining = sheets - (printed % sheets);
    const percent = (remaining / sheets) * 100;
    const isLow = remaining < (sheets * 0.2); // Low stock if < 20%
    return { remaining, percent, isLow };
  };

  const longReam = getReamStats(c.pagesLong, r.sheetsPerReam);
  const shortReam = getReamStats(c.pagesShort, r.sheetsPerReam);
  const a4Ream = getReamStats(c.pagesA4, r.sheetsPerReam);

  const bodyHtml = `
    <div class="revenue-dashboard-v2">
      <!-- Key Metrics -->
      <div class="dashboard-metrics">
        <div class="metric-card revenue">
          <div class="metric-label">Total Revenue</div>
          <div class="metric-value syne-font">${formatPeso(c.totalRevenue)}</div>
        </div>
        <div class="metric-card profit ${profit >= 0 ? 'positive' : 'negative'}">
          <div class="metric-label">Net Profit</div>
          <div class="metric-value syne-font">${formatPeso(profit)}</div>
        </div>
        <div class="metric-card margin">
          <div class="metric-label">Profit Margin</div>
          <div class="metric-value syne-font">${margin.toFixed(1)}%</div>
        </div>
      </div>

      <!-- Ream Stock Progress -->
      <div class="dashboard-section">
        <div class="section-title-alt">Ream Stock Tracking</div>
        <div class="ream-progress-grid">
          ${renderReamProgress('Short', shortReam)}
          ${renderReamProgress('A4', a4Ream)}
          ${renderReamProgress('Long', longReam)}
        </div>
      </div>

      <!-- Financial Breakdown -->
      <div class="dashboard-split">
        <div class="dashboard-section">
          <div class="section-title-alt">Expense Breakdown</div>
          <div class="expense-list">
            <div class="expense-item">
              <span>Paper</span>
              <span class="expense-val">${formatPeso(expPaper)}</span>
            </div>
            <div class="expense-item">
              <span>Ink</span>
              <span class="expense-val">${formatPeso(expInk)}</span>
            </div>
            <div class="expense-item">
              <span>Electricity</span>
              <span class="expense-val">${formatPeso(expElec)}</span>
            </div>
            <div class="expense-total">
              <span>Total Cost</span>
              <span>${formatPeso(totalExpenses)}</span>
            </div>
          </div>
        </div>

        <div class="dashboard-section">
          <div class="section-title-alt">Suggested Pricing</div>
          <div class="suggest-list">
            ${renderSuggestItem('Short', baseCostShort, suggestPrice(baseCostShort))}
            ${renderSuggestItem('A4', baseCostA4, suggestPrice(baseCostA4))}
            ${renderSuggestItem('Long', baseCostLong, suggestPrice(baseCostLong))}
          </div>
        </div>
      </div>
      
      <div class="dashboard-footer-actions">
        <button class="btn-dashboard-reset">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg>
          Reset Statistics
        </button>
      </div>
    </div>
  `;

  showModal({
    title: "Revenue Analytics",
    bodyHtml: bodyHtml,
    type: "info",
    confirmText: "Close",
    modalClass: "modal-lg"
  });

  // Bind Reset Statistics Event (Post-render)
  const resetBtn = document.querySelector(".btn-dashboard-reset");
  if (resetBtn) {
    resetBtn.addEventListener("click", () => window.resetCumulativeStats());
  }
}

function renderReamProgress(label, stats) {
  const statusClass = stats.isLow ? 'status-low' : 'status-ok';
  return `
    <div class="ream-item">
      <div class="ream-info">
        <span class="ream-name">${label}</span>
        <span class="ream-count">${stats.remaining} / ${state.revenueConfig.sheetsPerReam}</span>
      </div>
      <div class="ream-progress-wrap">
        <div class="ream-progress-fill ${statusClass}" style="width: ${stats.percent}%"></div>
      </div>
      ${stats.isLow ? '<span class="low-stock-indicator">Low Stock</span>' : ''}
    </div>
  `;
}

function renderSuggestItem(label, cost, suggested) {
  return `
    <div class="suggest-card">
      <div class="suggest-card-label">${label}</div>
      <div class="suggest-card-price syne-font">₱${suggested}</div>
      <div class="suggest-card-cost">Cost: ₱${cost.toFixed(2)}</div>
    </div>
  `;
}
