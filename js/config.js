const TAX_RATE_DEFAULT = 12;
const DEFAULT_COPIES = 1;
const MAX_RECENT_INVOICES = 20;
const DOCX_BYTES_PER_PAGE = 2400;
const COPY_IMAGE_SCALE = 2;
const INVOICE_EXPORT_WIDTH_PX = 680;
const INVOICE_QR_SIZE_PX = 70;
const TOAST_DURATION_MS = 2500;

const DISCOUNT_TIERS_DEFAULT = [
  { minPages: 25, discountPct: 5 },
  { minPages: 50, discountPct: 10 },
  { minPages: 100, discountPct: 12 },
];

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
  revenueConfig: "ig_revenue_config",
  cumulativeStats: "ig_cumulative_stats",
  qrCode: "ig_qr_code",
};
