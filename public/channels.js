// channels.js: Handles rendering and search for channels page

async function fetchChannels(q = "", page = 1, pageSize = 15) {
  const resp = await fetch(`/api/channels?page=${page}&pageSize=${pageSize}&q=${encodeURIComponent(q)}`);
  return await resp.json();
}

function renderChannelsPage() {
  let q = "";
  let page = 1;
  let pageSize = 15;
  const searchInput = document.getElementById("channels-search");
  const clearBtn = document.getElementById("channels-search-clear");
  const grid = document.getElementById("channels-grid");
  const pagination = document.getElementById("channels-pagination");

  async function update() {
    const data = await fetchChannels(q, page, pageSize);
    grid.innerHTML = "";
    if (!data.data.length) {
      grid.innerHTML = '<div class="notice">No channels found.</div>';
      pagination.innerHTML = "";
      return;
    }
    grid.innerHTML = data.data.map(c => `
      <div class="channel-card-wrap" style="display:flex;flex-direction:column;align-items:center;justify-content:center;">
        <div class="channel-card" style="width:100%;max-width:180px;min-width:120px;">
          <img class="channel-thumb" src="/api/thumb?relPath=${encodeURIComponent(c.coverRelPath)}" alt="${c.name}" style="width:100%;height:auto;border-radius:10px;object-fit:cover;" />
        </div>
        <div class="channel-title" style="margin-top:8px;font-weight:600;text-align:center;word-break:break-word;">${c.name}</div>
        <div class="channel-sub" style="font-size:0.98em;color:var(--muted);text-align:center;">${c.count} video${c.count !== 1 ? "s" : ""}</div>
      </div>
    `).join("");
    // Pagination
    pagination.innerHTML = `
      <button class="pagination-btn" ${data.page === 1 ? "disabled" : ""} onclick="window.goToPage(1)">« First</button>
      <button class="pagination-btn" ${data.page === 1 ? "disabled" : ""} onclick="window.goToPage(${Math.max(1, data.page-1)})">‹ Prev</button>
      <span class="cur">Page ${data.page} / ${data.totalPages}</span>
      <button class="pagination-btn" ${data.page === data.totalPages ? "disabled" : ""} onclick="window.goToPage(${Math.min(data.totalPages, data.page+1)})">Next ›</button>
      <button class="pagination-btn" ${data.page === data.totalPages ? "disabled" : ""} onclick="window.goToPage(${data.totalPages})">Last »</button>
    `;
  }

  searchInput.oninput = (e) => { q = e.target.value; };
  searchInput.onkeydown = (e) => {
    if (e.key === "Enter") {
      page = 1;
      update();
    }
  };
  clearBtn.onclick = () => {
    q = "";
    searchInput.value = "";
    searchInput.focus();
    page = 1;
    update();
  };
  window.goToPage = (p) => {
    page = p;
    update();
  };
  update();
}

document.addEventListener("DOMContentLoaded", renderChannelsPage);
