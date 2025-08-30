// --- tiny router (hash-based) ---
const routes = {
  "": renderHome,
  "#/": renderHome,
  "#/channels": renderChannels,
  "#/channel": renderChannel,
  "#/search": renderSearch,
  "#/favorites": renderFavorites,
  "#/stats": renderStats,
  "#/playlists": renderPlaylists,
  "#/playlist": renderPlaylistDetail,
  "#/watch": renderWatch,
  "#/moments": renderMoments
};

// --- Watch Page ---
async function renderWatch() {
  const params = parseHashParams();
  const relPath = params.relPath;
  const channel = params.channel;
  const title = params.title;
  const timestamp = params.timestamp ? Number(params.timestamp) : null;
  if (!relPath || !channel || !title) {
    return renderLayout(h("div", { class: "notice" }, "Invalid video info."));
  }

  // Find channel id and cover
  let channelId = null;
  let channelCoverPath = null;
  const channelsData = await api(`/api/channels?page=1&pageSize=96&q=${encodeURIComponent(channel)}`);
  for (const c of channelsData.data) {
    if (c.name === channel) {
      channelId = c.id;
      channelCoverPath = c.coverRelPath;
    }
  }
  if (!channelId) {
    return renderLayout(h("div", { class: "notice" }, "Channel not found."));
  }
  // Find video details
  const channelVideos = await api(`/api/channels/${encodeURIComponent(channelId)}/videos?page=1&pageSize=96&q=${encodeURIComponent(title)}`);
  const video = channelVideos.data.find(v => v.relPath === relPath);
  if (!video) {
    return renderLayout(h("div", { class: "notice" }, "Video not found."));
  }

  // More from channel (paginated)
  let morePage = Number(params.morePage || 1);
  const morePageSize = 8;
  const moreVideosData = await api(`/api/channels/${encodeURIComponent(channelId)}/videos?page=${morePage}&pageSize=${morePageSize}`);
  const moreVideos = moreVideosData.data.filter(v => v.relPath !== relPath);

  // Layout
  // Try to load info.json for the video
  let infoJson = null;
  try {
    const infoPath = `/videos/${video.relPath.replace(/\.[^/.]+$/, '')}.info.json`;
    const resp = await fetch(infoPath);
    if (resp.ok && resp.headers.get('Content-Type') && resp.headers.get('Content-Type').includes('application/json')) {
      try {
        const rawText = await resp.text();
        if (rawText.trim().length > 0 && rawText.trim()[0] === '{') {
          infoJson = JSON.parse(rawText);
        } else {
          infoJson = null;
        }
      } catch (err) {
        console.log('Error parsing info.json:', err);
        infoJson = null;
      }
    } else {
      infoJson = null;
    }
  } catch (err) {
    console.log('Error fetching info.json:', err);
    infoJson = null;
  }

  // Collapsible info section
  let infoSection = null;
  if (infoJson) {
    let expanded = false;
    // Helper to humanize numbers with label
    function humanizeNumber(n, label) {
      if (typeof n !== 'number') return '';
      let val = '';
      if (n < 1000) val = n;
      else if (n < 1000000) val = (n/1000).toFixed(1).replace(/\.0$/, '') + 'K';
      else val = (n/1000000).toFixed(1).replace(/\.0$/, '') + 'M';
      return `${val} ${label}`;
    }
    // Helper to format date as '15-Aug-2025'
    function humanizeDate(d) {
      if (!d) return '';
      if (/^\d{8}$/.test(d)) {
        // YYYYMMDD
        const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
        const day = d.slice(6,8);
        const month = months[parseInt(d.slice(4,6),10)-1];
        const year = d.slice(0,4);
        return `${day}-${month}-${year}`;
      }
      return d;
    }
    let descExpanded = false;
    infoSection = h("div", { style: "margin-top:28px;" },
      h("div", {
        style: "font-weight:600;font-size:1.08em;cursor:pointer;padding:10px 0;color:var(--brand);user-select:none;",
        onclick: function() {
          expanded = !expanded;
          this.nextSibling.style.display = expanded ? "block" : "none";
          this.innerText = expanded ? "Hide Details ▲" : "Show Details ▼";
        }
      }, "Show Details ▼"),
      h("div", {
        style: "display:none;background:rgba(0,0,0,0.04);border-radius:10px;padding:16px 18px;margin-top:6px;color:var(--text);font-size:1em;"
      },
        // Description (expand/collapse)
        infoJson.description ? h("div", { style: "margin-bottom:10px;" },
          h("div", {
            style: "font-weight:500;font-size:1em;cursor:pointer;color:var(--brand);user-select:none;margin-bottom:6px;",
            onclick: function() {
              descExpanded = !descExpanded;
              this.nextSibling.style.display = descExpanded ? "block" : "none";
              this.innerText = descExpanded ? "Hide Description ▲" : "Show Description ▼";
            }
          }, "Show Description ▼"),
          h("div", {
            style: "display:none;white-space:pre-line;margin-bottom:10px;"
          }, infoJson.description),
          h("hr", { style: "border:none;border-top:1px solid var(--muted);margin:10px 0 18px 0;" })
        ) : null,
        // Youtube video link
        infoJson.webpage_url ? h("div", { style: "margin-bottom:10px;display:flex;align-items:center;gap:8px;" },
          h("i", { class: "fab fa-youtube", style: "color:#ff0000;font-size:1.2em;" }),
          h("a", { href: infoJson.webpage_url, target: "_blank", style: "color:var(--brand);font-weight:600;text-decoration:none;" }, "Youtube video")
        ) : null,
        // Channel URL
        infoJson.channel_url ? h("div", { style: "margin-bottom:10px;display:flex;align-items:center;gap:8px;" },
          h("i", { class: "fab fa-youtube", style: "color:#ff0000;font-size:1.2em;" }),
          h("a", { href: infoJson.channel_url, target: "_blank", style: "color:var(--brand);font-weight:600;text-decoration:none;" }, `${infoJson.channel || 'Channel'} on Youtube`)
        ) : null,
        // View count
        typeof infoJson.view_count === 'number' ? h("div", { style: "margin-bottom:8px;display:flex;align-items:center;gap:8px;" },
          h("i", { class: "fa fa-eye", style: "color:var(--muted);font-size:1em;" }),
          humanizeNumber(infoJson.view_count, 'Views'),
          h("span", { style: "color:var(--muted);font-size:0.95em;margin-left:4px;" }, "(At the time of download)")
        ) : null,
        // Like count
        typeof infoJson.like_count === 'number' ? h("div", { style: "margin-bottom:8px;display:flex;align-items:center;gap:8px;" },
          h("i", { class: "fa fa-thumbs-up", style: "color:var(--brand);font-size:1em;" }),
          humanizeNumber(infoJson.like_count, 'Likes'),
          h("span", { style: "color:var(--muted);font-size:0.95em;margin-left:4px;" }, "(At the time of download)")
        ) : null,
        // Channel follower count
        typeof infoJson.channel_follower_count === 'number' ? h("div", { style: "margin-bottom:8px;display:flex;align-items:center;gap:8px;" },
          h("i", { class: "fa fa-users", style: "color:var(--brand-2);font-size:1em;" }),
          humanizeNumber(infoJson.channel_follower_count, 'Subscribers'),
          h("span", { style: "color:var(--muted);font-size:0.95em;margin-left:4px;" }, "(At the time of download)")
        ) : null,
        // Release date
        infoJson.release_date ? h("div", { style: "margin-bottom:8px;display:flex;align-items:center;gap:8px;" },
          h("i", { class: "fa fa-calendar-alt", style: "color:var(--muted);font-size:1em;" }),
          `Uploaded on ${humanizeDate(infoJson.release_date)}`
        ) : null
      )
    );
  }

  renderLayout(
    h("div", { style: "display:flex;justify-content:center;align-items:center;min-height:70vh;" },
      h("div", { style: "width:100%;max-width:1100px;margin:0 auto;" },
        h("div", { style: "background:var(--card);border-radius:18px;box-shadow:none;padding:40px 48px 40px 48px;margin-bottom:32px;" },
          h("video", {
            id: "main-video-player",
            src: videoUrl(video.relPath),
            controls: true,
            style: "width:100%;max-height:80vh;border-radius:14px;background:black;"
          }),
          h("div", { style: "margin-top:32px;" },
            h("div", {
              style: "font-size:2em;font-weight:700;margin-bottom:18px;word-break:break-word;overflow-wrap:break-word;white-space:pre-line;max-width:100%;"
            }, formatTitle(video.name)),
            h("div", { style: "display:flex;align-items:center;gap:16px;" },
              h("img", {
                src: channelCover(channelCoverPath || video.relPath.split("/")[0]),
                style: "width:40px;height:40px;border-radius:50%;object-fit:cover;background:#222;",
                onerror: function() { this.src = '/icons/araglas.png'; }
              }),
              h("a", {
                href: `#/channel?id=${encodeURIComponent(channelId)}&name=${encodeURIComponent(channel)}`,
                style: "color:var(--brand);font-weight:700;text-decoration:none;font-size:1.2em;"
              }, channel)
            ),
            h("div", { style: "color:var(--muted);margin-top:12px;font-size:1.1em;" },
              `Modified: ${fmtDate(video.mtime)} | Size: ${fmtSize(video.size)}`
            ),
            infoSection,
            h("button", {
              style: "margin-top:18px;padding:10px 18px;border-radius:8px;background:var(--brand);color:var(--card);border:none;cursor:pointer;font-weight:700;font-size:1.08em;",
              onclick: async () => {
                const player = document.getElementById("main-video-player");
                if (!player) return;
                const ts = Math.floor(player.currentTime);
                const title = prompt("Moment title:", "Interesting part");
                if (!title) return;
                await fetch("/api/moments", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ relPath: video.relPath, timestamp: ts, title })
                });
                alert("Moment saved!");
              }
            }, h("i", { class: "fa-solid fa-bookmark", style: "margin-right:8px;" }), "Bookmark Moment")
          )
        )
      )
    )
  );
  // If timestamp param is present, seek to that time after video loads
  if (timestamp) {
    setTimeout(() => {
      const player = document.getElementById("main-video-player");
      if (player) player.currentTime = timestamp;
    }, 600);
  }
}

