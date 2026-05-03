/**
 * DOM Helpers
 */
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

/**
 * General Utilities
 */
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

function formatSize(bytes) {
  if (!bytes) return "";
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / 1048576).toFixed(1) + " MB";
}

async function readDb(key, fallback = null) {
  try {
    const val = await window.appDb.get(key);
    return val !== undefined ? val : fallback;
  } catch {
    return fallback;
  }
}

async function writeDb(key, value) {
  try {
    await window.appDb.set(key, value);
  } catch (e) {
    console.warn("DB write failed", e);
  }
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
