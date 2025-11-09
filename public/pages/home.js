// pages/home.js
import { api } from '/core/api.js';
import { h } from '/core/helpers.js';
import { renderLayout, pagination, lazyThumbs } from '/core/ui.js';
import { videoUrl } from '/core/api.js';
import { cardVideo } from '/core/components.js';
import { parseHashParams } from '/core/router-hash.js';

export async function renderHome() {
  const params = parseHashParams();
  const page = Number(params.page || 1);
  const pageSize = Number(params.pageSize || 15);
  const data = await api(`/api/search?q=&page=${page}&pageSize=${pageSize}`);
  const videos = data.data || [];
  const grid = h('div', { class: 'grid' }, videos.map(v => cardVideo(v, () => window.openPlayer(videoUrl(v.relPath), v.name, v.channel))));
  renderLayout(h('div', {}, videos.length ? grid : h('div', { class: 'notice' }, 'No videos found.'), pagination(data, (p)=>{ location.hash = `#/?page=${p}&pageSize=${pageSize}`; })));
  lazyThumbs();
}
