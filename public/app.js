// Extracted helpers
import { formatTitle, $, h, fmtSize, fmtDate, formatTimestamp } from '/core/helpers.js';
import { api, channelCover, videoThumb, videoUrl } from '/core/api.js';
import { renderLayout, pagination, lazyThumbs } from '/core/ui.js';
import { state, loadFavs, loadPlaylists, createPlaylist, deletePlaylist, addVideoToPlaylist, removeVideoFromPlaylist, addFav, removeFav } from '/core/stores.js';
import { parseHashParams, listen as listenHashRouter, runRoute } from '/core/router-hash.js';
import { cardChannel, cardVideo, showPlaylistModal } from '/core/components.js';
import { renderHome } from '/pages/home.js';
import { renderPlaylists, renderPlaylistDetail } from '/pages/playlists.js';
import { renderFavorites } from '/pages/favorites.js';
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
    // Try to find video by relPath first, fallback to title if not found
    const channelVideos = await api(`/api/channels/${encodeURIComponent(channelId)}/videos?page=1&pageSize=96`);
    let video = channelVideos.data.find(v => v.relPath === relPath);
    if (!video) {
      // Try to match by title (ignoring extension and underscores)
      const formattedTitle = formatTitle(title).toLowerCase();
      video = channelVideos.data.find(v => formatTitle(v.name).toLowerCase() === formattedTitle);
    }
    if (!video) {
      return renderLayout(h("div", { class: "notice" }, `Video not found. relPath: ${relPath}, title: ${title}`));
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
    infoSection = h("div", { style: "margin-top:28px;background:rgba(0,0,0,0.04);border-radius:10px;padding:16px 18px;color:var(--text);font-size:1em;" },
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
        h("a", { href: infoJson.webpage_url, target: "_blank", style: "color:var(--brand);font-weight:600;text-decoration:none;" }, "Watch this video on Youtube")
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
    );
  }

  renderLayout(
    h("div", {
      style: "width:100%;max-width:1280px;margin:0 auto;display:flex;flex-direction:column;align-items:center;justify-content:center;"
    },
      h("video", {
        id: "main-video-player",
        src: videoUrl(video.relPath),
        controls: true,
        autoplay: true,
        style: "width:100%;max-height:70vh;background:black;border-radius:0;"
      }),
      h("div", { style: "margin-top:18px;padding:0 8px;width:100%;" },
        h("div", {
          style: "font-size:1.6em;font-weight:700;margin-bottom:8px;word-break:break-word;overflow-wrap:break-word;white-space:pre-line;max-width:100%;text-align:left;"
        }, formatTitle(video.name)),
        h("div", { style: "display:flex;align-items:center;gap:12px;margin-bottom:6px;" },
          h("img", {
            src: channelCover(channelCoverPath || video.relPath.split("/")[0]),
            style: "width:36px;height:36px;border-radius:50%;object-fit:cover;background:#222;",
            onerror: function() { this.src = '/icons/araglas.png'; }
          }),
          h("a", {
            href: `#/channel?id=${encodeURIComponent(channelId)}&name=${encodeURIComponent(channel)}`,
            style: "color:var(--brand);font-weight:700;text-decoration:none;font-size:1.08em;"
          }, channel),
          h("span", { style: "margin-left:8px;color:var(--muted);font-size:1em;" }, `|  ${fmtDate(video.mtime)}`)
        ),
        h("div", { style: "color:var(--muted);font-size:1em;margin-bottom:8px;" }, `Size: ${fmtSize(video.size)}`),
        h("div", { style: "display:flex;gap:14px;align-items:center;margin:18px 0 10px 0;flex-wrap:wrap;" },
          h("button", {
            style: "padding:10px 18px;border-radius:8px;background:var(--brand);color:var(--card);border:none;cursor:pointer;font-weight:700;font-size:1.08em;display:flex;align-items:center;gap:8px;",
            onclick: async () => {
              const player = document.getElementById("main-video-player");
              if (!player) return;
              const ts = Math.floor(player.currentTime);
              const title = prompt("Moment at "+ts+"s title:");
              if (!title) return;
              await fetch("/api/moments", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ relPath: video.relPath, timestamp: ts, title })
              });
              alert("Moment saved!");
            }
          }, h("i", { class: "fa-solid fa-hand-point-up", style: "margin-right:8px;" }), "Add Moment"),
          h("button", {
            style: "padding:10px 18px;border-radius:8px;background:var(--brand);color:var(--card);border:none;cursor:pointer;font-weight:700;font-size:1.08em;display:flex;align-items:center;gap:8px;",
            onclick: (e) => {
              e.preventDefault();
              showPlaylistModal(video);
            }
          }, h("i", { class: "fa-solid fa-list", style: "margin-right:8px;" }), "Add to Playlist"),
          h("button", {
            style: "padding:10px 18px;border-radius:8px;background:var(--brand);color:var(--card);border:none;cursor:pointer;font-weight:700;font-size:1.08em;display:flex;align-items:center;gap:8px;",
            onclick: async (e) => {
              e.preventDefault();
              await addFav({
                relPath: video.relPath,
                name: video.name,
                channel: video.channel,
                channelId: channelId,
                mtime: video.mtime,
                size: video.size
              });
              alert("Added to Favorites!");
            }
          }, h("i", { class: "fa-solid fa-heart", style: "margin-right:8px;" }), "Add to Favorites")
        ),
        infoSection
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