// Utility: format seconds as mm:ss
function formatTimestamp(ts) {
  const min = Math.floor(ts / 60);
  const sec = ts % 60;
  return `${min}:${sec.toString().padStart(2, "0")}`;
}

// --- Moments Page ---
async function renderMoments() {
  const params = parseHashParams();
  const page = Number(params.page || 1);
  const pageSize = 20;
  const resp = await api(`/api/moments?page=${page}&pageSize=${pageSize}`);
  const moments = resp.data;
  const totalPages = resp.totalPages;
  // Group by video
  const byVideo = {};
  for (const m of moments) {
    if (!byVideo[m.relPath]) byVideo[m.relPath] = [];
    byVideo[m.relPath].push(m);
  }
  const videoKeys = Object.keys(byVideo);
  renderLayout(
    h("div", { style: "max-width:700px;margin:0 auto;" },
      h("div", { class: "notice", style: "font-size:1.2em;font-weight:700;margin-bottom:18px;" }, "Bookmarked Moments"),
      videoKeys.length === 0 ? h("div", { class: "notice" }, "No moments saved yet.") :
      videoKeys.map(relPath =>
        h("div", { style: "margin-bottom:28px;background:var(--card);border-radius:12px;padding:18px 20px;" },
          h("div", { style: "font-weight:700;font-size:1.08em;margin-bottom:10px;" }, formatTitle(relPath.split("/").pop())),
          byVideo[relPath].map(m =>
            h("div", { style: "margin-bottom:10px;display:flex;align-items:center;gap:10px;" },
              h("button", {
                style: "background:var(--brand);color:var(--card);border:none;border-radius:6px;padding:6px 12px;cursor:pointer;font-weight:700;",
                onclick: () => {
                  const channel = relPath.split("/")[0];
                  const title = formatTitle(relPath.split("/").pop());
                  location.hash = `#/watch?relPath=${encodeURIComponent(relPath)}&channel=${encodeURIComponent(channel)}&title=${encodeURIComponent(title)}&timestamp=${m.timestamp}`;
                }
              }, h("i", { class: "fa-solid fa-play", style: "margin-right:6px;" }),
                `Play @ ${formatTimestamp(m.timestamp)}`),
              h("div", { style: "font-weight:600;" }, m.title),
              h("button", {
                style: "background:none;border:none;color:var(--muted);cursor:pointer;font-size:16px;",
                title: "Delete moment",
                onclick: async () => {
                  if (confirm("Delete this moment?")) {
                    await fetch("/api/moments", {
                      method: "DELETE",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ relPath, timestamp: m.timestamp })
                    });
                    onRoute();
                  }
                }
              }, h("i", { class: "fa-solid fa-trash" }))
            )
          )
        )
      ),
      pagination({ page, totalPages }, (p) => { location.hash = `#/moments?page=${p}`; })
    )
  );
}

