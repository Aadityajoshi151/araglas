// pages/playlists.js
import { h, fmtDate, fmtSize, formatTitle } from '/core/helpers.js';
import { parseHashParams } from '/core/router-hash.js';
import { api, videoThumb, videoUrl } from '/core/api.js';
import { renderLayout, pagination, lazyThumbs } from '/core/ui.js';
import { state, loadPlaylists, createPlaylist, deletePlaylist, removeVideoFromPlaylist } from '/core/stores.js';
import { cardVideo } from '/core/components.js';

// Playlists list page
export async function renderPlaylists() {
  state.playlistsPage = state.playlistsPage || 1;
  state.playlistsPageSize = state.playlistsPageSize || 15;
  await loadPlaylists();
  const playlists = state.playlists;
  const page = state.playlistsPage;
  const totalPages = state.playlistsTotalPages;
  const list = h('div', { style: 'max-width:500px;margin:0 auto;' },
    h('div', {},
      h('form', {
        onsubmit: async (e) => {
          e.preventDefault();
          const name = e.target.elements['playlist-name'].value.trim();
          if (!name) return alert('Enter playlist name');
          await createPlaylist(name);
          e.target.reset();
          // Refresh via hashchange
          window.dispatchEvent(new Event('hashchange'));
        },
        style: 'display:flex;gap:8px;margin-bottom:18px;'
      },
        h('input', { name: 'playlist-name', placeholder: 'New playlist name', style: 'flex:1;padding:8px 12px;border-radius:8px;border:1px solid #222;' }),
        h('button', { type: 'submit', style: 'padding:8px 16px;border-radius:8px;background:var(--brand);color:var(--card);border:none;cursor:pointer;' }, 'Create')
      ),
      playlists.length ?
        h('div', {},
          playlists.map(pl =>
            h('div', {
              style: 'display:flex;align-items:center;justify-content:space-between;padding:12px 0;border-bottom:1px solid #222;cursor:pointer;',
              onclick: () => location.hash = `#/playlist?id=${encodeURIComponent(pl.id)}`
            },
              h('div', {},
                h('span', { style: 'font-weight:700;font-size:1.1em;' }, pl.name),
                h('span', { style: 'color:var(--muted);margin-left:10px;' }, `${pl.videos.length} video${pl.videos.length !== 1 ? 's' : ''}`)
              ),
              h('button', {
                style: 'background:none;border:none;color:var(--muted);cursor:pointer;font-size:16px;',
                onclick: async (e) => {
                  e.stopPropagation();
                  if (confirm(`Delete playlist '${pl.name}'?`)) {
                    await deletePlaylist(pl.id);
                    window.dispatchEvent(new Event('hashchange'));
                  }
                }
              }, h('i', { class: 'fa-solid fa-trash' }))
            )
          ),
          h('div', { style: 'display:flex;gap:8px;justify-content:center;margin:18px 0;' },
            h('button', {
              style: `padding:6px 14px;border-radius:8px;border:none;background:${page > 1 ? 'var(--brand)' : '#444'};color:var(--card);cursor:${page > 1 ? 'pointer' : 'not-allowed'};`,
              disabled: page <= 1,
              onclick: () => { if (page > 1) { state.playlistsPage = page - 1; window.dispatchEvent(new Event('hashchange')); } }
            }, 'Previous'),
            h('span', { style: 'align-self:center;' }, `Page ${page} of ${totalPages}`),
            h('button', {
              style: `padding:6px 14px;border-radius:8px;border:none;background:${page < totalPages ? 'var(--brand)' : '#444'};color:var(--card);cursor:${page < totalPages ? 'pointer' : 'not-allowed'};`,
              disabled: page >= totalPages,
              onclick: () => { if (page < totalPages) { state.playlistsPage = page + 1; window.dispatchEvent(new Event('hashchange')); } }
            }, 'Next')
          )
        ) : h('div', { class: 'notice' }, 'No playlists yet.')
    )
  );
  renderLayout(list);
}

// Single playlist detail page
export async function renderPlaylistDetail() {
  const params = parseHashParams();
  const id = params.id;
  await loadPlaylists();
  const playlist = state.playlists.find(pl => pl.id === id);
  if (!playlist) {
    return renderLayout(h('div', { class: 'notice' }, 'Playlist not found.'));
  }
  const page = Number(params.page || 1);
  const pageSize = Number(params.pageSize || 12);
  const total = playlist.videos.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const videos = playlist.videos.slice((page - 1) * pageSize, page * pageSize);

  function playlistVideoCard(v) {
    return h('div', { class: 'card' },
      h('img', {
        class: 'thumb lazy',
        'data-src': videoThumb(v.relPath),
        alt: v.name,
        onclick: () => { location.hash = `#/watch?relPath=${encodeURIComponent(v.relPath)}&channel=${encodeURIComponent(v.channel)}&title=${encodeURIComponent(formatTitle(v.name))}`; }
      }),
      h('div', { class: 'card-body' },
        h('div', { class: 'card-title', title: v.name }, formatTitle(v.name).length > 25 ? formatTitle(v.name).slice(0, 22) + '...' : formatTitle(v.name)),
        h('div', { class: 'card-sub' }, [v.channel || '', v.mtime ? fmtDate(v.mtime) : ''].filter(Boolean).join(' | ')),
        h('div', { class: 'card-size' }, v.size ? fmtSize(v.size) : ''),
        h('div', { style: 'display:flex;gap:8px;align-items:center;' },
          h('span', {
            class: 'remove-link',
            title: 'Remove from Playlist',
            style: 'color:var(--danger);font-size:0.98em;cursor:pointer;text-decoration:underline;',
            onclick: async (e) => {
              e.preventDefault(); e.stopPropagation();
              if (confirm('Remove this video from playlist?')) {
                await removeVideoFromPlaylist(playlist.id, v.relPath);
                await loadPlaylists();
                window.dispatchEvent(new Event('hashchange'));
              }
            }
          }, 'Remove from Playlist')
        )
      )
    );
  }

  const grid = h('div', { class: 'grid' }, videos.map(v => playlistVideoCard(v)));
  renderLayout(
    h('div', {},
      h('div', { class: 'notice', style: 'text-align:center;font-size:1.2em;font-weight:700;margin:18px 0;' }, `Playlist: ${playlist.name}`),
      videos.length ? grid : h('div', { class: 'notice' }, 'No videos in this playlist.'),
      pagination({ page, totalPages }, (p) => { location.hash = `#/playlist?id=${encodeURIComponent(id)}&page=${p}&pageSize=${pageSize}`; })
    )
  );
  lazyThumbs();
}
