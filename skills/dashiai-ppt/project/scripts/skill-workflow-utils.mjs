// @ts-check
// 门面文件(纯 re-export):真正实现按域拆分到 scripts/workflow/ 下:
//   theme-registry.mjs  — 契约消费共享域(主题登记表、getLayoutRecord、count 绑定数组解析)
//   media-slots.mjs     — 媒体判定域(媒体 slot 发现/容量/可写性)
//   copy-contract.mjs   — copy 预算与角色词表域(文案密度/字符预算/可填文案叶子判定)
//   inspect-fillplan.mjs— inspect + fillPlan 域(inspectLayout/normalizeProps/数组元数据/fillPlan)
//   layout-query.mjs    — layout-query 域(listLayouts 及打分)
// 所有既有 import 路径('../scripts/skill-workflow-utils.mjs' 等)保持不变;不要在这里新增实现。
export {
  ROOT,
  THEME_PACKS,
  THEME_PAGES,
  parseArgs,
  compactJson,
  getLayoutRecord,
  getThemePackMetadata,
  layoutExists,
  isCoverCandidate,
  isCoverLikeLayout,
} from './workflow/theme-registry.mjs';

export {
  getMediaSlotsForLayout,
  mediaSlotsCanFit,
  mediaSlotCapacity,
  getPreferredMediaSlot,
  typedMediaItemForSource,
  isDeckLocalMediaSource,
} from './workflow/media-slots.mjs';

export {
  getCopyBudgetsForLayout,
  copyBudget,
  inferCopyDensity,
} from './workflow/copy-contract.mjs';

export {
  NEUTRAL_PLACEHOLDERS,
  ROLE_KEYWORDS,
  inspectLayout,
  normalizeProps,
  unknownPropKeys,
  getAllowedPropKeys,
} from './workflow/inspect-fillplan.mjs';

export {
  listLayouts,
  scoreLayout,
} from './workflow/layout-query.mjs';
