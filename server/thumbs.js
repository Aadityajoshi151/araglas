import fs from "fs-extra";
import path from "node:path";
import { spawn } from "node:child_process";
import { hashPath } from "./utils.js";

export async function ensureThumbsDir(thumbsDir) {
  await fs.ensureDir(thumbsDir);
}

export function guessPosterTimeMs(durationMs) {
  // Simple heuristic: 10% in
  return Math.max(1000, Math.floor(durationMs * 0.1));
}

// Generate a thumbnail using ffmpeg (must be in PATH).
// If ffmpeg isn't available, we’ll fallback to a placeholder (handled in route).
export async function makeThumb(ffmpegPath, videoAbs, outAbs) {
  return new Promise((resolve, reject) => {
    const args = [
      "-y",
      "-ss", "00:00:10",          // seek ~10s in (fast and good enough without probing)
      "-i", videoAbs,
      "-frames:v", "1",
      "-vf", "scale=480:-1",      // reasonable preview size
      "-nostats",
      "-loglevel", "error",
      outAbs
    ];
    const p = spawn(ffmpegPath, args);
    let err = "";
    p.stderr.on("data", d => (err += d.toString()));
    p.on("close", code => {
      if (code === 0) resolve(outAbs);
      else reject(new Error(err || `ffmpeg exited with ${code}`));
    });
  });
}

export function thumbPathFor(thumbsDir, relPath) {
  return path.join(thumbsDir, `${hashPath(relPath)}.jpg`);
}
