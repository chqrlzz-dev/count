/**
 * Settings & Persistence
 */

async function persistSettingsToStorage() {
  await Promise.all([
    writeDb(STORAGE_KEYS.settings, {
      taxRate: state.settings.taxRate,
      isTaxEnabled: state.settings.isTaxEnabled,
      isVatVisibleOnInvoice: state.settings.isVatVisibleOnInvoice,
      shouldRoundUp: state.settings.shouldRoundUp,
      defaultCopies: state.settings.defaultCopies,
      isKMode: state.settings.isKMode,
      discountTiers: state.discountTiers,
    }),
    writeDb(STORAGE_KEYS.pricing, state.pricing),
    writeDb(STORAGE_KEYS.pricingStandard, state.pricingStandard),
    writeDb(STORAGE_KEYS.pricingKMode, state.pricingKMode),
    writeDb(STORAGE_KEYS.revenueConfig, state.revenueConfig),
    writeDb(STORAGE_KEYS.cumulativeStats, state.cumulativeStats),
    writeDb(STORAGE_KEYS.shopInfo, state.shopInfo),
    writeDb(STORAGE_KEYS.fileItems, state.fileItems),
  ]);
}

async function loadSettingsFromStorage() {
  const [
    shopInfo,
    settings,
    pricing,
    pricingStandard,
    pricingKMode,
    revConfig,
    cumStats,
    savedItems,
    theme
  ] = await Promise.all([
    readDb(STORAGE_KEYS.shopInfo),
    readDb(STORAGE_KEYS.settings),
    readDb(STORAGE_KEYS.pricing),
    readDb(STORAGE_KEYS.pricingStandard),
    readDb(STORAGE_KEYS.pricingKMode),
    readDb(STORAGE_KEYS.revenueConfig),
    readDb(STORAGE_KEYS.cumulativeStats),
    readDb(STORAGE_KEYS.fileItems),
    readDb(STORAGE_KEYS.theme, "dark")
  ]);

  if (shopInfo) Object.assign(state.shopInfo, shopInfo);

  if (settings) {
    state.settings.taxRate = settings.taxRate ?? TAX_RATE_DEFAULT;
    state.settings.isTaxEnabled = settings.isTaxEnabled ?? true;
    state.settings.isVatVisibleOnInvoice = settings.isVatVisibleOnInvoice ?? true;
    state.settings.shouldRoundUp = settings.shouldRoundUp ?? false;
    state.settings.defaultCopies = settings.defaultCopies ?? DEFAULT_COPIES;
    state.settings.isKMode = settings.isKMode ?? false;
    if (settings.discountTiers) state.discountTiers = settings.discountTiers;
  }

  if (pricing) Object.assign(state.pricing, pricing);
  if (pricingStandard) Object.assign(state.pricingStandard, pricingStandard);
  if (pricingKMode) Object.assign(state.pricingKMode, pricingKMode);
  if (revConfig) Object.assign(state.revenueConfig, revConfig);
  if (cumStats) Object.assign(state.cumulativeStats, cumStats);

  if (savedItems && Array.isArray(savedItems)) {
    state.fileItems = savedItems;
    if (state.fileItems.length > 0) {
      state.nextItemId = Math.max(...state.fileItems.map((i) => i.id)) + 1;
    }
  }

  // Initial pricing set based on K-Mode
  state.pricing = JSON.parse(JSON.stringify(
    state.settings.isKMode ? state.pricingKMode : state.pricingStandard
  ));

  applyTheme(theme);
}

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  const sun = el("icon-sun");
  const moon = el("icon-moon");
  if (sun && moon) {
    sun.style.display = theme === "dark" ? "block" : "none";
    moon.style.display = theme === "dark" ? "none" : "block";
  }
}

async function toggleTheme() {
  const current = document.documentElement.getAttribute("data-theme");
  const next = current === "dark" ? "light" : "dark";
  applyTheme(next);
  await writeDb(STORAGE_KEYS.theme, next);
}