const state = {
  query: "",
  page: 1,
  pageSize: 8,
  currentChannelId: null,
  favorites: [],
  playlists: [],
  currentPlaylistId: null
};

// Load favorites from API
async function loadFavs() {
  try {
    const favs = await api("/api/favorites");
    state.favorites = favs;
  } catch {
    state.favorites = [];
  }
}

// --- Playlists ---
async function loadPlaylists() {
  try {
    const params = state.playlistsPage ? `?page=${state.playlistsPage}&pageSize=${state.playlistsPageSize}` : '';
    const resp = await api(`/api/playlists${params}`);
    state.playlists = resp.data || [];
    state.playlistsTotal = resp.total || 0;
    state.playlistsPage = resp.page || 1;
    state.playlistsPageSize = resp.pageSize || 20;
    state.playlistsTotalPages = resp.totalPages || 1;
  } catch {
    state.playlists = [];
    state.playlistsTotal = 0;
    state.playlistsPage = 1;
    state.playlistsPageSize = 20;
    state.playlistsTotalPages = 1;
  }
}

async function createPlaylist(name) {
  await fetch("/api/playlists", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name })
  });
  await loadPlaylists();
}

async function deletePlaylist(id) {
  await fetch(`/api/playlists/${encodeURIComponent(id)}`, {
    method: "DELETE"
  });
  await loadPlaylists();
}

async function addVideoToPlaylist(playlistId, video) {
  await fetch(`/api/playlists/${encodeURIComponent(playlistId)}/add`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(video)
  });
}

async function removeVideoFromPlaylist(playlistId, relPath) {
  await fetch(`/api/playlists/${encodeURIComponent(playlistId)}/remove`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ relPath })
  });
}

// Add favorite via API
async function addFav(item) {
  await fetch("/api/favorites", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(item)
  });
  await loadFavs();
}

// Remove favorite via API
async function removeFav(relPath) {
  await fetch("/api/favorites", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ relPath })
  });
  await loadFavs();
}

// Toggle favorite
async function toggleFav(e, item) {
  e.preventDefault(); e.stopPropagation();
  const isFav = state.favorites.some(f => f.relPath === item.relPath);
  if (isFav) {
    await removeFav(item.relPath);
  } else {
    await addFav(item);
  }
  onRoute();
}

// --- utils ---
// Format video title for display: replace underscores with spaces and remove extension
function formatTitle(name) {
  let base = name.replace(/\.[^/.]+$/, "");
  return base.replace(/_/g, " ");
}
function $(sel, root=document){ return root.querySelector(sel); }
function h(tag, attrs={}, ...children){
  const el = document.createElement(tag);
  Object.entries(attrs).forEach(([k,v])=>{
    if (k === "class") el.className = v;
    else if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2), v);
    else if (v !== false && v != null) el.setAttribute(k, v === true ? "" : v);
  });
  children.flat().forEach(c => {
    if (c == null) return;
    el.append(c.nodeType ? c : document.createTextNode(c));
  });
  return el;
}
function fmtSize(bytes){
  if (!bytes && bytes !== 0) return "";
  const u = ["B","KB","MB","GB","TB"];
  let i = 0, n = bytes;
  while (n >= 1024 && i < u.length-1) { n/=1024; i++; }
  return `${n.toFixed(1)} ${u[i]}`;
}
function fmtDate(ms){ return new Date(ms).toLocaleString(); }

