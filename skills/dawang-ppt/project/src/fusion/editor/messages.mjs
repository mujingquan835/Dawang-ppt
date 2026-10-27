// User-facing wording for editor conflicts and server issues; raw JSON never reaches the page.
const CONFLICTS = {
  'missing-slide': '找不到这一页，可能已被删除；请刷新后重试。',
  'missing-element': '找不到所选对象，可能已被删除；请重新选择。',
  'use-original-template-controls': '这一页来自原样模板，请使用侧栏中的模板控件修改。',
  'override-orphan': '这次结构修改会移除已手工调整过的元素，未应用；请先确认取舍。',
  'rich-text-reset-required': '这段文字含句内样式，整段替换会清除样式；请在侧栏逐段修改，或点“转为纯文本”。',
  'layout': '排版计算失败，修改未应用。',
  'export-in-progress': '正在导出，请等导出完成后再修改。',
  'operation-in-progress': '上一个操作还在进行，请稍候再试。',
  'save-in-progress': '正在保存，请稍候再试。',
  'revision': '文件已在别处更新，当前修改已保留为草稿；请刷新后对照处理。',
  'no-history': '没有可撤销的操作。',
  'no-redo': '没有可重做的操作。',
  'invalid-command': '修改内容无效，未应用。',
  'missing-image': '有图片无法加载，请检查或替换后再导出。',
  'image-not-ready': '图片仍在加载，请稍候再导出。',
  'font-unavailable': '本机缺少所用字体，请安装或换用其他字体后再导出。',
  'fonts-loading': '字体仍在加载，请稍候再导出。',
  'layout-not-ready': '页面排版尚未完成，请稍候再导出。',
  'navigation-not-ready': '页面仍在切换，请稍候再导出。',
  'readiness-timeout': '页面准备超时，请稍候重试。'
};
const ISSUES = {
  'Revision mismatch': CONFLICTS.revision,
  'Operation in progress': CONFLICTS['operation-in-progress'],
  'Origin mismatch': '请求来源不符，请从预览服务打开的页面保存。',
  'Unknown operation': '预览服务不支持该操作，请更新后重试。'
};

export function describeConflict(item) {
  if (typeof item === 'string') return ISSUES[item] || item;
  if (!item || typeof item !== 'object') return String(item ?? '');
  const text = CONFLICTS[item.kind];
  if (text && item.kind === 'layout' && item.message) return text + '（' + item.message + '）';
  if (text && item.kind === 'font-unavailable' && item.family) return text + '（' + item.family + '）';
  return text || item.message || '未知原因（' + (item.kind || 'unknown') + '）';
}

export function describeConflicts(list) {
  const items = Array.isArray(list) ? list : list == null ? [] : [list];
  const texts = [...new Set(items.map(describeConflict).filter(Boolean))];
  return texts.length ? texts.join(' ') : '未知原因。';
}
