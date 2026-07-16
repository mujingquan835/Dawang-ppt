// 零依赖的数值/数组安全工具:主题组件在「数据 → 几何」派生计算处统一使用,
// 替代各组件自造的 finiteNumber/safeArray 变体。契约层只保证 authored 输入形状,
// 除法、Math.max、比例等派生值的有限性由这里兜底(见 scripts/test/test-all-theme-finite-render.mjs 门禁)。

export const safeNumber = (value, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

export const safeArray = value => (Array.isArray(value) ? value : []);

// 用作分母:非有限或 0 时退回 fallback,保证除法结果有限。
export const safeDenominator = (value, fallback = 1) => {
  const n = Number(value);
  return Number.isFinite(n) && n !== 0 ? n : fallback;
};

// 空数组 / 全非数值时返回 fallback,杜绝 Math.max(...[]) 的 -Infinity。
export const safeMax = (values, fallback = 1) => {
  let max = -Infinity;
  for (const value of safeArray(values)) {
    const n = Number(value);
    if (Number.isFinite(n) && n > max) max = n;
  }
  return max === -Infinity ? fallback : max;
};

export const safeMin = (values, fallback = 0) => {
  let min = Infinity;
  for (const value of safeArray(values)) {
    const n = Number(value);
    if (Number.isFinite(n) && n < min) min = n;
  }
  return min === Infinity ? fallback : min;
};

export const clamp = (value, min, max) => {
  const n = safeNumber(value, min);
  return Math.min(Math.max(n, min), max);
};

// num/den 的安全比例:分母为 0 或任一非有限时返回 fallback。
export const safeRatio = (num, den, fallback = 0) => {
  const n = Number(num);
  const d = Number(den);
  if (!Number.isFinite(n) || !Number.isFinite(d) || d === 0) return fallback;
  return n / d;
};

// 百分比便捷封装:safeRatio 的 ×100 版本,默认钳在 [0, 100]。
export const safePercent = (num, den, fallback = 0) => clamp(safeRatio(num, den, fallback / 100) * 100, 0, 100);
