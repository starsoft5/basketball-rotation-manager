/**
 * Generate basketball app icons using sharp.
 *
 * Produces:
 *   assets/icon.png          - 1024x1024 general app icon
 *   assets/adaptive-icon.png - 1024x1024 adaptive icon foreground
 *                              (basketball at ~66% with transparent bg)
 */

const sharp = require("sharp");
const path = require("path");

// ── Colours ──────────────────────────────────────────────────────────
const BALL_ORANGE = "#F4841F";
const BALL_DARK = "#D16A0A"; // slightly darker shade for depth
const LINE_COLOR = "#1A1A1A";

/**
 * Build an SVG string of a basketball.
 *
 * @param {number} size      canvas width/height in px
 * @param {number} ballR     ball radius in px
 * @param {string} bg        background fill (use "none" for transparent)
 * @param {number} [bgR]     optional rounded-rect corner radius for background
 */
function basketballSVG(size, ballR, bg, bgR = 0) {
  const cx = size / 2;
  const cy = size / 2;
  const r = ballR;

  // Line thickness scales with ball size
  const lw = Math.round(r * 0.04);    // seam lines
  const olw = Math.round(r * 0.045);  // outer ring

  // Gradient IDs (unique per call isn't needed here but keeps SVG clean)
  const gradId = "ballGrad";
  const shadowId = "ballShadow";
  const highlightId = "ballHighlight";

  // A real basketball has:
  //   - one horizontal seam (equator)
  //   - one vertical seam (meridian)
  //   - two curved seams that run horizontally but arc up/down
  //     (like a wide smile and frown, going from left pole to right pole)

  const seamBow = r * 0.48; // how far the curved seams bow from the equator

  // Top curved seam: from left pole to right pole, bowing upward
  const topSeam = `M ${cx - r} ${cy}
    C ${cx - r * 0.35} ${cy - seamBow},
      ${cx + r * 0.35} ${cy - seamBow},
      ${cx + r} ${cy}`;

  // Bottom curved seam: from left pole to right pole, bowing downward
  const bottomSeam = `M ${cx - r} ${cy}
    C ${cx - r * 0.35} ${cy + seamBow},
      ${cx + r * 0.35} ${cy + seamBow},
      ${cx + r} ${cy}`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <!-- Main ball gradient: slight radial for 3-D feel -->
    <radialGradient id="${gradId}" cx="40%" cy="35%" r="65%" fx="38%" fy="32%">
      <stop offset="0%"  stop-color="#F9A94B"/>
      <stop offset="35%" stop-color="${BALL_ORANGE}"/>
      <stop offset="100%" stop-color="${BALL_DARK}"/>
    </radialGradient>

    <!-- Subtle shadow at the bottom -->
    <radialGradient id="${shadowId}" cx="50%" cy="100%" r="60%">
      <stop offset="0%" stop-color="#000" stop-opacity="0.25"/>
      <stop offset="100%" stop-color="#000" stop-opacity="0"/>
    </radialGradient>

    <!-- Highlight glare top-left -->
    <radialGradient id="${highlightId}" cx="35%" cy="30%" r="30%">
      <stop offset="0%" stop-color="#fff" stop-opacity="0.45"/>
      <stop offset="100%" stop-color="#fff" stop-opacity="0"/>
    </radialGradient>

    <!-- Clip to circle -->
    <clipPath id="ballClip">
      <circle cx="${cx}" cy="${cy}" r="${r}"/>
    </clipPath>
  </defs>

  <!-- Background -->
  ${
    bg === "none"
      ? ""
      : `<rect width="${size}" height="${size}" rx="${bgR}" ry="${bgR}" fill="${bg}"/>`
  }

  <!-- Ball body -->
  <circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#${gradId})"/>

  <!-- Seam lines (clipped to ball) -->
  <g clip-path="url(#ballClip)">
    <!-- Horizontal centre line (equator) -->
    <line x1="${cx - r}" y1="${cy}" x2="${cx + r}" y2="${cy}"
          stroke="${LINE_COLOR}" stroke-width="${lw}" stroke-linecap="round"/>

    <!-- Vertical centre line (meridian) -->
    <line x1="${cx}" y1="${cy - r}" x2="${cx}" y2="${cy + r}"
          stroke="${LINE_COLOR}" stroke-width="${lw}" stroke-linecap="round"/>

    <!-- Top curved seam (arcs upward) -->
    <path d="${topSeam}" fill="none"
          stroke="${LINE_COLOR}" stroke-width="${lw}" stroke-linecap="round"/>

    <!-- Bottom curved seam (arcs downward) -->
    <path d="${bottomSeam}" fill="none"
          stroke="${LINE_COLOR}" stroke-width="${lw}" stroke-linecap="round"/>

    <!-- Shadow overlay -->
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#${shadowId})"/>

    <!-- Highlight overlay -->
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#${highlightId})"/>
  </g>

  <!-- Outer ring of the ball -->
  <circle cx="${cx}" cy="${cy}" r="${r}" fill="none"
          stroke="${LINE_COLOR}" stroke-width="${olw}"/>
</svg>`;
}

async function generate() {
  const assetsDir = path.join(__dirname, "assets");

  // ── 1. icon.png ────────────────────────────────────────────────────
  // Ball fills most of the canvas, with a nice coloured background and
  // rounded corners so it looks good as a launcher icon.
  const iconSize = 1024;
  const iconBallR = iconSize * 0.42; // ~86 % of canvas
  const iconSVG = basketballSVG(iconSize, iconBallR, "#2C2C2C", 180);

  await sharp(Buffer.from(iconSVG))
    .resize(iconSize, iconSize)
    .png()
    .toFile(path.join(assetsDir, "icon.png"));

  console.log("Created assets/icon.png  (1024x1024)");

  // ── 2. adaptive-icon.png ───────────────────────────────────────────
  // Adaptive icons need the foreground on a transparent background.
  // The safe zone is the inner 66 % circle, so we keep the ball at
  // roughly 66 % of the canvas to stay inside the safe zone.
  const adaptiveSize = 1024;
  const adaptiveBallR = adaptiveSize * 0.33; // 66 % diameter
  const adaptiveSVG = basketballSVG(adaptiveSize, adaptiveBallR, "none");

  await sharp(Buffer.from(adaptiveSVG))
    .resize(adaptiveSize, adaptiveSize)
    .png()
    .toFile(path.join(assetsDir, "adaptive-icon.png"));

  console.log("Created assets/adaptive-icon.png  (1024x1024, transparent bg)");
}

generate().catch((err) => {
  console.error("Icon generation failed:", err);
  process.exit(1);
});
