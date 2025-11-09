// pages/stats.js
import { h, fmtSize } from '/core/helpers.js';
import { api } from '/core/api.js';
import { renderLayout } from '/core/ui.js';

export async function renderStats() {
  const stats = await api('/api/stats');
  renderLayout(
    h('div', { class: 'stats-page', style: 'display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:60vh;' },
      h('h2', { style: 'margin-bottom:24px;' }, 'Library Stats'),
      h('div', { class: 'stats-list', style: 'font-size:1.3em;text-align:center;' },
        h('div', { style: 'margin-bottom:10px;' }, `Channels: ${stats.channels}`),
        h('div', { style: 'margin-bottom:10px;' }, `Videos: ${stats.videos}`),
        h('div', {}, `Total Size: ${fmtSize(stats.totalSize)}`)
      )
    )
  );
}
