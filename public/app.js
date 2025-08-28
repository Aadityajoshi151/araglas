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
        h("div", { class: "logo" }),
        h("div", {}, "Local YouTube")
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
        }),
        h("div", { class: "pill", onclick: cleanupThumbs }, "Clean Thumbnails")
      )
    ),
    h("div", { class: "tabs" },
      tab("Home", ["", "#/"].includes(location.hash), () => location.hash = "#/"),
      tab("Channels", location.hash.startsWith("#/channels"), () => location.hash = "#/channels"),
      tab("Favorites", location.hash.startsWith("#/favorites"), () => location.hash = "#/favorites"),
      tab("Stats", location.hash.startsWith("#/stats"), () => location.hash = "#/stats") // <-- Add this
    ),
    content
  );
  app.append(container);
  ensurePlayer();
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
  return h("div", { class: "channel-card", onclick: onClick },
    //h("img", { class: "channel-thumb lazy", "data-src": channelCover(c.coverRelPath)}),
    h("div", { class: "channel-title" }, c.name),
    h("div", { class: "channel-sub" }, `${c.count} video${c.count !== 1 ? "s":""}`)
  );
}

function svgStarBootstrap(filled = false) {
  // Bootstrap star icon SVG
  return h("svg", {
    xmlns: "http://www.w3.org/2000/svg",
    width: 20,
    height: 20,
    fill: filled ? "gold" : "currentColor",
    class: "bi bi-star" + (filled ? "-fill" : ""),
    viewBox: "0 0 16 16"
  },
    h("path", {
      d: filled
        ? "M3.612 15.443c-.386.198-.824-.149-.746-.592l.83-4.73L.173 6.765c-.329-.32-.158-.888.283-.95l4.898-.696L7.538.792c.197-.39.73-.39.927 0l2.084 4.327 4.898.696c.441.062.612.63.282.95l-3.523 3.356.83 4.73c.078.443-.36.79-.746.592L8 13.187l-4.389 2.256z"
        : "M2.866 14.85c-.078.444.36.791.746.593l4.39-2.256 4.389 2.256c.386.198.824-.149.746-.592l-.83-4.73 3.523-3.356c.329-.32.158-.888-.283-.95l-4.898-.696L8.465.792a.513.513 0 0 0-.927 0L5.454 5.119l-4.898.696c-.441.062-.612.63-.282.95l3.523 3.356-.83 4.73zm4.905-2.767L3.612 15.443l.83-4.73-3.523-3.356 4.898-.696L7.538.792l2.084 4.327 4.898.696-3.523 3.356.83 4.73-4.389-2.256z"
    })
  );
}

function svgHeart(filled = false) {
  // Bootstrap heart icon SVG
  return h("svg", {
    xmlns: "http://www.w3.org/2000/svg",
    width: 20,
    height: 20,
    fill: filled ? "red" : "currentColor",
    class: "bi bi-heart" + (filled ? "-fill" : ""),
    viewBox: "0 0 16 16"
  },
    h("path", {
      d: filled
        ? "M8 2.748-.717 5.385C-3.362 7.982 1.443 13.5 8 13.5s11.362-5.518 8.717-8.115C16.317 5.385 8 2.748 8 2.748z"
        : "M8 2.748-.717 5.385C-3.362 7.982 1.443 13.5 8 13.5s11.362-5.518 8.717-8.115C16.317 5.385 8 2.748 8 2.748zM8 15C-7.333 4.868 3.279-3.04 7.824 1.143c.06.055.119.112.176.171a3.12 3.12 0 0 1 .176-.17C12.72-3.042 23.333 4.868 8 15z"
    })
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
      }, isFav ? "Unfavorite" : "Favorite")
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

// --- icons ---
function svgStar(){
  return h("svg", { width:16, height:16, viewBox:"0 0 24 24", fill:"none", stroke:"currentColor", "stroke-width":"2" },
    h("path", { d:"M12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21 12 17.27Z" })
  );
}
function svgPlay(){
  return h("svg", { width:16, height:16, viewBox:"0 0 24 24", fill:"currentColor" },
    h("path", { d:"M8 5v14l11-7z" })
  );
}
function svgSearch(){
  return h("svg", { width:16, height:16, viewBox:"0 0 24 24", fill:"none", stroke:"currentColor","stroke-width":"2" },
    h("circle", { cx:"11", cy:"11", r:"8" }),
    h("path", { d:"M21 21l-4.3-4.3" })
  );
}
function svgLink(){
  return h("svg", { width:16, height:16, viewBox:"0 0 24 24", fill:"none", stroke:"currentColor","stroke-width":"2" },
    h("path", { d:"M10 13a5 5 0 0 0 7.07 0l1.41-1.41a5 5 0 0 0-7.07-7.07L10 5" }),
    h("path", { d:"M14 11a5 5 0 0 0-7.07 0L5.5 12.43a5 5 0 0 0 7.07 7.07L14 19" })
  );
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
