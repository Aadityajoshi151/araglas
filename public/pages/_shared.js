// Shared client utilities for path-based pages
import { api } from '/core/api.js';

export async function getThemeSetting() {
  try {
    const res = await fetch('/api/user-settings');
    const data = await res.json();
    return data.theme || 'dark';
  } catch { return 'dark'; }
}

export function applyTheme(theme) {
  const darkLink = document.getElementById('theme-dark');
  const lightLink = document.getElementById('theme-light');
  if (theme === 'light') {
    if (darkLink) darkLink.disabled = true;
    if (lightLink) lightLink.disabled = false;
  } else {
    if (darkLink) darkLink.disabled = false;
    if (lightLink) lightLink.disabled = true;
  }
  window.currentTheme = theme;
}

export async function applyThemeFromSettings() {
  const t = await getThemeSetting();
  applyTheme(t);
}

export function getQueryParams() {
  const params = new URLSearchParams(window.location.search || '');
  return Object.fromEntries(params.entries());
}

async function setThemeSetting(theme) {
  await fetch('/api/user-settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ theme }) });
}

export async function toggleTheme() {
  const current = window.currentTheme || (document.getElementById('theme-light')?.disabled ? 'dark' : 'light');
  const next = current === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  await setThemeSetting(next);
}

export function attachGlobals() {
  // Surprise me: pick random channel and random video
  window.surpriseMe = function surpriseMe() {
    api('/api/channels?page=1&pageSize=96').then(chs => {
      const channels = chs.data || [];
      if (!channels.length) return alert('No channels found.');
      const randChannel = channels[Math.floor(Math.random()*channels.length)];
      const channelId = randChannel.id; const channelName = randChannel.name;
      api(`/api/channels/${encodeURIComponent(channelId)}/videos?page=1&pageSize=96`).then(vs => {
        const videos = vs.data || [];
        if (!videos.length) return alert('No videos found in channel.');
        const randVideo = videos[Math.floor(Math.random()*videos.length)];
        window.location = `/watch/?relPath=${encodeURIComponent(randVideo.relPath)}&channel=${encodeURIComponent(channelName)}&title=${encodeURIComponent(randVideo.name)}`;
      }).catch(err => alert('Failed to fetch videos: ' + err.message));
    }).catch(err => alert('Failed to fetch channels: ' + err.message));
  };

  // Theme toggle
  window.toggleTheme = toggleTheme;

  // Optional admin actions (if used elsewhere)
  window.manualRescan = async function manualRescan() {
    try {
      const res = await fetch('/api/rescan', { method: 'POST' });
      const data = await res.json();
      if (data.ok) alert('Library rescan complete.'); else alert('Rescan failed: ' + (data.error || 'Unknown error'));
    } catch (err) { alert('Rescan failed: ' + err.message); }
  }
  window.cleanupThumbs = async function cleanupThumbs() {
    try {
      const res = await fetch('/api/cleanup-thumbs', { method: 'POST' });
      const data = await res.json();
      if (data.ok) alert(`Cleanup complete. Deleted ${data.deleted} thumbnails.`);
      else alert('Cleanup failed: ' + (data.error || 'Unknown error'));
    } catch (err) { alert('Cleanup failed: ' + err.message); }
  }
}