// Utility moved to /core/helpers.js: formatTimestamp

// --- Moments Page ---
async function renderMoments() {
  const params = parseHashParams();
  const page = Number(params.page || 1);
  const pageSize = 15;
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
              },
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
                    runRoute(routes, renderHome, (err)=>console.error(err));
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


// Toggle favorite
async function toggleFav(e, item) {
  e.preventDefault(); e.stopPropagation();
  const isFav = state.favorites.some(f => f.relPath === item.relPath);
  if (isFav) {
    await removeFav(item.relPath);
  } else {
    await addFav(item);
  }
  runRoute(routes, renderHome, (err)=>console.error(err));
}

// --- utils --- (moved to /core/helpers.js)

// API + URL helpers moved to /core/api.js

// --- layout & header ---
// layout moved to /core/ui.js

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
  const darkLink = document.getElementById("theme-dark");
  const lightLink = document.getElementById("theme-light");
  if (theme === "light") {
    if (darkLink) darkLink.disabled = true;
    if (lightLink) lightLink.disabled = false;
  } else {
    if (darkLink) darkLink.disabled = false;
    if (lightLink) lightLink.disabled = true;
  }
  window.currentTheme = theme;
}

async function toggleTheme() {
  const currentTheme = window.currentTheme || (document.getElementById("theme-light")?.disabled ? "dark" : "light");
  const newTheme = currentTheme === "dark" ? "light" : "dark";
  applyTheme(newTheme);
  await setThemeSetting(newTheme);
}

// On page load, apply theme from settings
getThemeSetting().then(applyTheme);

// Expose for navbar button
window.toggleTheme = toggleTheme;

// Add this function to trigger manual rescan
window.manualRescan = async function manualRescan() {
  try {
    const res = await fetch("/api/rescan", { method: "POST" });
    const data = await res.json();
    if (data.ok) {
      alert("Library rescan complete.");
      console.log("Manual rescan triggered.");
  runRoute(routes, renderHome, (err)=>console.error(err)); // refresh UI
    } else {
      alert("Rescan failed: " + (data.error || "Unknown error"));
    }
  } catch (err) {
    alert("Rescan failed: " + err.message);
  }
}

