// pages/channel.js
import { h, fmtDate, fmtSize, formatTitle } from '/core/helpers.js';
import { api, videoUrl } from '/core/api.js';
import { renderLayout, pagination, lazyThumbs } from '/core/ui.js';
import { cardVideo } from '/core/components.js';
import { getQueryParams } from '/pages/_shared.js';
import { state } from '/core/stores.js';

export async function renderChannel() {
  const params = getQueryParams();
  const id = params.id;
  const name = params.name || id;
  const page = Number(params.page || 1);
  const pageSize = Number(params.pageSize || 12);
  const q = params.q || '';
  state.currentChannelId = id;
  const data = await api(`/api/channels/${encodeURIComponent(id)}/videos?page=${page}&pageSize=${pageSize}&q=${encodeURIComponent(q)}`);
  const grid = h('div', { class: 'grid' }, data.data.map(v => cardVideo({ ...v, channel: name })));
  renderLayout(
    h('div', {},
      h('div', { class: 'notice', style: 'text-align:center;font-size:1.2em;font-weight:700;margin:18px 0;' }, `Channel: ${name}`),
      data.data.length ? grid : h('div', { class: 'notice' }, 'No videos here.'),
  pagination(data, (p) => { location.href = `/channel/?id=${encodeURIComponent(id)}&name=${encodeURIComponent(name)}&q=${encodeURIComponent(q)}&page=${p}&pageSize=${pageSize}`; })
    )
  );
  lazyThumbs();
}