function toggleKMode(enabled) {
  state.settings.isKMode = enabled;
  state.pricing = JSON.parse(JSON.stringify(
    enabled ? state.pricingKMode : state.pricingStandard
  ));

  applyPricingMatrixToUI();

  for (const item of state.fileItems) {
    item.unitPrice = getPriceForItem(item.colorMode, item.paperSize);
  }

  refreshAllRows();
  updateTotals();
  updateInvoicePreview();

  showToast(enabled ? "K-Mode Active 🤝" : "Standard Pricing Restored", "info");
}

function applyPricingMatrixToUI() {
  if (el("price-bw-long")) el("price-bw-long").value = state.pricing.bw.long;
  if (el("price-bw-short")) el("price-bw-short").value = state.pricing.bw.short;
  if (el("price-bw-a4")) el("price-bw-a4").value = state.pricing.bw.a4;
  if (el("price-color-long")) el("price-color-long").value = state.pricing.color.long;
  if (el("price-color-short")) el("price-color-short").value = state.pricing.color.short;
  if (el("price-color-a4")) el("price-color-a4").value = state.pricing.color.a4;
}

function syncPricingMatrixToState() {
  state.pricing = getPricingMatrixValues();
  if (state.settings.isKMode) {
    state.pricingKMode = JSON.parse(JSON.stringify(state.pricing));
  } else {
    state.pricingStandard = JSON.parse(JSON.stringify(state.pricing));
  }
}

