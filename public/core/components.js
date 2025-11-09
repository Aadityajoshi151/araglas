// core/components.js - shared UI components
import { h, fmtDate, formatTitle } from '/core/helpers.js';
import { videoThumb, channelCover } from '/core/api.js';
import { state } from '/core/stores.js';

export function cardChannel(c, onClick) {
  const thumbRelPath = c.coverRelPath || (c.videos && c.videos.length ? c.videos[Math.floor(Math.random() * c.videos.length)].relPath : null);
  return h('div', { class: 'channel-card-wrap', onclick: onClick },
    h('div', { class: 'channel-card' },
      thumbRelPath
        ? h('img', { class: 'channel-thumb', src: channelCover(thumbRelPath), alt: c.name })
        : h('div', { class: 'channel-thumb', style: 'background:#222;' })
    ),
    h('div', { class: 'channel-title' }, c.name),
    h('div', { class: 'channel-sub' }, `${c.count} video${c.count !== 1 ? 's': ''}`)
  );
}

export function cardVideo(v, onPlay) {
  const isFav = state.favorites.some(f => f.relPath === v.relPath);
  const formatted = formatTitle(v.name);
  const showTitle = formatted.length > 40 ? formatted.slice(0, 37) + '...' : formatted;
  const infoLine = [ v.channel || '', v.mtime ? fmtDate(v.mtime) : '' ].filter(Boolean).join(' | ');
  function goToWatch(){ location.hash = `#/watch?relPath=${encodeURIComponent(v.relPath)}&channel=${encodeURIComponent(v.channel)}&title=${encodeURIComponent(formatTitle(v.name))}`; }
  return h('div', { class: 'card', onclick: goToWatch },
    h('div', { style: 'position:relative;' },
      h('img', { class: 'thumb lazy', 'data-src': videoThumb(v.relPath), alt: formatted }),
      h('span', { style: 'position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);border-radius:50%;padding:10px;display:flex;align-items:center;justify-content:center;pointer-events:none;' },
        h('i', { class: 'fa-solid fa-play', style: 'font-size:28px;color:var(--brand);' })
      )
    ),
    h('div', { class: 'card-body' },
      h('div', { class: 'card-title', title: formatted }, showTitle),
      h('div', { style: 'display:flex;align-items:center;gap:8px;justify-content:space-between;' },
        h('div', { class: 'card-sub' }, infoLine)
      )
    )
  );
}
