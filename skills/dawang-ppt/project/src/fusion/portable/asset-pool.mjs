// Lightweight AssetPool shared by the browser editor and Node build/export pipelines.
// Keeps heavy base64 images OUT of the live ProjectV2 state tree so undo snapshots,
// structuredClone and dirty-checking stay < 50 KB instead of copying megabytes per keystroke.

export const ASSET_PREFIX = 'portable-asset:';
export const MEDIA_KEYS = new Set(['src', 'image', 'images', 'imageSrc', 'imageUrl', 'heroImage', 'coverImage']);

function dataUrlToBlob(dataUrl) {
  const comma = dataUrl.indexOf(',');
  if (comma < 0) return null;
  const header = dataUrl.slice(5, comma);
  const mime = header.split(';')[0] || 'application/octet-stream';
  const payload = dataUrl.slice(comma + 1);
  if (header.includes(';base64')) {
    const binary = atob(payload);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new Blob([bytes], { type: mime });
  }
  return new Blob([decodeURIComponent(payload)], { type: mime });
}

export class AssetPool {
  constructor(initialPool = {}) {
    this._byToken = new Map();
    this._byData = new Map();
    this._objectUrls = new Map();
    this._nextId = 1;
    if (initialPool && typeof initialPool === 'object') {
      for (const [token, dataUrl] of Object.entries(initialPool)) {
        if (typeof dataUrl !== 'string') continue;
        this._byToken.set(token, dataUrl);
        this._byData.set(dataUrl, token);
        const match = /^portable-asset:(\d+)$/.exec(token);
        if (match) this._nextId = Math.max(this._nextId, Number(match[1]) + 1);
      }
    }
  }

  has(token) {
    return this._byToken.has(token);
  }

  get size() {
    return this._byToken.size;
  }

  // Register a data: URL and return its short token ('portable-asset:N').
  // Non-data URLs are returned as-is.
  register(value) {
    if (typeof value !== 'string' || !value.startsWith('data:')) return value;
    const existing = this._byData.get(value);
    if (existing) return existing;
    const token = ASSET_PREFIX + this._nextId++;
    this._byToken.set(token, value);
    this._byData.set(value, token);
    return token;
  }

  // Resolve a token back to its raw data: URL (for PPTX export or portable serialization).
  resolveDataUrl(value) {
    if (typeof value !== 'string') return value;
    if (value.startsWith(ASSET_PREFIX)) return this._byToken.get(value) || value;
    return value;
  }

  // Resolve a token to a fast, cached Blob ObjectURL for live browser DOM rendering.
  // Falls back to raw value in Node or if Blob/URL is unavailable.
  resolveRenderUrl(value) {
    if (typeof value !== 'string') return value;
    let token = value;
    if (value.startsWith('data:')) token = this.register(value);
    if (!token.startsWith(ASSET_PREFIX)) return token;
    if (this._objectUrls.has(token)) return this._objectUrls.get(token);
    const dataUrl = this._byToken.get(token);
    if (!dataUrl) return value;
    if (typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function' || typeof Blob === 'undefined') {
      return dataUrl;
    }
    try {
      const blob = dataUrlToBlob(dataUrl);
      if (!blob) return dataUrl;
      const url = URL.createObjectURL(blob);
      this._objectUrls.set(token, url);
      return url;
    } catch {
      return dataUrl;
    }
  }

  // Replace any raw data: URLs in a project tree with short tokens stored in this pool.
  tokenizeProject(project) {
    const walk = (value, key = '') => {
      if (Array.isArray(value)) return value.map((v) => walk(v, key));
      if (value && typeof value === 'object') {
        const out = {};
        for (const [k, v] of Object.entries(value)) out[k] = walk(v, k);
        return out;
      }
      if (typeof value === 'string' && MEDIA_KEYS.has(key) && value.startsWith('data:')) {
        return this.register(value);
      }
      return value;
    };
    return walk(project);
  }

  toObject() {
    return Object.fromEntries(this._byToken.entries());
  }

  revokeAll() {
    if (typeof URL !== 'undefined' && typeof URL.revokeObjectURL === 'function') {
      for (const url of this._objectUrls.values()) URL.revokeObjectURL(url);
    }
    this._objectUrls.clear();
  }
}