async function api(url){
  const r = await fetch(url);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

function channelCover(relPath){
  return `/api/thumb?relPath=${encodeURIComponent(relPath)}`;
}
function videoThumb(relPath){
  return `/api/thumb?relPath=${encodeURIComponent(relPath)}`;
}
function videoUrl(relPath){
  // You said you're OK with the URL being the file path while playing
  return `/video/${relPath}`;
}

// --- layout & header ---
function renderLayout(content){
  const app = $("#app");
  app.innerHTML = "";
  const container = h("div", { class: "container" },
    h("div", { class: "header" },
      h("div", { class: "brand" },
        h("img", { class: "logo", src: "/icons/araglas.png", alt: "Araglas Logo" }),
        h("div", {}, "Araglas")
      ),
      h("div", { class: "searchbar", style: "display:flex;align-items:center;position:relative;" },
        h("input", {
          placeholder: "Search videos…",
          value: state.query,
          style: "flex:1;",
          oninput: (e)=> { state.query = e.target.value; },
          onkeydown: (e)=>{
            if (e.key === "Enter") {
              if (!state.query.trim()) {
                alert("Please enter a search query.");
                return;
              }
              location.hash = `#/search?q=${encodeURIComponent(state.query)}&page=1`;
            }
          }
        }),
        h("button", {
          style: "position:absolute;right:6px;background:none;border:none;cursor:pointer;padding:0 8px;font-size:18px;color:var(--muted);height:100%;display:flex;align-items:center;",
          onclick: () => {
            state.query = "";
            const input = document.querySelector('.searchbar input');
            if (input) {
              input.value = "";
              input.focus();
            }
          },
          title: "Clear search"
        }, h("i", { class: "fa-solid fa-xmark" }))
      )
    ),
    h("div", { class: "tabs-row" },
      h("div", { class: "tabs" },
        tab([
          h("i", { class: "fa-solid fa-house", style: "margin-right:6px;font-size:15px;vertical-align:-2px;" }),
          "Home"
        ], ["", "#/"].includes(location.hash), () => location.hash = "#/"),
        tab([
          h("i", { class: "fa-solid fa-layer-group", style: "margin-right:6px;font-size:15px;vertical-align:-2px;" }),
          "Channels"
        ], location.hash.startsWith("#/channels"), () => location.hash = "#/channels"),
        tab([
          h("i", { class: "fa-solid fa-heart", style: "margin-right:6px;font-size:15px;vertical-align:-2px;" }),
          "Favorites"
        ], location.hash.startsWith("#/favorites"), () => location.hash = "#/favorites"),
        tab([
          h("i", { class: "fa-solid fa-list", style: "margin-right:6px;font-size:15px;vertical-align:-2px;" }),
          "Playlists"
        ], location.hash.startsWith("#/playlists"), () => location.hash = "#/playlists"),
        tab([
          h("i", { class: "fa-solid fa-chart-column", style: "margin-right:6px;font-size:15px;vertical-align:-2px;" }),
          "Stats"
        ], location.hash.startsWith("#/stats"), () => location.hash = "#/stats"),
        tab([
          h("i", { class: "fa-solid fa-bookmark", style: "margin-right:6px;font-size:15px;vertical-align:-2px;" }),
          "Moments"
        ], location.hash.startsWith("#/moments"), () => location.hash = "#/moments")
      ),
      h("div", { style: "flex:1" }), // spacer to push buttons to end
      h("button", {
        class: "circle-btn",
        style: "margin-right:8px;",
        title: "Surprise Me",
        onclick: async () => {
          try {
            const channelsData = await api("/api/channels?page=1&pageSize=96");
            const channels = channelsData.data;
            if (!channels.length) return alert("No channels found.");
            const randChannel = channels[Math.floor(Math.random() * channels.length)];
            const channelId = randChannel.id;
            const channelName = randChannel.name;
            const videosData = await api(`/api/channels/${encodeURIComponent(channelId)}/videos?page=1&pageSize=96`);
            const videos = videosData.data;
            if (!videos.length) return alert("No videos found in channel.");
            const randVideo = videos[Math.floor(Math.random() * videos.length)];
            location.hash = `#/watch?relPath=${encodeURIComponent(randVideo.relPath)}&channel=${encodeURIComponent(channelName)}&title=${encodeURIComponent(randVideo.name)}`;
          } catch (err) {
            alert("Failed to surprise you: " + err.message);
          }
        }
      }, h("i", { class: "fa-solid fa-face-surprise", style: "font-size:16px;" })),
      h("button", {
        class: "circle-btn",
        onclick: cleanupThumbs,
        title: "Remove thumbnails for deleted videos"
      },
        h("i", { class: "fa-solid fa-broom", style: "font-size:16px;" })
      ),
      h("button", {
        class: "circle-btn",
        onclick: manualRescan,
        title: "Rescan library"
      }, h("i", { class: "fa-solid fa-arrows-rotate", style: "font-size:16px;" })),
      h("button", {
        class: "circle-btn",
        id: "theme-toggle-btn",
        title: "Toggle theme",
        onclick: toggleTheme
      }, h("i", { class: "fa-solid fa-circle-half-stroke", style: "font-size:16px;" }))
    ),
    content
  );
  app.append(container);
  ensurePlayer();
// --- Theme logic ---
async function getThemeSetting() {
  try {
    const res = await fetch("/api/user-settings");
    const data = await res.json();
    return data.theme || "dark";
  } catch {
    return "dark";
  }
}

async function setThemeSetting(theme) {
  await fetch("/api/user-settings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ theme })
  });
}

function applyTheme(theme) {
  // Remove existing theme CSS
  const oldLink = document.getElementById("theme-css-link");
  if (oldLink) oldLink.remove();
  // Add new theme CSS
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.id = "theme-css-link";
  link.href = theme === "light" ? "/app.light.css" : "/app.css";
  document.head.appendChild(link);
}

function setTheme(theme) {
  let link = document.querySelector('link[rel="stylesheet"][href^="/app"]');
  if (!link) return;
  // Add a cache-busting query string
  const ts = Date.now();
  link.href = theme === "light" ? `/app.light.css?ts=${ts}` : `/app.css?ts=${ts}`;
  window.currentTheme = theme;
}

async function toggleTheme() {
  const currentTheme = document.getElementById("theme-css-link")?.href.includes("app.light.css") ? "light" : "dark";
  const newTheme = currentTheme === "dark" ? "light" : "dark";
  applyTheme(newTheme);
  await setThemeSetting(newTheme);
}

// On page load, apply theme from settings
getThemeSetting().then(applyTheme);
}