function renderDiscountTiers() {
  const container = el("discount-tiers");
  if (!container) return;
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
        data-tier="${i}" data-field="minPages" />
      <span class="tier-label">pages</span>
      <span class="tier-label">→</span>
      <input type="number" class="tier-input" value="${tier.discountPct}" min="0" max="100" step="1"
        data-tier="${i}" data-field="discountPct" />
      <span class="tier-label">% off</span>
      <button class="tier-remove-btn" data-tier="${i}" title="Remove tier">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    `;
    container.appendChild(row);
  }
  updateTierHint(totalPages, activeTier);
}

function refreshDiscountTierHighlights() {
  renderDiscountTiers();
}

function updateTierHint(totalPages, activeTier) {
  const hintEl = el("tier-hint");
  if (!hintEl) return;
  
  const nextTier = [...state.discountTiers]
    .sort((a, b) => a.minPages - b.minPages)
    .find((t) => t.minPages > totalPages);

  if (nextTier) {
    const diff = nextTier.minPages - totalPages;
    hintEl.textContent = `Add ${diff} more pages for ${nextTier.discountPct}% off!`;
    hintEl.style.display = "block";
  } else {
    hintEl.style.display = "none";
  }
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

function resetSettingsToDefaults() {
  showModal({
    title: "Reset Settings",
    body: "Are you sure you want to reset all settings to their defaults? This cannot be undone.",
    type: "danger",
    confirmText: "Reset Defaults",
    onConfirm: async () => {
      await window.appDb.clear();
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
      state.pricing = JSON.parse(JSON.stringify(PRICING_DEFAULTS));
      state.pricingStandard = JSON.parse(JSON.stringify(PRICING_DEFAULTS));
      state.pricingKMode = JSON.parse(JSON.stringify(KAKILALA_PRICING_DEFAULTS));
      state.discountTiers = JSON.parse(JSON.stringify(DISCOUNT_TIERS_DEFAULT));
      applyLoadedSettingsToUI();
      renderDiscountTiers();
      closeDrawer();
      showToast("Settings reset to defaults", "info");
    },
  });
}

function loadSettingsIntoDrawer() {
  const s = state.shopInfo;
  el("s-shop-name").value = s.name;
  el("s-shop-address").value = s.address;
  el("s-shop-phone").value = s.phone;
  el("s-shop-email").value = s.email;
  el("s-payment-terms").value = s.paymentTerms;

  el("tax-rate").value = state.settings.taxRate;
  el("default-copies").value = state.settings.defaultCopies;
  el("tax-enabled").checked = state.settings.isTaxEnabled;
  el("round-up").checked = state.settings.shouldRoundUp;
  el("vat-show-invoice").checked = state.settings.isVatVisibleOnInvoice;

  el("sheets-per-ream").value = state.revenueConfig.sheetsPerReam;
  el("ream-price-long").value = state.revenueConfig.reamPriceLong;
  el("ream-price-short").value = state.revenueConfig.reamPriceShort;
  el("ream-price-a4").value = state.revenueConfig.reamPriceA4;
  el("ink-cost-bottle").value = state.revenueConfig.inkCostBottle;
  el("ink-pages-yield").value = state.revenueConfig.inkPagesYield;
  el("elec-kwh-rate").value = state.revenueConfig.elecKwhRate;
  el("printer-wattage").value = state.revenueConfig.printerWattage;

  applyPricingMatrixToUI();
  renderDiscountTiers();
}

function saveSettingsFromDrawer() {
  state.shopInfo = {
    name: el("s-shop-name").value.trim() || "",
    address: el("s-shop-address").value.trim(),
    phone: el("s-shop-phone").value.trim(),
    email: el("s-shop-email").value.trim(),
    paymentTerms: el("s-payment-terms").value.trim() || "Due on receipt",
  };

  state.settings.taxRate = parseFloat(el("tax-rate").value) || TAX_RATE_DEFAULT;
  state.settings.defaultCopies = parseInt(el("default-copies").value) || DEFAULT_COPIES;
  state.settings.isTaxEnabled = el("tax-enabled").checked;
  state.settings.shouldRoundUp = el("round-up").checked;
  state.settings.isVatVisibleOnInvoice = el("vat-show-invoice").checked;

  state.revenueConfig = {
    sheetsPerReam: parseInt(el("sheets-per-ream").value) || 500,
    reamPriceLong: parseFloat(el("ream-price-long").value) || 0,
    reamPriceShort: parseFloat(el("ream-price-short").value) || 0,
    reamPriceA4: parseFloat(el("ream-price-a4").value) || 0,
    inkCostBottle: parseFloat(el("ink-cost-bottle").value) || 0,
    inkPagesYield: parseInt(el("ink-pages-yield").value) || 1,
    elecKwhRate: parseFloat(el("elec-kwh-rate").value) || 0,
    printerWattage: parseFloat(el("printer-wattage").value) || 0,
  };

  el("tax-rate-sub").textContent = `${state.settings.taxRate}%`;

  syncPricingMatrixToState();
  persistSettingsToStorage();
  updateTotals();
  updateInvoicePreview();
  closeDrawer();
  showToast("Settings saved", "success");
}

function applyLoadedSettingsToUI() {
  el("default-copies").value = state.settings.defaultCopies;
  el("tax-rate").value = state.settings.taxRate;
  el("tax-enabled").checked = state.settings.isTaxEnabled;
  el("round-up").checked = state.settings.shouldRoundUp;
  el("vat-show-invoice").checked = state.settings.isVatVisibleOnInvoice;
  el("header-kmode-toggle").checked = state.settings.isKMode;

  el("sheets-per-ream").value = state.revenueConfig.sheetsPerReam;
  el("ream-price-long").value = state.revenueConfig.reamPriceLong;
  el("ream-price-short").value = state.revenueConfig.reamPriceShort;
  el("ream-price-a4").value = state.revenueConfig.reamPriceA4;
  el("ink-cost-bottle").value = state.revenueConfig.inkCostBottle;
  el("ink-pages-yield").value = state.revenueConfig.inkPagesYield;
  el("elec-kwh-rate").value = state.revenueConfig.elecKwhRate;
  el("printer-wattage").value = state.revenueConfig.printerWattage;

  el("tax-rate-sub").textContent = `${state.settings.taxRate}%`;
  el("tax-rate-row").style.display = state.settings.isTaxEnabled ? "flex" : "none";
  el("vat-show-row").style.display = state.settings.isTaxEnabled ? "flex" : "none";
  applyPricingMatrixToUI();
}
