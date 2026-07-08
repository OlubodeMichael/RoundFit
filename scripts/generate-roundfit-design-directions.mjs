import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const outDir = path.join(root, "marketing", "social", "design-directions");
fs.mkdirSync(outDir, { recursive: true });

const logoPath = "/Users/lacatel/Desktop/Roundfit/splash-icon-dark.png";
const logo = `data:image/png;base64,${fs.readFileSync(logoPath).toString("base64")}`;

const W = 1080;
const H = 1440;
const C = {
  black: "#050608",
  near: "#0b0c10",
  panel: "#17181d",
  panel2: "#202329",
  white: "#f7f7f8",
  muted: "#a5a6ad",
  dim: "#73757d",
  orange: "#ff7446",
  orange2: "#ff9a22",
  green: "#34d399",
  blue: "#38bdf8",
  purple: "#9b7cff",
};

function esc(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function text(lines, x, y, opts = {}) {
  const {
    size = 78,
    weight = 900,
    fill = C.white,
    leading = size * 1.08,
    anchor = "start",
    opacity = 1,
    tracking = 0,
  } = opts;
  const body = lines
    .map((line, i) => `<tspan x="${x}" dy="${i === 0 ? 0 : leading}">${esc(line)}</tspan>`)
    .join("");
  return `<text x="${x}" y="${y}" font-family="Inter, Arial, Helvetica, sans-serif" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}" opacity="${opacity}" letter-spacing="${tracking}">${body}</text>`;
}

function rect(x, y, w, h, r, fill, attrs = "") {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}" ${attrs}/>`;
}

function logoHeader(color = C.white) {
  return `
    <image href="${logo}" x="64" y="60" width="78" height="78" preserveAspectRatio="xMidYMid meet"/>
    ${text(["ROUNDFIT"], 150, 108, { size: 23, weight: 900, fill: color, tracking: 4 })}`;
}

function defs() {
  return `
  <defs>
    <linearGradient id="orange" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${C.orange2}"/>
      <stop offset="1" stop-color="${C.orange}"/>
    </linearGradient>
    <radialGradient id="orangeGlow" cx="78%" cy="18%" r="70%">
      <stop offset="0" stop-color="${C.orange}" stop-opacity="0.42"/>
      <stop offset="1" stop-color="${C.orange}" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="blueGlow" cx="12%" cy="78%" r="62%">
      <stop offset="0" stop-color="${C.blue}" stop-opacity="0.17"/>
      <stop offset="1" stop-color="${C.blue}" stop-opacity="0"/>
    </radialGradient>
    <filter id="shadow" x="-30%" y="-30%" width="160%" height="160%">
      <feDropShadow dx="0" dy="28" stdDeviation="28" flood-color="#000000" flood-opacity="0.38"/>
    </filter>
  </defs>`;
}