// Add this function to trigger manual rescan
async function manualRescan() {
  try {
    const res = await fetch("/api/rescan", { method: "POST" });
    const data = await res.json();
    if (data.ok) {
      alert("Library rescan complete.");
      console.log("Manual rescan triggered.");
      onRoute(); // Optionally refresh UI
    } else {
      alert("Rescan failed: " + (data.error || "Unknown error"));
    }
  } catch (err) {
    alert("Rescan failed: " + err.message);
  }
}

async function cleanupThumbs() {
  try {
    const res = await fetch("/api/cleanup-thumbs", { method: "POST" });
    const data = await res.json();
    if (data.ok) {
      if (data.deleted === 0) {
        alert("No thumbnails to clean up.");
      } else{
        alert(`Cleanup complete. Deleted ${data.deleted} thumbnails.`);
      }
    } else {
      alert("Cleanup failed: " + (data.error || "Unknown error"));
    }
  } catch (err) {
    alert("Cleanup failed: " + err.message);
  }
}

function tab(label, active, onClick){
  return h("div", { class: `tab${active ? " active":""}`, onclick: onClick }, label);
}

// --- pages ---
async function renderHome() {
  const params = parseHashParams();
  const page = Number(params.page || 1);
  const pageSize = Number(params.pageSize || 16);

  // Fetch all videos, sorted by date (like empty search)
  const data = await api(`/api/search?q=&page=${page}&pageSize=${pageSize}`);
  const videos = data.data || []; // Defensive: fallback to empty array
  const grid = h("div", { class: "grid" },
    videos.map(v => cardVideo(v, () => openPlayer(videoUrl(v.relPath), v.name, v.channel)))
  );
  renderLayout(
    h("div", {},
      h("div", { class: "notice" }, "Latest Videos"),
      videos.length ? grid : h("div", { class: "notice" }, "No videos found."),
      pagination(data, (p)=>{ location.hash = `#/?page=${p}&pageSize=${pageSize}`; })
    )
  );
  lazyThumbs(); // <-- Add this line
}

// --- Playlists List View ---
async function renderPlaylists() {
  state.playlistsPage = state.playlistsPage || 1;
  state.playlistsPageSize = state.playlistsPageSize || 20;
  await loadPlaylists();
  const playlists = state.playlists;
  const page = state.playlistsPage;
  const totalPages = state.playlistsTotalPages;
  const list = h("div", { style: "max-width:500px;margin:0 auto;" },
    h("div", { class: "notice" }, "Your Playlists"),
    h("div", {},
      h("form", {
        onsubmit: async (e) => {
          e.preventDefault();
          const name = e.target.elements["playlist-name"].value.trim();
          if (!name) return alert("Enter playlist name");
          await createPlaylist(name);
          e.target.reset();
          onRoute();
        },
        style: "display:flex;gap:8px;margin-bottom:18px;"
      },
        h("input", { name: "playlist-name", placeholder: "New playlist name", style: "flex:1;padding:8px 12px;border-radius:8px;border:1px solid #222;" }),
        h("button", { type: "submit", style: "padding:8px 16px;border-radius:8px;background:var(--brand);color:var(--card);border:none;cursor:pointer;" }, "Create")
      ),
      playlists.length ?
        h("div", {},
          playlists.map(pl =>
            h("div", {
              style: "display:flex;align-items:center;justify-content:space-between;padding:12px 0;border-bottom:1px solid #222;cursor:pointer;",
              onclick: () => location.hash = `#/playlist?id=${encodeURIComponent(pl.id)}`
            },
              h("div", {},
                h("span", { style: "font-weight:700;font-size:1.1em;" }, pl.name),
                h("span", { style: "color:var(--muted);margin-left:10px;" }, `${pl.videos.length} video${pl.videos.length !== 1 ? "s" : ""}`)
              ),
              h("button", {
                style: "background:none;border:none;color:var(--muted);cursor:pointer;font-size:16px;",
                onclick: async (e) => {
                  e.stopPropagation();
                  if (confirm(`Delete playlist '${pl.name}'?`)) {
                    await deletePlaylist(pl.id);
                    onRoute();
                  }
                }
              }, h("i", { class: "fa-solid fa-trash" }))
            )
          ),
          h("div", { style: "display:flex;gap:8px;justify-content:center;margin:18px 0;" },
            h("button", {
              style: `padding:6px 14px;border-radius:8px;border:none;background:${page > 1 ? 'var(--brand)' : '#444'};color:var(--card);cursor:${page > 1 ? 'pointer' : 'not-allowed'};`,
              disabled: page <= 1,
              onclick: () => {
                if (page > 1) {
                  state.playlistsPage = page - 1;
                  onRoute();
                }
              }
            }, "Previous"),
            h("span", { style: "align-self:center;" }, `Page ${page} of ${totalPages}`),
            h("button", {
              style: `padding:6px 14px;border-radius:8px;border:none;background:${page < totalPages ? 'var(--brand)' : '#444'};color:var(--card);cursor:${page < totalPages ? 'pointer' : 'not-allowed'};`,
              disabled: page >= totalPages,
              onclick: () => {
                if (page < totalPages) {
                  state.playlistsPage = page + 1;
                  onRoute();
                }
              }
            }, "Next")
          )
        ) : h("div", { class: "notice" }, "No playlists yet.")
    )
  );
  renderLayout(list);
}

