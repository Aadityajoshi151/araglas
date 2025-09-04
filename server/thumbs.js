// Cleanup all .orig.* files in thumbs directory
export async function cleanupOrigThumbs(thumbsDir) {
  const files = await fs.readdir(thumbsDir);
  for (const file of files) {
    if (file.includes('.orig.')) {
      try {
        await fs.unlink(path.join(thumbsDir, file));
        console.log(`[thumbs] Deleted duplicate: ${file}`);
      } catch (err) {
        console.log(`[thumbs] Failed to delete: ${file}`, err);
      }
    }
  }
}
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
    const info = JSON.parse(out);
    if (info.streams) {
      for (const s of info.streams) {
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
    // Step 1: Extract the embedded thumbnail to a temp file
    const tempThumb = outAbsBase + '.orig' + thumbExt;
    const extractArgs = [
      "-y",
      "-i", videoAbs,
      "-map", `0:${attachedPicIndex}`,
      "-c", "copy",
      tempThumb
    ];
    await new Promise((resolve) => {
      const p = spawn(ffmpegPath, extractArgs);
      let err = "";
      p.stderr.on("data", d => (err += d.toString()));
      p.on("close", code => {
        extracted = code === 0;
        if (!extracted) {
          console.log(`[thumbs] Failed to extract attached thumbnail for: ${videoAbs}`);
          if (err) console.log(`[thumbs] ffmpeg error: ${err}`);
        }
        resolve();
      });
    });
    // Step 2: If extracted, re-encode and resize to match generated thumbnail quality
    if (extracted) {
      // Always output as webp for consistency
      const finalThumb = outAbsBase + ".webp";
      const resizeArgs = [
        "-y",
        "-i", tempThumb,
        "-vf", "scale=480:-1",
        "-compression_level", "6",
        finalThumb
      ];
      await new Promise((resolve) => {
        const p = spawn(ffmpegPath, resizeArgs);
        let err = "";
        p.stderr.on("data", d => (err += d.toString()));
        p.on("close", code => {
          if (code === 0) {
            console.log(`[thumbs] Embedded thumbnail resized and re-encoded for: ${videoAbs}`);
            // Remove temp file after successful resize
            try { require('fs').unlinkSync(tempThumb); } catch {}
          } else {
            console.log(`[thumbs] Failed to resize/re-encode embedded thumbnail for: ${videoAbs}`);
            if (err) console.log(`[thumbs] ffmpeg error: ${err}`);
            // Remove temp file even if resize fails
            try { require('fs').unlinkSync(tempThumb); } catch {}
          }
          resolve();
        });
      });
      // Clean up any leftover .orig.* files after thumbnail creation
      const thumbsDir = path.dirname(finalThumb);
      if (typeof cleanupOrigThumbs === 'function') {
        await cleanupOrigThumbs(thumbsDir);
      }
      return finalThumb;
    } else {
      // Remove temp file if extraction failed
      try { require('fs').unlinkSync(tempThumb); } catch {}
      console.log(`[thumbs] Extraction failed for attached_pic stream, not falling back to frame extraction.`);
      // Clean up any leftover .orig.* files after thumbnail creation
      const thumbsDir = path.dirname(outAbsBase + ".webp");
      if (typeof cleanupOrigThumbs === 'function') {
        await cleanupOrigThumbs(thumbsDir);
      }
      return outAbsBase + ".webp";
    }
  } else {
    // Only fallback if no attached_pic stream detected
    await new Promise((resolve, reject) => {
      const outAbs = outAbsBase + ".webp";
      const args = [
        "-y",
        "-ss", "00:00:10",
        "-i", videoAbs,
        "-frames:v", "1",
        "-vf", "scale=480:-1",
        "-compression_level", "6",
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
    return outAbsBase + ".webp";
  }
}

export function thumbPathFor(thumbsDir, relPath) {
  return path.join(thumbsDir, `${hashPath(relPath)}.webp`);
}
