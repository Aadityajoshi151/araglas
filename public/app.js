// Extracted helpers
import { h } from '/core/helpers.js';
import { renderLayout } from '/core/ui.js';
import { loadFavs } from '/core/stores.js';
import { listen as listenHashRouter, runRoute } from '/core/router-hash.js';
import { renderHome } from '/pages/home.js';
import { renderPlaylists, renderPlaylistDetail } from '/pages/playlists.js';
import { renderFavorites } from '/pages/favorites.js';
import { renderSearch } from '/pages/search.js';
import { renderChannels } from '/pages/channels.js';
import { renderChannel } from '/pages/channel.js';
import { renderMoments } from '/pages/moments.js';
import { renderWatch } from '/pages/watch.js';
import { renderStats } from '/pages/stats.js';
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


// Utility moved to /core/helpers.js: formatTimestamp

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

// favorites, playlists, playlist detail extracted to /pages

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

// --- UI components moved to /core/components.js ---

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
