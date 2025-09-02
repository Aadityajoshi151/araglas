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
export async function makeThumb(ffmpegPath, videoAbs, outAbsBase) {
  console.log(`[thumbs] Attempting to extract attached thumbnail from: ${videoAbs}`);
  // Probe for attached_pic stream and codec
  let thumbExt = '.jpg';
  let attachedPicIndex = null;
  let attachedCodec = null;
  let ffprobeRaw = '';
  try {
    const ffprobeArgs = [
      '-v', 'error',
      '-show_entries', 'stream=index,codec_name,disposition',
      '-of', 'json',
      videoAbs
    ];
    const ffprobe = spawn('ffprobe', ffprobeArgs);
    let out = '';
    ffprobe.stdout.on('data', d => { out += d.toString(); ffprobeRaw += d.toString(); });
    await new Promise(resolve => ffprobe.on('close', resolve));
  // ...existing code...
    const info = JSON.parse(out);
    if (info.streams) {
      for (const s of info.streams) {
  // ...existing code...
        // Prefer disposition.attached_pic, but fallback to codec_name 'png' for non-audio streams
        if ((s.disposition && s.disposition.attached_pic === 1) ||
            (!s.disposition && s.codec_name === 'png' && s.index !== 0)) {
          attachedPicIndex = s.index;
          attachedCodec = s.codec_name;
          break;
        }
      }
    }
    console.log(`[thumbs] Detected attachedPicIndex: ${attachedPicIndex}, codec: ${attachedCodec}`);
    if (attachedPicIndex !== null) {
      if (attachedCodec === 'png') thumbExt = '.png';
      else if (attachedCodec === 'jpeg' || attachedCodec === 'mjpeg') thumbExt = '.jpg';
      else if (attachedCodec === 'webp') thumbExt = '.webp';
      else thumbExt = '.jpg';
    }
  } catch (err) {
    console.log('[thumbs] ffprobe failed:', err);
  }

  const outAbs = outAbsBase + thumbExt;
  let extracted = false;
  if (attachedPicIndex !== null) {
    const extractArgs = [
      "-y",
      "-i", videoAbs,
      "-map", `0:${attachedPicIndex}`,
      "-c", "copy",
      outAbs
    ];
    await new Promise((resolve) => {
      const p = spawn(ffmpegPath, extractArgs);
      let err = "";
      p.stderr.on("data", d => (err += d.toString()));
      p.on("close", code => {
        extracted = code === 0;
        if (extracted) {
          console.log(`[thumbs] Attached thumbnail extracted as ${thumbExt} for: ${videoAbs}`);
        } else {
          console.log(`[thumbs] Failed to extract attached thumbnail for: ${videoAbs}`);
          if (err) console.log(`[thumbs] ffmpeg error: ${err}`);
        }
        resolve();
      });
    });
    // If attached_pic was detected but extraction failed, do NOT fallback, just return and log error
    if (!extracted) {
      console.log(`[thumbs] Extraction failed for attached_pic stream, not falling back to frame extraction.`);
      return outAbs;
    }
  } else {
    // Only fallback if no attached_pic stream detected
    await new Promise((resolve, reject) => {
      const args = [
        "-y",
        "-ss", "00:00:10",
        "-i", videoAbs,
        "-frames:v", "1",
        "-vf", "scale=480:-1",
        "-nostats",
        "-loglevel", "error",
        outAbs
      ];
      const p = spawn(ffmpegPath, args);
      let err = "";
      p.stderr.on("data", d => (err += d.toString()));
      p.on("close", code => {
        if (code === 0) {
          console.log(`[thumbs] Generated thumbnail from frame for: ${videoAbs}`);
          resolve(outAbs);
        } else {
          console.log(`[thumbs] Failed to generate thumbnail for: ${videoAbs}`);
          if (err) console.log(`[thumbs] ffmpeg error: ${err}`);
          reject(new Error(err || `ffmpeg exited with ${code}`));
        }
      });
    });
  }
  return outAbs;
}

export function thumbPathFor(thumbsDir, relPath) {
  return path.join(thumbsDir, `${hashPath(relPath)}.jpg`);
}