function shell(body, bg = C.black) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
${defs()}
<rect width="${W}" height="${H}" fill="${bg}"/>
${body}
</svg>`;
}

const slides = [
  {
    name: "direction-01-premium-signal",
    body: shell(`
      <rect width="${W}" height="${H}" fill="url(#orangeGlow)"/>
      <rect width="${W}" height="${H}" fill="url(#blueGlow)"/>
      ${logoHeader()}
      ${text(["DIRECTION 01"], 64, 235, { size: 23, weight: 900, fill: C.orange, tracking: 4 })}
      ${text(["Premium", "Signal"], 64, 385, { size: 118, leading: 122 })}
      ${text(["You track everything.", "But what should you do today?"], 68, 715, { size: 45, weight: 800, fill: C.muted, leading: 62 })}
      <g transform="translate(64 980)">
        ${rect(0, 0, 952, 186, 42, "#101216", `stroke="url(#orange)" stroke-width="3" filter="url(#shadow)"`)}
        ${text(["Today: Recover"], 52, 112, { size: 64, weight: 900 })}
        <circle cx="846" cy="93" r="42" fill="url(#orange)"/>
      </g>
      ${text(["Look: WHOOP-like, black, restrained, premium."], 64, 1335, { size: 25, weight: 800, fill: C.dim })}
    `),
  },
  {
    name: "direction-02-data-into-decision",
    body: shell(`
      <rect width="${W}" height="${H}" fill="#07080b"/>
      ${logoHeader()}
      ${text(["DIRECTION 02"], 64, 235, { size: 23, weight: 900, fill: C.orange, tracking: 4 })}
      <g opacity="0.55">
        <path d="M70 1010C230 800 356 1020 510 850S776 600 1010 704" fill="none" stroke="${C.blue}" stroke-width="5"/>
        <path d="M70 1130C250 960 386 1100 520 950S786 846 1010 930" fill="none" stroke="${C.green}" stroke-width="5"/>
        <path d="M70 1250C250 1132 382 1260 530 1084S820 1020 1010 1112" fill="none" stroke="${C.orange}" stroke-width="5"/>
      </g>
      ${text(["Data into", "decision."], 64, 390, { size: 112, leading: 120 })}
      ${text(["Sleep, food, training, recovery.", "One clear move."], 68, 690, { size: 42, weight: 800, fill: C.muted, leading: 60 })}
      <g transform="translate(304 870)">
        <circle cx="236" cy="236" r="206" fill="#111317" stroke="#2a2c33" stroke-width="2" filter="url(#shadow)"/>
        <circle cx="236" cy="236" r="118" fill="url(#orange)"/>
        ${text(["REFUEL"], 236, 253, { size: 42, weight: 950, fill: "#111", anchor: "middle" })}
      </g>
      ${text(["Look: abstract, tech-forward, signal convergence."], 64, 1335, { size: 25, weight: 800, fill: C.dim })}
    `),
  },
  {
    name: "direction-03-bold-editorial",
    body: shell(`
      <rect x="0" y="0" width="${W}" height="${H}" fill="#f5f1e8"/>
      <path d="M0 0H1080V458C842 530 650 455 486 366C320 276 164 300 0 390Z" fill="#050608"/>
      ${logoHeader(C.white)}
      ${text(["DIRECTION 03"], 64, 235, { size: 23, weight: 900, fill: C.orange, tracking: 4 })}
      ${text(["Stop", "guessing."], 64, 390, { size: 128, leading: 130 })}
      ${text(["Know what to do today."], 64, 685, { size: 54, weight: 900, fill: "#101010" })}
      <g transform="translate(64 835)">
        ${rect(0, 0, 952, 150, 34, "#ffffff", `stroke="#e1d9cc" stroke-width="2"`)}
        ${text(["Push"], 80, 94, { size: 44, weight: 900, fill: "#101010" })}
        ${text(["Recover"], 378, 94, { size: 44, weight: 900, fill: "#101010" })}
        ${text(["Refuel"], 737, 94, { size: 44, weight: 900, fill: "#101010" })}
      </g>
      <g transform="translate(64 1085)">
        ${rect(0, 0, 492, 98, 49, "url(#orange)")}
        ${text(["Get your instruction"], 246, 62, { size: 31, weight: 900, fill: "#111", anchor: "middle" })}
      </g>
      ${text(["Look: bold editorial, more contrast, scroll-stopping."], 64, 1335, { size: 25, weight: 800, fill: "#6a665d" })}
    `, "#f5f1e8"),
  },
  {
    name: "direction-04-human-performance",
    body: shell(`
      <rect width="${W}" height="${H}" fill="#050608"/>
      <rect x="566" y="0" width="514" height="1440" fill="url(#orangeGlow)" opacity="0.9"/>
      <circle cx="760" cy="840" r="310" fill="#14151a" stroke="#2b2d35" stroke-width="2"/>
      <circle cx="760" cy="840" r="210" fill="#0b0c10"/>
      <circle cx="760" cy="840" r="118" fill="url(#orange)"/>
      ${logoHeader()}
      ${text(["DIRECTION 04"], 64, 235, { size: 23, weight: 900, fill: C.orange, tracking: 4 })}
      ${text(["Your body", "already has", "the signals."], 64, 390, { size: 86, leading: 94 })}
      ${text(["RoundFit turns them", "into a decision."], 68, 710, { size: 42, weight: 800, fill: C.muted, leading: 58 })}
      <g transform="translate(64 1030)">
        ${rect(0, 0, 492, 104, 52, C.white)}
        ${text(["Know today's move"], 246, 66, { size: 30, weight: 900, fill: "#111", anchor: "middle" })}
      </g>
      ${text(["Look: human-performance, emotional, cinematic."], 64, 1335, { size: 25, weight: 800, fill: C.dim })}
    `),
  },
];

for (const slide of slides) {
  fs.writeFileSync(path.join(outDir, `${slide.name}.svg`), slide.body);
}

console.log(slides.map((slide) => path.join(outDir, `${slide.name}.svg`)).join("\n"));
