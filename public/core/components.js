// core/components.js - shared UI components
import { h, fmtDate, formatTitle } from '/core/helpers.js';
import { videoThumb, channelCover, api } from '/core/api.js';
import { state, createPlaylist, addVideoToPlaylist, addFav, removeFav, removeVideoFromPlaylist } from '/core/stores.js';

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

export function cardVideo(v) {
  const isFav = state.favorites.some(f => f.relPath === v.relPath);
  const formatted = formatTitle(v.name);
  const showTitle = formatted.length > 40 ? formatted.slice(0, 37) + '...' : formatted;
  const infoLine = [ v.channel || '', v.mtime ? fmtDate(v.mtime) : '' ].filter(Boolean).join(' | ');
  function goToWatch(){ location.hash = `#/watch?relPath=${encodeURIComponent(v.relPath)}&channel=${encodeURIComponent(v.channel)}&title=${encodeURIComponent(formatTitle(v.name))}`; }
  function refreshRoute(){ window.dispatchEvent(new Event('hashchange')); }
  function showDropdown(e){
    e.stopPropagation();
    const old = document.getElementById('video-dropdown');
    if (old) { old.remove(); return; }
    const rect = e.currentTarget.getBoundingClientRect();
    const menuWidth = 220;
    let left = rect.left;
    if (left + menuWidth > window.innerWidth - 8) left = window.innerWidth - menuWidth - 8;
    if (left < 8) left = 8;
    const favNow = state.favorites.some(f => f.relPath === v.relPath);
    const menu = h('div', { id: 'video-dropdown', style: `position:fixed;z-index:1000;top:${rect.bottom+6}px;left:${left}px;background:var(--card);color:var(--text);border-radius:10px;box-shadow:0 2px 16px rgba(0,0,0,0.18);padding:8px 0;min-width:${menuWidth}px;max-width:calc(100vw - 16px);` },
      h('button', { class: 'dropdown-item', style: 'width:100%;text-align:left;padding:10px 18px;background:none;border:none;cursor:pointer;display:flex;align-items:center;gap:12px;', onclick: async (ev)=>{ ev.stopPropagation(); if (favNow) await removeFav(v.relPath); else await addFav(v); menu.remove(); refreshRoute(); } },
        favNow
          ? h('i', { class: 'fa-solid fa-heart', style: 'color:#e53935;font-size:18px;' })
          : h('i', { class: 'fa-regular fa-heart', style: 'color:var(--muted);font-size:18px;' }),
        favNow ? 'Remove from Favorites' : 'Add to Favorites'
      ),
      h('button', { class: 'dropdown-item', style: 'width:100%;text-align:left;padding:10px 18px;background:none;border:none;cursor:pointer;display:flex;align-items:center;gap:12px;', onclick: (ev)=>{ ev.stopPropagation(); showPlaylistModal(v); menu.remove(); } },
        h('i', { class: 'fa-solid fa-list', style: 'color:var(--muted);font-size:18px;' }),
        'Add to Playlist'
      ),
      (state.currentPlaylistId ? h('button', { class: 'dropdown-item', style: 'width:100%;text-align:left;padding:10px 18px;background:none;border:none;cursor:pointer;display:flex;align-items:center;gap:12px;color:#d32f2f;', onclick: async (ev)=>{ ev.stopPropagation(); if (confirm('Remove this video from playlist?')) { await removeVideoFromPlaylist(state.currentPlaylistId, v.relPath); menu.remove(); refreshRoute(); } } }, h('i', { class: 'fa-solid fa-xmark', style: 'color:#d32f2f;font-size:18px;' }), 'Remove from Playlist') : null)
    );
    document.body.appendChild(menu);
    setTimeout(()=>{
      function handler(){ const el = document.getElementById('video-dropdown'); if (el) el.remove(); document.removeEventListener('click', handler); }
      document.addEventListener('click', handler);
    }, 10);
  }
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
        h('div', { class: 'card-sub' }, infoLine),
        h('button', { class: 'icon-btn video-menu-btn', title: 'More options', style: 'background:none;border:none;color:var(--muted);font-size:22px;cursor:pointer;padding:8px 12px;margin-left:auto;min-width:40px;min-height:40px;display:flex;align-items:center;justify-content:center;border-radius:50%;transition:background 0.15s;', onclick: (ev)=>{ ev.stopPropagation(); showDropdown(ev); } },
          h('i', { class: 'fa-solid fa-ellipsis-vertical', style: 'font-size:22px;margin:0;pointer-events:none;' })
        )
      )
    )
  );
}

