// pages/moments.js
import { h, formatTitle, formatTimestamp } from '/core/helpers.js';
import { api } from '/core/api.js';
import { renderLayout, pagination } from '/core/ui.js';
import { parseHashParams } from '/core/router-hash.js';

export async function renderMoments() {
  const params = parseHashParams();
  const page = Number(params.page || 1);
  const pageSize = 15;
  const resp = await api(`/api/moments?page=${page}&pageSize=${pageSize}`);
  const moments = resp.data;
  const totalPages = resp.totalPages;
  const byVideo = {};
  for (const m of moments) { if (!byVideo[m.relPath]) byVideo[m.relPath] = []; byVideo[m.relPath].push(m); }
  const videoKeys = Object.keys(byVideo);
  renderLayout(
    h('div', { style: 'max-width:700px;margin:0 auto;' },
      h('div', { class: 'notice', style: 'font-size:1.2em;font-weight:700;margin-bottom:18px;' }, 'Bookmarked Moments'),
      videoKeys.length === 0 ? h('div', { class: 'notice' }, 'No moments saved yet.') :
      videoKeys.map(relPath =>
        h('div', { style: 'margin-bottom:28px;background:var(--card);border-radius:12px;padding:18px 20px;' },
          h('div', { style: 'font-weight:700;font-size:1.08em;margin-bottom:10px;' }, formatTitle(relPath.split('/').pop())),
          byVideo[relPath].map(m =>
            h('div', { style: 'margin-bottom:10px;display:flex;align-items:center;gap:10px;' },
              h('button', { style: 'background:var(--brand);color:var(--card);border:none;border-radius:6px;padding:6px 12px;cursor:pointer;font-weight:700;', onclick: () => {
                const channel = relPath.split('/')[0];
                const title = formatTitle(relPath.split('/').pop());
                location.hash = `#/watch?relPath=${encodeURIComponent(relPath)}&channel=${encodeURIComponent(channel)}&title=${encodeURIComponent(title)}&timestamp=${m.timestamp}`;
              } }, `Play @ ${formatTimestamp(m.timestamp)}`),
              h('div', { style: 'font-weight:600;' }, m.title),
              h('button', { style: 'background:none;border:none;color:var(--muted);cursor:pointer;font-size:16px;', title: 'Delete moment', onclick: async () => {
                if (confirm('Delete this moment?')) {
                  await fetch('/api/moments', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ relPath, timestamp: m.timestamp }) });
                  window.dispatchEvent(new Event('hashchange'));
                }
              } }, h('i', { class: 'fa-solid fa-trash' }))
            )
          )
        )
      ),
      pagination({ page, totalPages }, (p) => { location.hash = `#/moments?page=${p}`; })
    )
  );
}
