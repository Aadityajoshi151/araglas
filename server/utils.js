import path from "node:path";
import crypto from "node:crypto";

export const VIDEO_EXTS = new Set([".mp4", ".mkv", ".webm", ".mov", ".avi", ".m4v"]);

export function isVideo(p) {
  return VIDEO_EXTS.has(path.extname(p).toLowerCase());
}

export function slugify(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function hashPath(p) {
  return crypto.createHash("md5").update(p).digest("hex");
}

export const PAGE_SIZE_DEFAULT = 8;
export const PAGE_SIZE_MAX = 96;

export function paginate(items, page = 1, pageSize = PAGE_SIZE_DEFAULT) {
  const p = Math.max(1, Number(page) || 1);
  const s = Math.min(PAGE_SIZE_MAX, Math.max(1, Number(pageSize) || PAGE_SIZE_DEFAULT));
  const total = items.length;
  const start = (p - 1) * s;
  const data = items.slice(start, start + s);
  return { page: p, pageSize: s, total, data, totalPages: Math.max(1, Math.ceil(total / s)) };
}

export function matchesQuery(str, q) {
  if (!q) return true;
  return str.toLowerCase().includes(q.toLowerCase());
}
