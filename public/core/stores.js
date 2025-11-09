// core/stores.js - favorites, playlists, and shared UI state
import { api } from '/core/api.js';

// Shared UI/application state (kept minimal; extended at runtime as before)
export const state = {
  query: "",
  page: 1,
  pageSize: 8,
  currentChannelId: null,
  favorites: [],
  playlists: [],
  currentPlaylistId: null,
  // Pagination state for playlists (initialized lazily as before)
  playlistsPage: 1,
  playlistsPageSize: 15,
  playlistsTotal: 0,
  playlistsTotalPages: 1
};

// Favorites
export async function loadFavs() {
  try {
    const favs = await api("/api/favorites");
    state.favorites = favs;
  } catch {
    state.favorites = [];
  }
}

export async function addFav(item) {
  await fetch("/api/favorites", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(item)
  });
  await loadFavs();
}

export async function removeFav(relPath) {
  await fetch("/api/favorites", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ relPath })
  });
  await loadFavs();
}

// Playlists
export async function loadPlaylists() {
  try {
    const params = state.playlistsPage ? `?page=${state.playlistsPage}&pageSize=${state.playlistsPageSize}` : '';
    const resp = await api(`/api/playlists${params}`);
    state.playlists = resp.data || [];
    state.playlistsTotal = resp.total || 0;
    state.playlistsPage = resp.page || 1;
    state.playlistsPageSize = resp.pageSize || 15;
    state.playlistsTotalPages = resp.totalPages || 1;
  } catch {
    state.playlists = [];
    state.playlistsTotal = 0;
    state.playlistsPage = 1;
    state.playlistsPageSize = 15;
    state.playlistsTotalPages = 1;
  }
}

export async function createPlaylist(name) {
  await fetch("/api/playlists", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name })
  });
  await loadPlaylists();
}

export async function deletePlaylist(id) {
  await fetch(`/api/playlists/${encodeURIComponent(id)}`, { method: "DELETE" });
  await loadPlaylists();
}

export async function addVideoToPlaylist(playlistId, video) {
  await fetch(`/api/playlists/${encodeURIComponent(playlistId)}/add`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(video)
  });
}

export async function removeVideoFromPlaylist(playlistId, relPath) {
  await fetch(`/api/playlists/${encodeURIComponent(playlistId)}/remove`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ relPath })
  });
}
