import express from "express";
import path from "node:path";
import fs from "fs-extra";
import morgan from "morgan";
import { fileURLToPath } from "node:url";
import chokidar from "chokidar";
import { scanLibrary } from "./scanner.js";
import { ensureThumbsDir, makeThumb, thumbPathFor } from "./thumbs.js";
import { matchesQuery, paginate, PAGE_SIZE_DEFAULT, hashPath } from "./utils.js";
import mime from "mime";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ----- Config -----
const LIBRARY_DIR = process.env.LIBRARY_DIR || path.resolve(process.cwd(), "videos");
const THUMBS_DIR = path.join(__dirname, "thumbs");
const FFMPEG = process.env.FFMPEG || "ffmpeg";
const PORT = process.env.PORT || 5170;

// ----- In-memory state -----
let LIB = { channels: [], totalVideos: 0, scannedAt: null };

// ----- Helpers -----
async function rescan() {
  console.log("[scan] scanning library:", LIBRARY_DIR);
  LIB = await scanLibrary(LIBRARY_DIR);
  console.log("[scan] done. channels:", LIB.channels.length, "videos:", LIB.totalVideos);
}

// ----- Initial boot -----
const args = new Set(process.argv.slice(2));
await ensureThumbsDir(THUMBS_DIR);
await rescan();

// Optional: watch for changes (adds basic live updates)
const watcher = chokidar.watch(LIBRARY_DIR, { ignoreInitial: true });
watcher.on("all", async () => {
  clearTimeout(global.__rescanTimer);
  global.__rescanTimer = setTimeout(() => rescan(), 1500);
});

// ----- Server -----
const app = express();
app.disable("x-powered-by");
app.use(morgan("tiny"));
app.use(express.static(path.join(__dirname, "..", "public"), { maxAge: "1h", etag: true }));

// Serve actual videos directly with range support using express static under /video
app.use("/video", express.static(LIBRARY_DIR, {
  acceptRanges: true,
  setHeaders(res, filePath) {
    const type = mime.getType(filePath);
    if (type) res.setHeader("Content-Type", type);
    // Helpful caching for local network
    res.setHeader("Cache-Control", "public, max-age=86400, immutable");
  }
}));
app.use('/videos', express.static(path.join(LIBRARY_DIR)));

