// Token bindings repaint a saved scene without choosing another layout.
const at = (object, path) => path.split('.').reduce((value, key) => value?.[key], object);
function tokenValue(style, path) {
  const fallback = { 'palette.body': style.palette.ink, 'palette.quiet': style.palette.line, 'palette.onHeader': '#ffffff', 'palette.header': style.palette.accent, 'palette.secondary': style.palette.accent, 'palette.negative': '#b42318' };
  return at(style, path) ?? fallback[path];
}
function bindElementAppearance(element, style) {
  const e = structuredClone(element), bindings = {};
  for (const [property, value] of Object.entries(e.style || {})) {
    if (['color', 'fill', 'stroke'].includes(property)) {
      const foreground = property === 'color' && String(value).toLowerCase() === '#ffffff';
      const key = foreground ? 'onHeader' : ['accent', 'secondary', 'body', 'quiet', 'muted', 'header', 'surface', 'line', 'ink', 'bg', 'negative']
        .find(key => style.palette[key] === value);
      if (key) bindings[property] = 'palette.' + key;
    }
    if (property === 'fontFamily' && value === style.typography.heading) bindings[property] = 'typography.heading';
    if (property === 'fontSize') {
      const role = e.role === 'title' ? 'title' : e.role === 'source' || e.role === 'note' ? 'note' : 'body';
      if (value === style.typography.sizes[role]) bindings[property] = 'typography.sizes.' + role;
    }
  }
  e.styleBindings = bindings;
  return e;
}
function geometryTokens(style) {
  return structuredClone({ grid: style.grid, table: style.table || {} });
}
function changeSlideAppearance(slide, before, after) {
  if (slide.styleBindingVersion !== 1) throw new Error('旧组合页缺少外观绑定，无法可靠区分手工颜色；保留现状并先确认迁移方式');
  const result = structuredClone(slide);
  for (const element of result.elements || []) {
    for (const [property, binding] of Object.entries(element.styleBindings || {})) {
      if (Object.hasOwn(element.manualStyle || {}, property)) continue;
      const value = tokenValue(after, binding);
      if (value === undefined) throw new Error('目标外观缺少 token: ' + binding);
      element.style[property] = value;
    }
  }
  for (const object of result.objects || []) object.geometryTokens ??= geometryTokens(before);
  delete result.appearance;
  result.styleId = after.id;
  return result;
}
export { bindElementAppearance, geometryTokens, changeSlideAppearance };
