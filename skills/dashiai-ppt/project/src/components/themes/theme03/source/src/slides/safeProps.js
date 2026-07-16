export function safeArray(value, fallback = []) {
  return Array.isArray(value) ? value.filter(item => item != null) : fallback;
}

export function safeNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

export function safeInt(value, fallback = 0) {
  return Math.round(safeNumber(value, fallback));
}

export function safeText(value, fallback = "") {
  return typeof value === "number" && !Number.isFinite(value) ? fallback : value;
}