window.cleanupThumbs = async function cleanupThumbs() {
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

window.surpriseMe = function surpriseMe() {
  // True random: pick a random channel, then a random video from that channel
  api("/api/channels?page=1&pageSize=96").then(channelsData => {
    const channels = channelsData.data;
    if (!channels.length) return alert("No channels found.");
    const randChannel = channels[Math.floor(Math.random() * channels.length)];
    const channelId = randChannel.id;
    const channelName = randChannel.name;
    api(`/api/channels/${encodeURIComponent(channelId)}/videos?page=1&pageSize=96`).then(videosData => {
      const videos = videosData.data;
      if (!videos.length) return alert("No videos found in channel.");
      const randVideo = videos[Math.floor(Math.random() * videos.length)];
      location.hash = `#/watch?relPath=${encodeURIComponent(randVideo.relPath)}&channel=${encodeURIComponent(channelName)}&title=${encodeURIComponent(randVideo.name)}`;
    }).catch(err => alert("Failed to fetch videos: " + err.message));
  }).catch(err => alert("Failed to fetch channels: " + err.message));
};
function tab(label, active, onClick){
  return h("div", { class: `tab${active ? " active":""}`, onclick: onClick }, label);
}

// --- pages --- (renderHome now imported from /pages/home.js)


// parseHashParams moved to /core/router-hash.js

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
  h("div", { class: "notice", style: "text-align:center;font-size:1.2em;font-weight:700;margin:18px 0;" }, `Channel: ${name}`),
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

// favorites, playlists, playlist detail extracted to /pages

async function renderChannels() {
  const params = parseHashParams();
  const page = Number(params.page || 1);
  const pageSize = Number(params.pageSize || 15);
  const q = params.q || "";

  const data = await api(`/api/channels?page=${page}&pageSize=${pageSize}&q=${encodeURIComponent(q)}`);
  const grid = h("div", { class: "grid" },
    data.data.map(c =>
      cardChannel(c, ()=> location.hash = `#/channel?id=${encodeURIComponent(c.id)}&name=${encodeURIComponent(c.name)}`)
    )
  );
  // Search bar UI (smaller, left of Channels, with clear button)
  // Use the global searchbar style and logic, but for channels
  let channelQuery = q;
  let inputRef;
  const searchBar = h("div", {
    class: "searchbar",
    style: "width:250px; margin-bottom:0; position:relative; display:flex; align-items:center;"
  },
    inputRef = h("input", {
      type: "text",
      placeholder: "Search channels…",
      value: channelQuery,
      class: "",
      oninput: (e) => { channelQuery = e.target.value; },
      onkeydown: (e) => {
        if (e.key === "Enter") {
          if (!channelQuery.trim()) {
            alert("Please enter a channel name to search.");
            return;
          }
          location.hash = `#/channels?page=1&pageSize=${pageSize}&q=${encodeURIComponent(channelQuery.trim())}`;
        }
      }
    }),
    h("button", {
      style: "position:absolute;right:6px;background:none;border:none;cursor:pointer;padding:0 8px;font-size:18px;color:var(--muted);height:100%;display:flex;align-items:center;",
      onclick: () => {
        channelQuery = "";
        inputRef.value = "";
        inputRef.focus();
        location.hash = `#/channels?page=1&pageSize=${pageSize}&q=`;
      },
      title: "Clear search"
    }, h("i", { class: "fa-solid fa-xmark" }))
  );

  renderLayout(
    h("div", {},
      h("div", { style: "display:flex;justify-content:center;align-items:center;margin-bottom:18px;" },
        searchBar
      ),
      data.data.length ? grid : h("div", { class: "notice" }, "No channels found."),
      pagination(data, (p)=>{ location.hash = `#/channels?page=${p}&pageSize=${pageSize}&q=${encodeURIComponent(q)}`; })
    )
  );
}

async function renderStats() {
  const stats = await api("/api/stats");
  renderLayout(
    h("div", {
      class: "stats-page",
      style: "display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:60vh;"
    },
      h("h2", { style: "margin-bottom:24px;" }, "Library Stats"),
      h("div", { class: "stats-list", style: "font-size:1.3em;text-align:center;" },
        h("div", { style: "margin-bottom:10px;" }, `Channels: ${stats.channels}`),
        h("div", { style: "margin-bottom:10px;" }, `Videos: ${stats.videos}`),
        h("div", {}, `Total Size: ${fmtSize(stats.totalSize)}`)
      )
    )
  );
}

// --- UI components ---
// cardChannel moved to /core/components.js


// cardVideo & showPlaylistModal moved to /core/components.js

function rowVideo(channelName, v) {
  const favKey = JSON.stringify({ relPath: v.relPath, name: v.name, channel: channelName });
  const isFav = state.favorites.has(favKey);
  const formatted = formatTitle(v.name);
  return h("div", { class: "video-row" },
    h("img", { class: "thumb lazy", "data-src": videoThumb(v.relPath), alt: formatted, onclick: ()=> {
      location.hash = `#/watch?relPath=${encodeURIComponent(v.relPath)}&channel=${encodeURIComponent(channelName)}&title=${encodeURIComponent(formatTitle(v.name))}`;
    } }),
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

// pagination moved to /core/ui.js

// --- lazy thumbnails ---
// lazyThumbs moved to /core/ui.js

// --- router hook ---
// Router bootstrap
listenHashRouter(routes, renderHome, (err)=>{
  console.error(err);
  renderLayout(h("div", { class:"notice" }, "Something went wrong."));
});

(async () => {
  await loadFavs();
  await runRoute(routes, renderHome, (err)=>{
    console.error(err);
    renderLayout(h("div", { class:"notice" }, "Something went wrong."));
  });
})();
