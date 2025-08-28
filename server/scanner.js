import fs from "fs-extra";
import path from "node:path";
import fg from "fast-glob";
import { isVideo, slugify } from "./utils.js";

export async function scanLibrary(LIB_DIR) {
  // channel = top-level folder under LIB_DIR
  const entries = await fs.readdir(LIB_DIR, { withFileTypes: true });
  const channels = [];
  for (const dirent of entries) {
    if (dirent.isDirectory()) {
      const channelName = dirent.name;
      const channelPath = path.join(LIB_DIR, channelName);
      const files = await fg(["**/*"], { cwd: channelPath, onlyFiles: true, dot: false });
      const videos = files
        .filter(isVideo)
        .map(v => ({
          name: path.basename(v),
          relPath: path.join(channelName, v).replaceAll("\\", "/"),
          channel: channelName,
          mtime: null // filled later
        }));

      // gather mtime for sorting
      for (const v of videos) {
        const stats = await fs.stat(path.join(LIB_DIR, v.relPath));
        v.mtime = stats.mtimeMs;
        v.size = stats.size;
      }

      if (videos.length) {
        videos.sort((a, b) => b.mtime - a.mtime);
        channels.push({
          id: slugify(channelName),
          name: channelName,
          count: videos.length,
          coverRelPath: videos[0].relPath, // use most recent as cover
          videos
        });
      }
    }
  }

  // Basic library stats
  const totalVideos = channels.reduce((s, c) => s + c.count, 0);
  return { channels, totalVideos, scannedAt: new Date().toISOString() };
}
