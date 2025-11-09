// core/helpers.js - extracted pure helper utilities

export function formatTitle(name) {
  let base = name.replace(/\.[^/.]+$/, "");
  return base.replace(/_/g, " ");
}

export function $(sel, root=document) { return root.querySelector(sel); }

export function h(tag, attrs={}, ...children) {
  const el = document.createElement(tag);
  Object.entries(attrs).forEach(([k,v]) => {
    if (k === "class") el.className = v;
    else if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2), v);
    else if (v !== false && v != null) el.setAttribute(k, v === true ? "" : v);
  });
  children.flat().forEach(c => {
    if (c == null) return;
    el.append(c.nodeType ? c : document.createTextNode(c));
  });
  return el;
}

export function fmtSize(bytes) {
  if (!bytes && bytes !== 0) return "";
  const u = ["B","KB","MB","GB","TB"];
  let i = 0, n = bytes;
  while (n >= 1024 && i < u.length-1) { n/=1024; i++; }
  return `${n.toFixed(1)} ${u[i]}`;
}

export function fmtDate(ms) { return new Date(ms).toLocaleString(); }

export function formatTimestamp(ts) {
  const min = Math.floor(ts / 60);
  const sec = ts % 60;
  return `${min}:${sec.toString().padStart(2, "0")}`;
}