// --- Playlist Detail View ---
async function renderPlaylistDetail() {
  const params = parseHashParams();
  const id = params.id;
  await loadPlaylists();
  const playlist = state.playlists.find(pl => pl.id === id);
  if (!playlist) {
    return renderLayout(h("div", { class: "notice" }, "Playlist not found."));
  }
  // Pagination
  const page = Number(params.page || 1);
  const pageSize = Number(params.pageSize || 12);
  const total = playlist.videos.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const videos = playlist.videos.slice((page-1)*pageSize, page*pageSize);
  // Custom video card for playlist with remove button
  function playlistVideoCard(v) {
    return h("div", { class: "card" },
      h("img", {
        class: "thumb lazy",
        "data-src": videoThumb(v.relPath),
        alt: v.name,
        onclick: () => openPlayer(videoUrl(v.relPath), v.name, v.channel)
      }),
      h("div", { class: "card-body" },
        h("div", { class: "card-title", title: v.name }, v.name.length > 25 ? v.name.slice(0, 22) + "..." : v.name),
        h("div", { class: "card-sub" }, [v.channel || "", v.mtime ? fmtDate(v.mtime) : ""].filter(Boolean).join(" | ")),
        h("div", { class: "card-size" }, v.size ? fmtSize(v.size) : ""),
        h("div", { style: "display:flex;gap:8px;align-items:center;" },
          h("button", {
            class: "icon-btn",
            title: "Remove from Playlist",
            style: "color:var(--muted);font-size:18px;vertical-align:-2px;",
            onclick: async (e) => {
              e.preventDefault(); e.stopPropagation();
              if (confirm("Remove this video from playlist?")) {
                await removeVideoFromPlaylist(playlist.id, v.relPath);
                await loadPlaylists();
                onRoute();
              }
            }
          }, h("i", { class: "fa-solid fa-xmark" }))
        )
      )
    );
  }
  const grid = h("div", { class: "grid" },
    videos.map(v => playlistVideoCard(v))
  );
  renderLayout(
    h("div", {},
      h("div", { class: "notice" }, `Playlist: ${playlist.name}`),
      videos.length ? grid : h("div", { class: "notice" }, "No videos in this playlist."),
      pagination({ page, totalPages }, (p) => { location.hash = `#/playlist?id=${encodeURIComponent(id)}&page=${p}&pageSize=${pageSize}`; })
    )
  );
  lazyThumbs();
}

function parseHashParams() {
  const hash = location.hash.split("?")[1] || "";
  const params = new URLSearchParams(hash);
  return Object.fromEntries(params.entries());
}

async function renderChannel() {
  const params = parseHashParams();
  const id = params.id;
  const name = params.name || id;
  const page = Number(params.page || 1);
  const pageSize = Number(params.pageSize || 12);
  const q = params.q || "";

  state.currentChannelId = id;

  const data = await api(`/api/channels/${encodeURIComponent(id)}/videos?page=${page}&pageSize=${pageSize}&q=${encodeURIComponent(q)}`);
  const grid = h("div", { class: "grid" },
    data.data.map(v => cardVideo({ ...v, channel: name }, () => openPlayer(videoUrl(v.relPath), v.name, name)))
  );
  renderLayout(
    h("div", {},
      h("div", { class: "notice" }, `Channel: ${name}`),
      //searchInline(q, (val) => location.hash = `#/channel?id=${encodeURIComponent(id)}&name=${encodeURIComponent(name)}&q=${encodeURIComponent(val)}&page=1`),
      data.data.length ? grid : h("div", { class: "notice" }, "No videos here."),
      pagination(data, (p) => { location.hash = `#/channel?id=${encodeURIComponent(id)}&name=${encodeURIComponent(name)}&q=${encodeURIComponent(q)}&page=${p}&pageSize=${pageSize}`; })
    )
  );
  lazyThumbs();
}

async function renderSearch() {
  const params = parseHashParams();
  const q = params.q || "";
  const page = Number(params.page || 1);
  const pageSize = Number(params.pageSize || 12);

  const data = await api(`/api/search?q=${encodeURIComponent(q)}&page=${page}&pageSize=${pageSize}`);
  const grid = h("div", { class: "grid" },
    data.data.map(v => cardVideo(v, () => openPlayer(videoUrl(v.relPath), v.name, v.channel)))
  );
  renderLayout(
    h("div", {},
      h("div", { class: "notice" }, `Search results for: "${q}"`),
      data.data.length ? grid : h("div", { class: "notice" }, "No videos found."),
      pagination(data, (p) => { location.hash = `#/search?q=${encodeURIComponent(q)}&page=${p}&pageSize=${pageSize}`; })
    )
  );
  lazyThumbs();
}

async function renderFavorites() {
  await loadFavs();
  const favList = state.favorites;
  if (!favList.length) {
    return renderLayout(h("div", { class: "notice" }, "No favorites yet."));
  }
  const grid = h("div", { class: "grid" },
    favList.map(item => cardVideo(item, () => openPlayer(videoUrl(item.relPath), item.name, item.channel)))
  );
  renderLayout(grid);
  lazyThumbs();
}

