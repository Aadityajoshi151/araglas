// pages/watch.js
import { h, fmtSize, fmtDate, formatTitle, formatTimestamp } from '/core/helpers.js';
import { api, videoUrl, channelCover } from '/core/api.js';
import { renderLayout } from '/core/ui.js';
import { getQueryParams } from '/pages/_shared.js';
import { addFav } from '/core/stores.js';
import { showPlaylistModal } from '/core/components.js';

export async function renderWatch() {
  const params = getQueryParams();
  console.debug('[renderWatch] params:', params);
  try {
  const relPath = params.relPath;
  const channel = params.channel;
  const title = params.title;
  const timestamp = params.timestamp ? Number(params.timestamp) : null;
  if (!relPath || !channel || !title) {
    return renderLayout(h('div', { class: 'notice' }, 'Invalid video info.'));
  }
  let channelId = null;
  let channelCoverPath = null;
  const channelsData = await api(`/api/channels?page=1&pageSize=96&q=${encodeURIComponent(channel)}`);
  for (const c of channelsData.data) {
    if (c.name === channel) { channelId = c.id; channelCoverPath = c.coverRelPath; }
  }
  if (!channelId) return renderLayout(h('div', { class: 'notice' }, 'Channel not found.'));
  const channelVideos = await api(`/api/channels/${encodeURIComponent(channelId)}/videos?page=1&pageSize=96`);
  let video = channelVideos.data.find(v => v.relPath === relPath) || channelVideos.data.find(v => formatTitle(v.name).toLowerCase() === formatTitle(title).toLowerCase());
  if (!video) return renderLayout(h('div', { class: 'notice' }, `Video not found. relPath: ${relPath}, title: ${title}`));

  let morePage = Number(params.morePage || 1);
  const morePageSize = 8;
  const moreVideosData = await api(`/api/channels/${encodeURIComponent(channelId)}/videos?page=${morePage}&pageSize=${morePageSize}`);
  const moreVideos = moreVideosData.data.filter(v => v.relPath !== relPath);

  let infoJson = null;
  try {
    const infoPath = `/videos/${video.relPath.replace(/\.[^/.]+$/, '')}.info.json`;
    const resp = await fetch(infoPath);
    if (resp.ok && resp.headers.get('Content-Type') && resp.headers.get('Content-Type').includes('application/json')) {
      try {
        const rawText = await resp.text();
        if (rawText.trim().length > 0 && rawText.trim()[0] === '{') infoJson = JSON.parse(rawText);
        else infoJson = null;
      } catch { infoJson = null; }
    } else infoJson = null;
  } catch { infoJson = null; }

  function humanizeNumber(n, label) {
    if (typeof n !== 'number') return '';
    let val = '';
    if (n < 1000) val = n; else if (n < 1000000) val = (n/1000).toFixed(1).replace(/\.0$/, '') + 'K'; else val = (n/1000000).toFixed(1).replace(/\.0$/, '') + 'M';
    return `${val} ${label}`;
  }
  function humanizeDate(d) {
    if (!d) return '';
    if (/^\d{8}$/.test(d)) {
      const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      const day = d.slice(6,8);
      const month = months[parseInt(d.slice(4,6),10)-1];
      const year = d.slice(0,4);
      return `${day}-${month}-${year}`;
    }
    return d;
  }

  renderLayout(
    h('div', { style: 'width:100%;max-width:1280px;margin:0 auto;display:flex;flex-direction:column;align-items:center;justify-content:center;' },
      h('video', { id: 'main-video-player', src: videoUrl(video.relPath), controls: true, autoplay: true, style: 'width:100%;max-height:70vh;background:black;border-radius:0;' }),
      h('div', { style: 'margin-top:18px;padding:0 8px;width:100%;' },
        h('div', { style: 'font-size:1.6em;font-weight:700;margin-bottom:8px;word-break:break-word;overflow-wrap:break-word;white-space:pre-line;max-width:100%;text-align:left;' }, formatTitle(video.name)),
        h('div', { style: 'display:flex;align-items:center;gap:12px;margin-bottom:6px;' },
          h('img', { src: channelCover(channelCoverPath || video.relPath.split('/')[0]), style: 'width:36px;height:36px;border-radius:50%;object-fit:cover;background:#222;', onerror: function() { this.src = '/icons/araglas.png'; } }),
          h('a', { href: `/channel/?id=${encodeURIComponent(channelId)}&name=${encodeURIComponent(channel)}`, style: 'color:var(--brand);font-weight:700;text-decoration:none;font-size:1.08em;' }, channel),
          h('span', { style: 'margin-left:8px;color:var(--muted);font-size:1em;' }, `|  ${fmtDate(video.mtime)}`)
        ),
        h('div', { style: 'color:var(--muted);font-size:1em;margin-bottom:8px;' }, `Size: ${fmtSize(video.size)}`),
        h('div', { style: 'display:flex;gap:14px;align-items:center;margin:18px 0 10px 0;flex-wrap:wrap;' },
          h('button', { style: 'padding:10px 18px;border-radius:8px;background:var(--brand);color:var(--card);border:none;cursor:pointer;font-weight:700;font-size:1.08em;display:flex;align-items:center;gap:8px;', onclick: async () => { const player = document.getElementById('main-video-player'); if (!player) return; const ts = Math.floor(player.currentTime); const title = prompt('Moment at '+ts+'s title:'); if (!title) return; await fetch('/api/moments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ relPath: video.relPath, timestamp: ts, title }) }); alert('Moment saved!'); } }, h('i', { class: 'fa-solid fa-hand-point-up', style: 'margin-right:8px;' }), 'Add Moment'),
          h('button', { style: 'padding:10px 18px;border-radius:8px;background:var(--brand);color:var(--card);border:none;cursor:pointer;font-weight:700;font-size:1.08em;display:flex;align-items:center;gap:8px;', onclick: (e) => { e.preventDefault(); showPlaylistModal(video); } }, h('i', { class: 'fa-solid fa-list', style: 'margin-right:8px;' }), 'Add to Playlist'),
          h('button', { style: 'padding:10px 18px;border-radius:8px;background:var(--brand);color:var(--card);border:none;cursor:pointer;font-weight:700;font-size:1.08em;display:flex;align-items:center;gap:8px;', onclick: async (e) => { e.preventDefault(); await addFav({ relPath: video.relPath, name: video.name, channel: video.channel, channelId: channelId, mtime: video.mtime, size: video.size }); alert('Added to Favorites!'); } }, h('i', { class: 'fa-solid fa-heart', style: 'margin-right:8px;' }), 'Add to Favorites')
        ),
        // Metadata block (conditional if infoJson)
        infoJson ? h('div', { style: 'display:flex;flex-wrap:wrap;gap:16px;margin:8px 0 24px 0;padding:12px 16px;background:var(--card);border-radius:12px;border:1px solid #222;' },
          h('div', { style: 'display:flex;flex-direction:column;min-width:120px;' },
            h('span', { style: 'font-size:0.75em;text-transform:uppercase;color:var(--muted);letter-spacing:0.5px;' }, 'Views'),
            h('span', { style: 'font-weight:700;font-size:1.05em;' }, humanizeNumber(infoJson.view_count, ''))
          ),
          infoJson.like_count ? h('div', { style: 'display:flex;flex-direction:column;min-width:120px;' },
            h('span', { style: 'font-size:0.75em;text-transform:uppercase;color:var(--muted);letter-spacing:0.5px;' }, 'Likes'),
            h('span', { style: 'font-weight:700;font-size:1.05em;' }, humanizeNumber(infoJson.like_count, ''))
          ) : null,
          infoJson.channel_follower_count ? h('div', { style: 'display:flex;flex-direction:column;min-width:140px;' },
            h('span', { style: 'font-size:0.75em;text-transform:uppercase;color:var(--muted);letter-spacing:0.5px;' }, 'Subscribers'),
            h('span', { style: 'font-weight:700;font-size:1.05em;' }, humanizeNumber(infoJson.channel_follower_count, ''))
          ) : null,
          infoJson.upload_date ? h('div', { style: 'display:flex;flex-direction:column;min-width:140px;' },
            h('span', { style: 'font-size:0.75em;text-transform:uppercase;color:var(--muted);letter-spacing:0.5px;' }, 'Uploaded'),
            h('span', { style: 'font-weight:700;font-size:1.05em;' }, humanizeDate(infoJson.upload_date))
          ) : null,
          infoJson.webpage_url ? h('div', { style: 'display:flex;flex-direction:column;min-width:160px;' },
            h('span', { style: 'font-size:0.75em;text-transform:uppercase;color:var(--muted);letter-spacing:0.5px;' }, 'YouTube'),
            h('a', { href: infoJson.webpage_url, target: '_blank', rel: 'noopener noreferrer', style: 'font-weight:700;font-size:1.05em;color:var(--brand);text-decoration:none;' }, 'Open ▶')
          ) : null,
          infoJson.duration ? h('div', { style: 'display:flex;flex-direction:column;min-width:100px;' },
            h('span', { style: 'font-size:0.75em;text-transform:uppercase;color:var(--muted);letter-spacing:0.5px;' }, 'Duration'),
            h('span', { style: 'font-weight:700;font-size:1.05em;' }, formatTimestamp(infoJson.duration))
          ) : null
        ) : null
      )
    )
  );

  if (timestamp) {
    setTimeout(() => { const player = document.getElementById('main-video-player'); if (player) player.currentTime = timestamp; }, 600);
  }
  } catch (err) {
    console.error('[renderWatch] error:', err);
    try {
      renderLayout(h('div', { class: 'notice' }, 'Failed to render watch page: ' + (err && err.message ? err.message : String(err))));
    } catch (err2) {
      // last resort: write to document
      document.body.innerHTML = '<div style="padding:24px;font-family:system-ui,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">Failed to render watch page.</div>';
    }
  }
}
