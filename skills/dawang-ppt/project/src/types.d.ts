// JAD-169:核心对象的类型契约。配合 `// @ts-check` + JSDoc,把「读了对象上不存在的字段」
// 这类静默失效变成 CI typecheck 失败(见 jsconfig.json / npm run typecheck)。

/** 主题页控件(generated-metadata 里 page.controls[] 的元素)。 */
export interface ControlRecord {
  key?: string;
  prop?: string;
  type?: string;
  label?: string;
  default?: unknown;
  min?: unknown;
  max?: unknown;
  display?: string;
  options?: unknown;
  [extra: string]: unknown;
}

/** layout:query 的 compact 候选行(scoreLayout 读取的形状)。pageNumber 是排序 tiebreak,
 *  必须由 compact inspectLayout 输出提供(否则 scoreLayout 得 NaN,排序失效)。 */
export interface CompactLayoutCandidate {
  layout: string;
  theme: string;
  pageNumber: number;
  label?: string;
  slot?: string;
  roles: string[];
  mediaSlots: Array<Record<string, unknown>>;
  [extra: string]: unknown;
}

/** listLayouts 的入参。 */
export interface ListLayoutsOptions {
  theme?: string;
  role?: string;
  keyword?: string;
  needsMedia?: boolean;
  plannedImages?: unknown;
  providedImages?: unknown;
  providedMedia?: unknown;
  imageGen?: boolean;
  needsVisual?: boolean;
  mediaCount?: number | null;
  mediaKind?: string | null;
  requireInitialMedia?: boolean;
  limit?: number;
  /** 同分候选洗牌种子;缺省时每次调用随机。 */
  seed?: string | number | null;
}

/** THEME_PAGES / GENERATED_THEME_PAGES 的元素形状。注意:**没有** `spec` 字段。 */
export interface PageRecord {
  key: string;
  themeKey: string;
  pageNumber: number;
  layout: string;
  slot?: string;
  label?: string;
  bgClass?: string;
  staticHtml?: string;
  controls?: ControlRecord[];
  defaultProps?: Record<string, unknown>;
}