async function renderChannels() {
  const params = parseHashParams();
  const page = Number(params.page || 1);
  const pageSize = Number(params.pageSize || 12);
  const q = params.q || "";

  const data = await api(`/api/channels?page=${page}&pageSize=${pageSize}&q=${encodeURIComponent(q)}`);
  const grid = h("div", { class: "grid" },
    data.data.map(c =>
      cardChannel(c, ()=> location.hash = `#/channel?id=${encodeURIComponent(c.id)}&name=${encodeURIComponent(c.name)}`)
    )
  );
  renderLayout(
    h("div", {},
      h("div", { class: "notice" }, "Channels"),
      data.data.length ? grid : h("div", { class: "notice" }, "No channels found."),
      pagination(data, (p)=>{ location.hash = `#/channels?page=${p}&pageSize=${pageSize}&q=${encodeURIComponent(q)}`; })
    )
  );
}

async function renderStats() {
  const stats = await api("/api/stats");
  renderLayout(
    h("div", { class: "stats-page" },
      h("h2", {}, "Library Stats"),
      h("div", { class: "stats-list" },
        h("div", {}, `Channels: ${stats.channels}`),
        h("div", {}, `Videos: ${stats.videos}`),
        h("div", {}, `Total Size: ${fmtSize(stats.totalSize)}`)
      )
    )
  );
}

// --- UI components ---
function cardChannel(c, onClick) {
  const thumbRelPath = c.coverRelPath || (c.videos && c.videos.length ? c.videos[Math.floor(Math.random() * c.videos.length)].relPath : null);
  return h("div", { class: "channel-card-wrap", onclick: onClick },
    h("div", { class: "channel-card" },
      thumbRelPath
        ? h("img", { class: "channel-thumb", src: channelCover(thumbRelPath), alt: c.name })
        : h("div", { class: "channel-thumb", style: "background:#222;" })
    ),
    h("div", { class: "channel-title" }, c.name),
    h("div", { class: "channel-sub" }, `${c.count} video${c.count !== 1 ? "s": ""}`)
  );
}


function cardVideo(v, onPlay) {
  const isFav = state.favorites.some(f => f.relPath === v.relPath);

  // Truncate title if longer than 25 chars
  const formatted = formatTitle(v.name);
  const showTitle = formatted.length > 25 ? formatted.slice(0, 22) + "..." : formatted;

  // Info line: channel | date
  const infoLine = [
    v.channel || "",
    v.mtime ? fmtDate(v.mtime) : ""
  ].filter(Boolean).join(" | ");

  // Add to Playlist button handler
  function openPlaylistModal(e) {
    e.preventDefault(); e.stopPropagation();
    showPlaylistModal(v);
  }

  // Link to /watch page
  function goToWatch() {
    location.hash = `#/watch?relPath=${encodeURIComponent(v.relPath)}&channel=${encodeURIComponent(v.channel)}&title=${encodeURIComponent(formatTitle(v.name))}`;
  }

  return h("div", { class: "card", onclick: goToWatch },
    h("div", { style: "position:relative;" },
      h("img", {
        class: "thumb lazy",
        "data-src": videoThumb(v.relPath),
        alt: formatted
      }),
      h("span", {
        style: "position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);border-radius:50%;padding:10px;display:flex;align-items:center;justify-content:center;pointer-events:none;"
      },
        h("i", { class: "fa-solid fa-play", style: "font-size:28px;color:var(--brand);" })
      )
    ),
    h("div", { class: "card-body" },
      h("div", { class: "card-title", title: formatted }, showTitle),
      h("div", { class: "card-sub" }, infoLine),
      h("div", { class: "card-size" }, v.size ? fmtSize(v.size) : ""),
      h("div", { style: "display:flex;gap:8px;align-items:center;" },
        h("button", {
          class: `icon-btn fav-btn`,
          onclick: (e) => { e.stopPropagation(); toggleFav(e, v); },
          title: isFav ? "Unfavorite" : "Favorite"
        },
          h("i", {
            class: isFav ? "fa-solid fa-heart" : "fa-regular fa-heart",
            style: `color:${isFav ? "red" : "var(--muted)"};font-size:18px;vertical-align:-2px;`
          })
        ),
        h("button", {
          class: "icon-btn",
          title: "Add to Playlist",
          onclick: (e) => { e.stopPropagation(); openPlaylistModal(e); },
          style: "margin-left:4px;"
        }, h("i", { class: "fa-solid fa-list", style: "font-size:18px;vertical-align:-2px;" }))
      )
    )
  );
}

