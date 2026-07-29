import sharp from "sharp";

// SVGs are vector (resizing/recompressing would only rasterize them for no
// gain) and GIFs are frequently animated (sharp would silently collapse them
// to a single frame) — both pass through untouched. Anything else we don't
// recognize also passes through rather than risk mangling an unknown format.
const PROCESSABLE_TYPES = new Set(["image/png", "image/jpeg", "image/jpg", "image/webp"]);

export async function compressImage(
  buffer: Buffer,
  mimeType: string,
  maxWidth: number
): Promise<{ buffer: Buffer; mimeType: string }> {
  if (!PROCESSABLE_TYPES.has(mimeType)) {
    return { buffer, mimeType };
  }

  try {
    const pipeline = sharp(buffer).resize({ width: maxWidth, withoutEnlargement: true });

    if (mimeType === "image/png") {
      // palette quantization is pngquant-style lossy compression that keeps
      // the alpha channel intact — safe for logos/product shots with
      // transparency, unlike converting to JPEG.
      return { buffer: await pipeline.png({ quality: 82, compressionLevel: 9, palette: true }).toBuffer(), mimeType };
    }
    if (mimeType === "image/webp") {
      return { buffer: await pipeline.webp({ quality: 82 }).toBuffer(), mimeType };
    }
    // image/jpeg or image/jpg
    return { buffer: await pipeline.jpeg({ quality: 82, mozjpeg: true }).toBuffer(), mimeType: "image/jpeg" };
  } catch (err) {
    // A malformed/unsupported upload shouldn't block the admin from saving —
    // fall back to storing the original bytes untouched.
    console.error("Image compression failed, storing original:", err);
    return { buffer, mimeType };
  }
}
