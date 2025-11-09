// pages/search.js
import { h } from '/core/helpers.js';
import { api } from '/core/api.js';
import { renderLayout, pagination, lazyThumbs } from '/core/ui.js';
import { cardVideo } from '/core/components.js';
import { parseHashParams } from '/core/router-hash.js';

export async function renderSearch() {
  const params = parseHashParams();
  const q = params.q || '';
  const page = Number(params.page || 1);
  const pageSize = Number(params.pageSize || 12);
  const data = await api(`/api/search?q=${encodeURIComponent(q)}&page=${page}&pageSize=${pageSize}`);
  const grid = h('div', { class: 'grid' }, data.data.map(v => cardVideo(v)));
  renderLayout(
    h('div', {},
      h('div', { class: 'notice' }, `Search results for: "${q}"`),
      data.data.length ? grid : h('div', { class: 'notice' }, 'No videos found.'),
      pagination(data, (p) => { location.hash = `#/search?q=${encodeURIComponent(q)}&page=${p}&pageSize=${pageSize}`; })
    )
  );
  lazyThumbs();
}