// --- Playlist Modal ---
function showPlaylistModal(video) {
  // Remove any existing modal
  const old = $("#playlist-modal");
  if (old) old.remove();

  // Load playlists
  loadPlaylists().then(() => {
    const playlists = state.playlists;
    // Track selected playlists
    let selected = new Set();

    // Modal content
    const modal = h("div", {
      id: "playlist-modal",
      style: `position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,0.45);z-index:100;display:flex;align-items:center;justify-content:center;`
    },
      h("div", {
        style: `background:var(--card);padding:28px 24px;border-radius:14px;min-width:320px;max-width:90vw;box-shadow:0 2px 24px rgba(0,0,0,0.18);position:relative;`
      },
        h("div", { style: "font-weight:700;font-size:1.1em;margin-bottom:12px;" }, "Add to Playlists"),
        h("div", { style: "margin-bottom:14px;" },
          playlists.length ?
            playlists.map(pl =>
              h("label", { style: "display:flex;align-items:center;gap:8px;margin-bottom:6px;" },
                h("input", {
                  type: "checkbox",
                  checked: false,
                  onchange: (e) => {
                    if (e.target.checked) selected.add(pl.id);
                    else selected.delete(pl.id);
                  }
                }),
                h("span", {}, pl.name)
              )
            ) : h("div", { style: "color:var(--muted);margin-bottom:8px;" }, "No playlists yet.")
        ),
        h("form", {
          onsubmit: async (e) => {
            e.preventDefault();
            const name = e.target.elements["new-playlist-name"].value.trim();
            if (!name) return;
            await createPlaylist(name);
            e.target.reset();
            await loadPlaylists();
            // Re-render modal with new playlist
            showPlaylistModal(video);
          },
          style: "display:flex;gap:8px;margin-bottom:14px;"
        },
          h("input", { name: "new-playlist-name", placeholder: "Create new playlist", style: "flex:1;padding:7px 10px;border-radius:8px;border:1px solid #222;" }),
          h("button", { type: "submit", style: "padding:7px 14px;border-radius:8px;background:var(--brand);color:var(--card);border:none;cursor:pointer;" }, "Create")
        ),
        h("div", { style: "display:flex;gap:10px;justify-content:flex-end;" },
          h("button", {
            style: "padding:8px 18px;border-radius:8px;background:var(--brand);color:var(--card);border:none;cursor:pointer;font-weight:700;",
            onclick: async () => {
              if (selected.size === 0) return;
              for (const pid of selected) {
                await addVideoToPlaylist(pid, video);
              }
              document.body.removeChild(modal);
              alert("Added to selected playlist(s)");
            }
          }, "Add"),
          h("button", {
            style: "padding:8px 18px;border-radius:8px;background:var(--muted);color:var(--card);border:none;cursor:pointer;",
            onclick: () => document.body.removeChild(modal)
          }, "Cancel")
        ),
        h("button", {
          style: "position:absolute;top:8px;right:10px;background:none;border:none;font-size:20px;color:var(--muted);cursor:pointer;",
          onclick: () => document.body.removeChild(modal),
          title: "Close"
        }, "×")
      )
    );
    document.body.append(modal);
  });
}

function rowVideo(channelName, v) {
  const favKey = JSON.stringify({ relPath: v.relPath, name: v.name, channel: channelName });
  const isFav = state.favorites.has(favKey);
  const formatted = formatTitle(v.name);
  return h("div", { class: "video-row" },
    h("img", { class: "thumb lazy", "data-src": videoThumb(v.relPath), alt: formatted, onclick: ()=> openPlayer(videoUrl(v.relPath), formatted, channelName) }),
    h("div", {},
      h("div", { class: "video-title" }, formatted),
      h("div", { class: "video-meta" }, `${channelName} • ${fmtSize(v.size)} • ${fmtDate(v.mtime)}`),
      h("div", { class: "actions", style:"margin-top:8px" },
        h("button", { class: `icon-btn ${isFav ? "active":""}`, onclick: (e)=>toggleFav(e, favKey) }, svgStar(), isFav ? "Favorited" : "Favorite"),
      )
    ),
  );
}

// function searchInline(value, onSubmit){
//   return h("div", { class:"searchbar", style:"margin: 4px 0 14px 0" },
//     h("input", {
//       placeholder: "Filter videos…",
//       value,
//       oninput: (e)=> value = e.target.value,
//       onkeydown: (e)=> { if(e.key === "Enter") onSubmit(value); }
//     }),
//     h("div", { class:"pill", onclick: ()=> onSubmit(value) }, svgSearch(), " Search")
//   );
// }

function pagination(meta, onPage){
  const btn = (label, p, disabled=false) =>
    h("button", { disabled, onclick: ()=> onPage(p) }, label);

  return h("div", { class: "pagination" },
    btn("« First", 1, meta.page === 1),
    btn("‹ Prev", Math.max(1, meta.page-1), meta.page === 1),
    h("span", { class: "cur" }, `Page ${meta.page} / ${meta.totalPages}`),
    btn("Next ›", Math.min(meta.totalPages, meta.page+1), meta.page === meta.totalPages),
    btn("Last »", meta.totalPages, meta.page === meta.totalPages)
  );
}

// --- lazy thumbnails ---
function lazyThumbs(){
  const imgs = document.querySelectorAll("img.lazy");
  const io = new IntersectionObserver(entries=>{
    for (const ent of entries) {
      if (ent.isIntersecting) {
        const img = ent.target;
        const src = img.getAttribute("data-src");
        if (src) {
          img.src = src;
          img.removeAttribute("data-src");
          io.unobserve(img);
        }
      }
    }
  }, { rootMargin: "300px" });
  imgs.forEach(i => io.observe(i));
}

// --- player modal ---
function ensurePlayer(){
  if ($(".player")) return;
  document.body.append(
    h("div", { class: "player", id:"player" },
      h("div", { class:"player-inner" },
        h("video", { id:"player-video", controls: true }),
        h("div", { style:"display:flex; align-items:center; justify-content:space-between; padding:10px 12px" },
          h("div", { id:"player-title", style:"font-weight:700" }, ""),
          h("button", { class:"icon-btn", onclick: closePlayer }, "Close")
        )
      )
    ));
}
function openPlayer(src, title, channel){
  const el = $("#player");
  $("#player-video").src = src;
  $("#player-title").textContent = (channel ? channel + " • " : "") + formatTitle(title);
  el.classList.add("open");
}
function closePlayer(){
  const v = $("#player-video");
  v.pause();
  v.src = "";
  $("#player").classList.remove("open");
}
// --- router hook ---
function onRoute(){
  const [base] = location.hash.split("?");
  const fn = routes[base] || renderHome;
  fn().catch(err=>{
    console.error(err);
    renderLayout(h("div", { class:"notice" }, "Something went wrong."));
  });
}
window.addEventListener("hashchange", onRoute);
onRoute();
