// JAD-214:纯装饰槽位的契约层标记(数据描述符,参照 per-theme overrides 机制)。
// 这里只声明"哪些 defaultProps 键是纯装饰、不该被 Agent 当文案填写";
// 由 scripts/skill-workflow-utils.mjs 的 inspect 契约层消费,不改主题组件视觉。
//
// 收编范围保守:只标已确认的纯装饰位。
// - theme09_page007 封面右下角手写花字 signature('AInsight'):
//   与 JAD-196(closing 已在组件层处理)一致,这里补封面契约标记,避免被当文案填写。
// - theme09_page111(结语/closing)同一枚手写花字 signature('AInsight')。
export const DECORATIVE_SLOTS = {
  theme09_page007: ['signature'],
  theme09_page111: ['signature'],
};

export function getDecorativeKeys(layout) {
  return DECORATIVE_SLOTS[layout] || [];
}
