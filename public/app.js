// --- tiny router (hash-based) ---
const routes = {
  "": renderHome,
  "#/": renderHome,
  "#/channels": renderChannels,
  "#/channel": renderChannel,
  "#/search": renderSearch,
  "#/favorites": renderFavorites,
  "#/stats": renderStats // <-- Add this
};

const state = {
  query: "",
  page: 1,
  pageSize: 8,
  currentChannelId: null,
  favorites: [] // now an array
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
function $(sel, root=document){ return root.querySelector(sel); }
function h(tag, attrs={}, ...children){
  const el = document.createElement(tag);
  Object.entries(attrs).forEach(([k,v])=>{
    if (k === "class") el.className = v;
    else if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2), v);
    else if (v !== false && v != null) el.setAttribute(k, v === true ? "" : v);
  });
  children.flat().forEach(c => el.append(c.nodeType ? c : document.createTextNode(c)));
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
      h("div", { class: "searchbar" },
        h("input", {
          placeholder: "Search videos…",
          value: state.query,
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
        })
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
          h("i", { class: "fa-solid fa-chart-column", style: "margin-right:6px;font-size:15px;vertical-align:-2px;" }),
          "Stats"
        ], location.hash.startsWith("#/stats"), () => location.hash = "#/stats")
      ),
      h("div", { style: "flex:1" }), // spacer to push buttons to end
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
      }, h("i", { class: "fa-solid fa-arrows-rotate", style: "font-size:16px;" }))
    ),
    content
  );
  app.append(container);
  ensurePlayer();
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
  const showTitle = v.name.length > 25 ? v.name.slice(0, 22) + "..." : v.name;

  // Info line: channel | date
  const infoLine = [
    v.channel || "",
    v.mtime ? fmtDate(v.mtime) : ""
  ].filter(Boolean).join(" | ");

  return h("div", { class: "card" },
    h("img", {
      class: "thumb lazy",
      "data-src": videoThumb(v.relPath),
      alt: v.name,
      onclick: onPlay
    }),
    h("div", { class: "card-body" },
      h("div", { class: "card-title", title: v.name }, showTitle),
      h("div", { class: "card-sub" }, infoLine),
      h("div", { class: "card-size" }, v.size ? fmtSize(v.size) : ""),
      h("button", {
        class: `icon-btn fav-btn`,
        onclick: (e) => toggleFav(e, v),
        title: isFav ? "Unfavorite" : "Favorite"
      },
        h("i", {
          class: isFav ? "fa-solid fa-heart" : "fa-regular fa-heart",
          style: `color:${isFav ? "red" : "var(--muted)"};font-size:18px;vertical-align:-2px;`
        })
      )
    )
  );
}

function rowVideo(channelName, v) {
  const favKey = JSON.stringify({ relPath: v.relPath, name: v.name, channel: channelName });
  const isFav = state.favorites.has(favKey);
  return h("div", { class: "video-row" },
    h("img", { class: "thumb lazy", "data-src": videoThumb(v.relPath), alt: v.name, onclick: ()=> openPlayer(videoUrl(v.relPath), v.name, channelName) }),
    h("div", {},
      h("div", { class: "video-title" }, v.name),
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
    )
  );
}
function openPlayer(src, title, channel){
  const el = $("#player");
  $("#player-video").src = src;
  $("#player-title").textContent = (channel ? channel + " • " : "") + title;
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