// --- API: channels list ---
app.get("/api/channels", (req, res) => {
  const q = (req.query.q || "").toString();
  const page = Number(req.query.page || 1);
  const pageSize = Number(req.query.pageSize || PAGE_SIZE_DEFAULT);

  const filtered = LIB.channels
    .filter(c => matchesQuery(c.name, q))
    .map(c => ({
      id: c.id,
      name: c.name,
      count: c.count,
      coverRelPath: c.coverRelPath
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return res.json(paginate(filtered, page, pageSize));
});

// --- API: videos in a channel ---
app.get("/api/channels/:id/videos", (req, res) => {
  const { id } = req.params;
  const q = (req.query.q || "").toString();
  const page = Number(req.query.page || 1);
  const pageSize = Number(req.query.pageSize || PAGE_SIZE_DEFAULT);

  const channel = LIB.channels.find(c => c.id === id);
  if (!channel) return res.status(404).json({ error: "Channel not found" });

  const filtered = channel.videos
    .filter(v => matchesQuery(v.name, q))
    .map(v => ({
      name: v.name,
      relPath: v.relPath,
      mtime: v.mtime,
      size: v.size
    }));

  return res.json(paginate(filtered, page, pageSize));
});

// --- API: global search (across channels) ---
app.get("/api/search", (req, res) => {
  const q = (req.query.q || "").toString();
  const page = Number(req.query.page || 1);
  const pageSize = Number(req.query.pageSize || PAGE_SIZE_DEFAULT);

  const all = [];
  for (const c of LIB.channels) {
    for (const v of c.videos) {
      if (matchesQuery(v.name, q)) {
        all.push({
          channelId: c.id,
          channel: c.name,
          name: v.name,
          relPath: v.relPath,
          mtime: v.mtime,
          size: v.size
        });
      }
    }
  }
  all.sort((a, b) => b.mtime - a.mtime);
  return res.json(paginate(all, page, pageSize));
});

// --- Thumbnails (on demand, cached) ---
app.get("/api/thumb", async (req, res) => {
  const relPath = (req.query.relPath || "").toString();
  if (!relPath) return res.status(400).end();

  const absVideo = path.join(LIBRARY_DIR, relPath);
  if (!(await fs.pathExists(absVideo))) return res.status(404).end();

  // Get base thumbnail path (no extension)
  const outAbsBase = thumbPathFor(THUMBS_DIR, relPath);
  // Try to find existing thumbnail with known extensions
  const exts = [".jpg", ".png", ".webp"];
  let outAbs = null;
  for (const ext of exts) {
    const candidate = outAbsBase + ext;
    if (await fs.pathExists(candidate)) {
      outAbs = candidate;
      break;
    }
  }
  // If not found, generate thumbnail and get its path
  if (!outAbs) {
    try {
      outAbs = await makeThumb(FFMPEG, absVideo, outAbsBase);
    } catch {
      // fallback placeholder (1x1 transparent PNG)
      res.setHeader("Content-Type", "image/png");
      const buf = Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=",
        "base64"
      );
      return res.end(buf);
    }
  }
  // Set correct content-type
  if (outAbs.endsWith('.png')) res.setHeader('Content-Type', 'image/png');
  else if (outAbs.endsWith('.webp')) res.setHeader('Content-Type', 'image/webp');
  else res.setHeader('Content-Type', 'image/jpeg');
  res.setHeader("Cache-Control", "public, max-age=2592000, immutable");
  return res.sendFile(outAbs);
});

// --- Health/info ---
app.get("/api/info", (req, res) => {
  res.json({ libraryDir: LIBRARY_DIR, scannedAt: LIB.scannedAt, channels: LIB.channels.length, videos: LIB.totalVideos });
});

// --- API: cleanup thumbnails ---
app.post("/api/cleanup-thumbs", async (req, res) => {
  try {
    const thumbFiles = await fs.readdir(THUMBS_DIR);
    let deleted = 0;
    for (const file of thumbFiles) {
      if (!file.endsWith(".jpg")) continue;
      const thumbPath = path.join(THUMBS_DIR, file);

      // Try to find the corresponding video by reverse-hashing all relPaths in library
      let found = false;
      for (const channel of LIB.channels) {
        for (const video of channel.videos) {
          if (file === `${hashPath(video.relPath)}.jpg`) {
            found = true;
            break;
          }
        }
        if (found) break;
      }
      if (!found) {
        await fs.remove(thumbPath);
        deleted++;
      }
    }
    res.json({ ok: true, deleted });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ----- Favorites & Playlists -----
// --- User Settings API ---
const USER_SETTINGS_FILE = path.join(__dirname, "user-settings.json");

async function readUserSettings() {
  try {
    const s = await fs.readJson(USER_SETTINGS_FILE);
    return s;
  } catch {
    return { theme: "dark" };
  }
}

async function writeUserSettings(settings) {
  await fs.writeJson(USER_SETTINGS_FILE, settings, { spaces: 2 });
}

app.get("/api/user-settings", async (req, res) => {
  const s = await readUserSettings();
  res.json(s);
});

app.post("/api/user-settings", express.json(), async (req, res) => {
  const { theme } = req.body;
  if (!theme || !["dark", "light"].includes(theme)) return res.status(400).json({ error: "Invalid theme" });
  await writeUserSettings({ theme });
  res.json({ ok: true });
});
const FAVORITES_FILE = path.join(__dirname, "favorites.json");
const PLAYLISTS_FILE = path.join(__dirname, "playlists.json");
const MOMENTS_FILE = path.join(__dirname, "moments.json");

// Helper to read playlists
async function readPlaylists() {
  try {
    const pls = await fs.readJson(PLAYLISTS_FILE);
    return Array.isArray(pls) ? pls : [];
  } catch {
    return [];
  }
}

// Helper to write playlists
async function writePlaylists(pls) {
  await fs.writeJson(PLAYLISTS_FILE, pls, { spaces: 2 });
}

// Helper to read favorites
async function readFavorites() {
  try {
    const favs = await fs.readJson(FAVORITES_FILE);
    return Array.isArray(favs) ? favs : [];
  } catch {
    return [];
  }
}

// Helper to write favorites
async function writeFavorites(favs) {
  await fs.writeJson(FAVORITES_FILE, favs, { spaces: 2 });
}

// Helper to read moments
async function readMoments() {
  try {
    return await fs.readJson(MOMENTS_FILE);
  } catch {
    return [];
  }
}
async function writeMoments(moments) {
  await fs.writeJson(MOMENTS_FILE, moments, { spaces: 2 });
}

// Get all favorites
app.get("/api/favorites", async (req, res) => {
  const favs = await readFavorites();
  res.json(favs);
});

// Add a favorite
app.post("/api/favorites", express.json(), async (req, res) => {
  const fav = req.body;
  if (!fav || !fav.relPath) return res.status(400).json({ error: "Missing relPath" });
  let favs = await readFavorites();
  if (!favs.find(f => f.relPath === fav.relPath)) {
    favs.push(fav);
    await writeFavorites(favs);
  }
  res.json({ ok: true });
});

// Remove a favorite
app.delete("/api/favorites", express.json(), async (req, res) => {
  const { relPath } = req.body;
  if (!relPath) return res.status(400).json({ error: "Missing relPath" });
  let favs = await readFavorites();
  favs = favs.filter(f => f.relPath !== relPath);
  await writeFavorites(favs);
  res.json({ ok: true });
});

// --- Playlists API ---
// Get all playlists
app.get("/api/playlists", async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const pageSize = parseInt(req.query.pageSize) || 20;
  const pls = await readPlaylists();
  const total = pls.length;
  const start = (page - 1) * pageSize;
  const end = start + pageSize;
  const pageData = pls.slice(start, end);
  res.json({
    data: pageData,
    page,
    pageSize,
    total,
    totalPages: Math.ceil(total / pageSize)
  });
});

// Create a playlist
app.post("/api/playlists", express.json(), async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: "Missing name" });
  let pls = await readPlaylists();
  // Generate id (slug)
  const id = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  if (pls.find(pl => pl.id === id)) return res.status(400).json({ error: "Playlist exists" });
  pls.push({ id, name, videos: [] });
  await writePlaylists(pls);
  res.json({ ok: true });
});

// Delete a playlist
app.delete("/api/playlists/:id", async (req, res) => {
  const { id } = req.params;
  let pls = await readPlaylists();
  pls = pls.filter(pl => pl.id !== id);
  await writePlaylists(pls);
  res.json({ ok: true });
});

// Add video to playlist
app.post("/api/playlists/:id/add", express.json(), async (req, res) => {
  const { id } = req.params;
  const video = req.body;
  if (!video || !video.relPath) return res.status(400).json({ error: "Missing video relPath" });
  let pls = await readPlaylists();
  const pl = pls.find(pl => pl.id === id);
  if (!pl) return res.status(404).json({ error: "Playlist not found" });
  if (!pl.videos.find(v => v.relPath === video.relPath)) {
    pl.videos.push(video);
    await writePlaylists(pls);
  }
  res.json({ ok: true });
});

// Remove video from playlist
app.post("/api/playlists/:id/remove", express.json(), async (req, res) => {
  const { id } = req.params;
  const { relPath } = req.body;
  if (!relPath) return res.status(400).json({ error: "Missing relPath" });
  let pls = await readPlaylists();
  const pl = pls.find(pl => pl.id === id);
  if (!pl) return res.status(404).json({ error: "Playlist not found" });
  pl.videos = pl.videos.filter(v => v.relPath !== relPath);
  await writePlaylists(pls);
  res.json({ ok: true });
});

// --- API: stats ---
app.get("/api/stats", (req, res) => {
  const numChannels = LIB.channels.length;
  const numVideos = LIB.channels.reduce((sum, c) => sum + c.videos.length, 0);
  const totalSize = LIB.channels.reduce((sum, c) => sum + c.videos.reduce((s, v) => s + (v.size || 0), 0), 0);
  res.json({
    channels: numChannels,
    videos: numVideos,
    totalSize
  });
});

// --- API: manual rescan ---
app.post("/api/rescan", async (req, res) => {
  try {
    await rescan();
    console.log("[manual] Library rescan triggered by user.");
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- API: get all moments ---
app.get("/api/moments", async (req, res) => {
  const moments = await readMoments();
  const page = Number(req.query.page || 1);
  const pageSize = Math.max(1, Math.min(96, Number(req.query.pageSize) || 20));
  const total = moments.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const data = moments.slice((page-1)*pageSize, page*pageSize);
  res.json({ page, pageSize, total, totalPages, data });
});

// --- API: add a moment ---
app.post("/api/moments", express.json(), async (req, res) => {
  const { relPath, timestamp, title } = req.body;
  if (!relPath || typeof timestamp !== "number" || !title) {
    return res.status(400).json({ error: "Missing required fields" });
  }
  const moments = await readMoments();
  moments.push({ relPath, timestamp, title });
  await writeMoments(moments);
  res.json({ ok: true });
});

// --- API: delete a moment ---
app.delete("/api/moments", express.json(), async (req, res) => {
  const { relPath, timestamp } = req.body;
  if (!relPath || typeof timestamp !== "number") {
    return res.status(400).json({ error: "Missing required fields" });
  }
  let moments = await readMoments();
  moments = moments.filter(m => !(m.relPath === relPath && m.timestamp === timestamp));
  await writeMoments(moments);
  res.json({ ok: true });
});

// Fallback to SPA
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`Araglas running on http://localhost:${PORT}`);
  console.log(`Library: ${LIBRARY_DIR}`);
  console.log(`Thumbnails: ${THUMBS_DIR}`);
});
