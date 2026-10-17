const key = "mekivo_lens_return";
const lifetime = 30 * 60 * 1000;

export function clearLensReturnDraft() {
  try { window.sessionStorage.removeItem(key); } catch { /* The form still works without storage. */ }
}

export function readLensReturnDraft(now = Date.now()): string | null {
  try {
    const raw = window.sessionStorage.getItem(key);
    if (!raw) return null;
    const value = JSON.parse(raw);
    if (!value || typeof value.name !== "string" || value.name.length > 120
      || typeof value.expiresAt !== "number" || !Number.isFinite(value.expiresAt)
      || value.expiresAt <= now || value.expiresAt > now + lifetime) {
      clearLensReturnDraft(); return null;
    }
    return value.name;
  } catch { clearLensReturnDraft(); return null; }
}

export function saveLensReturnDraft(name: string, now = Date.now()) {
  try { window.sessionStorage.setItem(key, JSON.stringify({ name: name.slice(0, 120), expiresAt: now + lifetime })); }
  catch { /* Keep the normal separate-tab flow when storage is unavailable. */ }
}
