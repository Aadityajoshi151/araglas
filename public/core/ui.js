// core/ui.js - layout & UI primitives extracted from app.js
import { h, $ } from '/core/helpers.js';

export function renderLayout(content) {
  const app = $("#app");
  if (!app) return;
  app.innerHTML = "";
  const container = h("div", { class: "container" }, content);
  app.append(container);
}

export function pagination(meta, onPage) {
  const btn = (label, p, disabled=false) =>
    h("button", { class: "pagination-btn", disabled, onclick: ()=> onPage(p) }, label);

  return h("div", { class: "pagination" },
    btn("« First", 1, meta.page === 1),
    btn("‹ Prev", Math.max(1, meta.page-1), meta.page === 1),
    h("span", { class: "cur" }, `Page ${meta.page} / ${meta.totalPages}`),
    btn("Next ›", Math.min(meta.totalPages, meta.page+1), meta.page === meta.totalPages),
    btn("Last »", meta.totalPages, meta.page === meta.totalPages)
  );
}

export function lazyThumbs() {
  const imgs = document.querySelectorAll("img.lazy");
  const io = new IntersectionObserver(entries => {
    for (const ent of entries) {
      if (ent.isIntersecting) {
        const img = ent.target;
        const src = img.getAttribute("data-src");
        if (src) {
          img.src = src;
          img.removeAttribute("data-src");
          io.unobserve(img);
        }
      }
    }
  }, { rootMargin: "300px" });
  imgs.forEach(i => io.observe(i));
}
