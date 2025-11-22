// pages/channels.js
import { h } from '/core/helpers.js';
import { api } from '/core/api.js';
import { renderLayout, pagination } from '/core/ui.js';
import { cardChannel } from '/core/components.js';
import { getQueryParams } from '/pages/_shared.js';

export async function renderChannels() {
  const params = getQueryParams();
  const page = Number(params.page || 1);
  const pageSize = Number(params.pageSize || 15);
  const q = params.q || '';
  const data = await api(`/api/channels?page=${page}&pageSize=${pageSize}&q=${encodeURIComponent(q)}`);
  const grid = h('div', { class: 'grid' }, data.data.map(c => cardChannel(c, ()=> location.href = `/channel/?id=${encodeURIComponent(c.id)}&name=${encodeURIComponent(c.name)}`)));
  let channelQuery = q;
  let inputRef;
  const searchBar = h('div', { class: 'searchbar', style: 'width:250px; margin-bottom:0; position:relative; display:flex; align-items:center;' },
    inputRef = h('input', { type: 'text', placeholder: 'Search channels…', value: channelQuery, class: '', oninput: (e)=>{ channelQuery = e.target.value; }, onkeydown: (e)=>{ if (e.key === 'Enter') { if (!channelQuery.trim()) { alert('Please enter a channel name to search.'); return; } location.href = `/channels/?page=1&pageSize=${pageSize}&q=${encodeURIComponent(channelQuery.trim())}`; } } }),
    h('button', { style: 'position:absolute;right:6px;background:none;border:none;cursor:pointer;padding:0 8px;font-size:18px;color:var(--muted);height:100%;display:flex;align-items:center;', onclick: ()=>{ channelQuery = ''; inputRef.value = ''; inputRef.focus(); location.href = `/channels/?page=1&pageSize=${pageSize}&q=`; }, title: 'Clear search' }, h('i', { class: 'fa-solid fa-xmark' }))
  );
  renderLayout(
    h('div', {},
      h('div', { style: 'display:flex;justify-content:center;align-items:center;margin-bottom:18px;' }, searchBar),
      data.data.length ? grid : h('div', { class: 'notice' }, 'No channels found.'),
      pagination(data, (p)=>{ location.href = `/channels/?page=${p}&pageSize=${pageSize}&q=${encodeURIComponent(q)}`; })
    )
  );
}
