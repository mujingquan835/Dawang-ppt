const GENERIC = new Set(['serif', 'sans-serif', 'monospace', 'cursive', 'fantasy', 'system-ui', 'ui-serif', 'ui-sans-serif', 'ui-monospace', 'ui-rounded', 'emoji', 'math', 'fangsong', '-apple-system', 'inherit', 'initial', 'unset']);
// CSS family names containing numbers/dots must be quoted, including OPPO Sans 4.0.
function cssFontStack(value) {
  const families = String(value || 'sans-serif').match(/(?:[^,"']+|"[^"]*"|'[^']*')+/g) || [];
  return families.map(part => {
    const name = part.trim();
    if (GENERIC.has(name) || /^(["']).*\1$/.test(name)) return name;
    return JSON.stringify(name);
  }).join(', ');
}
export { cssFontStack };