// Playlist Modal component logic extracted from app.js
export function showPlaylistModal(video) {
  const existing = document.getElementById('playlist-modal');
  if (existing) existing.remove();
  let playlistPage = 1;
  let loading = false;
  let allLoaded = false;
  let playlists = [];
  const selected = new Set();

  async function loadMorePlaylists() {
    if (loading || allLoaded) return;
    loading = true;
    try {
      const resp = await api(`/api/playlists?page=${playlistPage}&pageSize=10`);
      if (Array.isArray(resp.data)) {
        playlists = playlists.concat(resp.data);
        if (playlists.length >= (resp.total || 0)) allLoaded = true;
      }
      playlistPage++;
    } finally {
      loading = false;
      render();
    }
  }

  function render() {
    const old = document.getElementById('playlist-modal');
    if (old) old.remove();
    const modal = h('div', { id: 'playlist-modal', style: 'position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,0.45);z-index:100;display:flex;align-items:center;justify-content:center;' },
      h('div', { style: 'background:var(--card);padding:28px 24px;border-radius:14px;min-width:320px;max-width:90vw;box-shadow:0 2px 24px rgba(0,0,0,0.18);position:relative;' },
        h('div', { style: 'font-weight:700;font-size:1.1em;margin-bottom:12px;' }, 'Add to Playlists'),
        h('div', { style: 'margin-bottom:14px;max-height:260px;overflow-y:auto;', onscroll: (e)=>{ const el=e.target; if (el.scrollTop + el.clientHeight >= el.scrollHeight - 24) loadMorePlaylists(); } },
          playlists.length ? playlists.map(pl =>
            h('label', { style: 'display:flex;align-items:center;gap:8px;margin-bottom:6px;' },
              h('input', { type: 'checkbox', checked: selected.has(pl.id), onchange: (e)=>{ if(e.target.checked) selected.add(pl.id); else selected.delete(pl.id); } }),
              h('span', {}, pl.name)
            )
          ) : h('div', { style: 'color:var(--muted);margin-bottom:8px;' }, loading ? 'Loading...' : 'No playlists yet.')
        ),
        h('form', { onsubmit: async (e)=>{ e.preventDefault(); const name = e.target.elements['new-playlist-name'].value.trim(); if(!name) return; await createPlaylist(name); e.target.reset(); playlistPage=1; playlists=[]; allLoaded=false; await loadMorePlaylists(); }, style: 'display:flex;gap:8px;margin-bottom:14px;' },
          h('input', { name: 'new-playlist-name', placeholder: 'Create new playlist', style: 'flex:1;padding:7px 10px;border-radius:8px;border:1px solid #222;' }),
          h('button', { type: 'submit', style: 'padding:7px 14px;border-radius:8px;background:var(--brand);color:var(--card);border:none;cursor:pointer;' }, 'Create')
        ),
        h('div', { style: 'display:flex;gap:10px;justify-content:flex-end;' },
          h('button', { style: 'padding:8px 18px;border-radius:8px;background:var(--brand);color:var(--card);border:none;cursor:pointer;font-weight:700;', onclick: async ()=>{ if(selected.size===0) return; for(const pid of selected) await addVideoToPlaylist(pid, video); document.body.removeChild(modal); alert('Added to selected playlist(s)'); } }, 'Add'),
          h('button', { style: 'padding:8px 18px;border-radius:8px;background:var(--muted);color:var(--card);border:none;cursor:pointer;', onclick: ()=> document.body.removeChild(modal) }, 'Cancel')
        ),
        h('button', { style: 'position:absolute;top:8px;right:10px;background:none;border:none;font-size:20px;color:var(--muted);cursor:pointer;', onclick: ()=> document.body.removeChild(modal), title: 'Close' }, '×')
      )
    );
    document.body.append(modal);
  }

  loadMorePlaylists();
}
