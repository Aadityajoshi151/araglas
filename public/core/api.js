// core/api.js - extracted API + URL helper functions

export async function api(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

export function channelCover(relPath) {
  if (!relPath) return '/icons/araglas.png';
  return `/api/thumb?relPath=${encodeURIComponent(relPath)}`;
}

export function videoThumb(relPath) {
  return `/api/thumb?relPath=${encodeURIComponent(relPath)}`;
}

export function videoUrl(relPath) {
  return `/video/${relPath}`;
}
