// pages/home.js
import { api } from '/core/api.js';
import { h } from '/core/helpers.js';
import { renderLayout, pagination, lazyThumbs } from '/core/ui.js';
import { cardVideo } from '/core/components.js';
import { getQueryParams } from '/pages/_shared.js';

export async function renderHome() {
  const params = getQueryParams();
  const page = Number(params.page || 1);
  const pageSize = Number(params.pageSize || 15);
  const data = await api(`/api/search?q=&page=${page}&pageSize=${pageSize}`);
  const videos = data.data || [];
  const grid = h('div', { class: 'grid' }, videos.map(v => cardVideo(v)));
  renderLayout(h('div', {}, videos.length ? grid : h('div', { class: 'notice' }, 'No videos found.'), pagination(data, (p)=>{ location.href = `?page=${p}&pageSize=${pageSize}`; })));
  lazyThumbs();
}
