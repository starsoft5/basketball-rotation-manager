// Generates a marketing mockup of the "Game History" screen (app/history.js)
// matching the visual style of enhanced-timer-screen.png / timer-screen-with-scoreboard.png.
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const W = 560;

// Palette pulled straight from app/history.js + app/_layout.js
const C = {
  bg: "#0F172A",
  header: "#1E293B",
  card: "#1E293B",
  border: "#334155",
  accent: "#FB923C",
  text: "#FFFFFF",
  textSecondary: "#94A3B8",
  date: "#64748B",
  hint: "#475569",
};

const statusColors = {
  completed: "#15803D",
  in_progress: "#F97316",
  ready: "#2563EB",
  setup: "#475569",
};
const statusLabels = {
  completed: "COMPLETED",
  in_progress: "IN PROGRESS",
  ready: "READY",
  setup: "SETUP",
};

const games = [
  { name: "Saturday Pickup", status: "in_progress", players: 12, rot: 5, date: "2026-06-19 18:30" },
  { name: "Tuesday Night Run", status: "completed", players: 10, rot: 12, date: "2026-06-16 19:00" },
  { name: "Sunday League", status: "ready", players: 14, rot: 0, date: "2026-06-15 17:45" },
  { name: "Friday Scrimmage", status: "completed", players: 12, rot: 12, date: "2026-06-12 20:00" },
  { name: "Midweek Hoops", status: "setup", players: 8, rot: 0, date: "2026-06-10 19:30" },
  { name: "Park Game", status: "completed", players: 10, rot: 12, date: "2026-06-07 16:00" },
];

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// --- geometry ---
const headerH = 92;
const padX = 24;
const cardX = padX;
const cardW = W - padX * 2;
const cardPad = 16;
const cardGap = 12;
const cardH = 82;

let y = headerH + 16; // container paddingTop 16
let parts = [];

// approximate text width for the status pill (11px bold, ~7.2px/char + padding)
const pillWidth = (label) => label.length * 7.0 + 16;

games.forEach((g) => {
  const cx = cardX;
  // card
  parts.push(
    `<rect x="${cx}" y="${y}" width="${cardW}" height="${cardH}" rx="16" fill="${C.card}" stroke="${C.border}" stroke-width="1"/>`
  );
  // title
  const titleY = y + cardPad + 15;
  parts.push(
    `<text x="${cx + cardPad}" y="${titleY}" font-family="Segoe UI, Arial, sans-serif" font-size="17" font-weight="bold" fill="${C.text}">${esc(g.name)}</text>`
  );
  // status pill (right aligned)
  const label = statusLabels[g.status];
  const pw = pillWidth(label);
  const pillH = 20;
  const px = cx + cardW - cardPad - pw;
  const py = y + cardPad - 1;
  parts.push(
    `<rect x="${px}" y="${py}" width="${pw}" height="${pillH}" rx="10" fill="${statusColors[g.status]}"/>`
  );
  parts.push(
    `<text x="${px + pw / 2}" y="${py + 14}" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="11" font-weight="bold" fill="#FFFFFF">${esc(label)}</text>`
  );
  // info row
  const infoY = titleY + 24;
  let ix = cx + cardPad;
  const infoFont = `font-family="Segoe UI, Arial, sans-serif" font-size="13"`;
  const players = `${g.players} players`;
  parts.push(`<text x="${ix}" y="${infoY}" ${infoFont} fill="${C.textSecondary}">${players}</text>`);
  ix += players.length * 7.0 + 16;
  const rot = `Rotation ${g.rot}/12`;
  parts.push(`<text x="${ix}" y="${infoY}" ${infoFont} fill="${C.textSecondary}">${rot}</text>`);
  ix += rot.length * 7.0 + 16;
  parts.push(
    `<text x="${ix}" y="${infoY}" font-family="Segoe UI, Arial, sans-serif" font-size="11" fill="${C.date}">${esc(g.date)}</text>`
  );

  y += cardH + cardGap;
});

const hintY = y + 20;
parts.push(
  `<text x="${W / 2}" y="${hintY}" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="11" fill="${C.hint}">Long press a game to delete it</text>`
);

const H = hintY + 28;

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="${C.bg}"/>
  <!-- nav header -->
  <rect x="0" y="0" width="${W}" height="${headerH}" fill="${C.header}"/>
  <text x="16" y="48" font-family="Segoe UI, Arial, sans-serif" font-size="14" font-weight="600" fill="${C.accent}">&#8592; Back</text>
  <text x="16" y="76" font-family="Segoe UI, Arial, sans-serif" font-size="18" font-weight="bold" fill="${C.accent}">Game History</text>
  ${parts.join("\n  ")}
</svg>`;

const outSvg = path.join(__dirname, "..", "history-screen.svg");
const outPng = path.join(__dirname, "..", "history-screen.png");
fs.writeFileSync(outSvg, svg);

sharp(Buffer.from(svg))
  .png()
  .toFile(outPng)
  .then((info) => console.log(`Wrote ${outPng} (${info.width}x${info.height})`))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
