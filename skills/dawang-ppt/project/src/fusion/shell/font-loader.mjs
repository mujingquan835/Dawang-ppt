// Browser-side FontFace API loader for detached #portable-fonts payloads.
// Keeps <style> completely free of multi-megabyte base64 font strings so editing,
// style recalculation and HTML serialization never copy or re-parse font data.

function base64ToUint8Array(b64) {
  const binary = atob(b64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

let bootPromise = null;

export function loadPortableFonts(doc = document) {
  if (bootPromise) return bootPromise;
  bootPromise = (async () => {
    const node = doc.getElementById('portable-fonts');
    if (!node || !node.textContent.trim()) return { loaded: 0 };
    let entries;
    try {
      entries = JSON.parse(node.textContent);
    } catch {
      return { loaded: 0 };
    }
    if (!Array.isArray(entries) || !entries.length) return { loaded: 0 };

    const tasks = entries.map(async (entry) => {
      if (!entry?.family || !entry?.data) return null;
      const bytes = base64ToUint8Array(entry.data);
      const face = new FontFace(entry.family, bytes, {
        weight: String(entry.weight || '400'),
        style: entry.style || 'normal',
        display: 'block',
      });
      await face.load();
      doc.fonts.add(face);
      return face;
    });
    const settled = await Promise.allSettled(tasks);
    const loaded = settled.filter((r) => r.status === 'fulfilled' && r.value).length;
    return { loaded, total: entries.length };
  })();
  return bootPromise;
}
