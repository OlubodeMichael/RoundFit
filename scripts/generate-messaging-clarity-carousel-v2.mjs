import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const outDir = path.join(root, "marketing", "social", "messaging-clarity-carousel-v2");
fs.mkdirSync(outDir, { recursive: true });

const logoPath = "/Users/lacatel/Desktop/Roundfit/splash-icon-dark.png";
const logo = `data:image/png;base64,${fs.readFileSync(logoPath).toString("base64")}`;

const W = 1080;
const H = 1440;
const c = {
  bg: "#050608",
  bg2: "#0b0c10",
  white: "#f6f6f7",
  muted: "#a5a6ad",
  dim: "#6f717a",
  orange: "#ff7446",
  orange2: "#ff9a22",
  panel: "#15161b",
  line: "#2a2c33",
  green: "#36d49a",
  blue: "#34bdf7",
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
    size = 72,
    weight = 900,
    fill = c.white,
    leading = size * 1.08,
    anchor = "start",
    opacity = 1,
    tracking = 0,
  } = opts;

  return `<text x="${x}" y="${y}" font-family="Inter, Arial, Helvetica, sans-serif" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}" opacity="${opacity}" letter-spacing="${tracking}">${lines
    .map((line, i) => `<tspan x="${x}" dy="${i === 0 ? 0 : leading}">${esc(line)}</tspan>`)
    .join("")}</text>`;
}

function rect(x, y, w, h, r, fill, attrs = "") {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}" ${attrs}/>`;
}

function header() {
  return `
    <image href="${logo}" x="62" y="58" width="76" height="76" preserveAspectRatio="xMidYMid meet"/>
    ${text(["ROUNDFIT"], 146, 105, { size: 23, weight: 900, tracking: 4 })}`;
}

function page(n) {
  return `
    <text x="64" y="1370" font-family="Inter, Arial, Helvetica, sans-serif" font-size="22" font-weight="900" fill="${c.dim}" letter-spacing="4">${String(n).padStart(2, "0")}</text>
    <line x1="128" y1="1362" x2="1016" y2="1362" stroke="${c.line}" stroke-width="2"/>`;
}

function signal(x, y, color = c.orange, size = 10) {
  return `<circle cx="${x}" cy="${y}" r="${size}" fill="${color}"/>`;
}

function defs() {
  return `
  <defs>
    <linearGradient id="orange" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${c.orange2}"/>
      <stop offset="1" stop-color="${c.orange}"/>
    </linearGradient>
    <radialGradient id="glow" cx="74%" cy="16%" r="68%">
      <stop offset="0" stop-color="${c.orange}" stop-opacity="0.38"/>
      <stop offset="1" stop-color="${c.orange}" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="lowglow" cx="48%" cy="80%" r="64%">
      <stop offset="0" stop-color="${c.orange}" stop-opacity="0.18"/>
      <stop offset="1" stop-color="${c.orange}" stop-opacity="0"/>
    </radialGradient>
    <filter id="shadow" x="-25%" y="-25%" width="150%" height="150%">
      <feDropShadow dx="0" dy="26" stdDeviation="30" flood-color="#000000" flood-opacity="0.36"/>
    </filter>
  </defs>`;
}

function shell(body) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
${defs()}
<rect width="${W}" height="${H}" fill="${c.bg}"/>
<rect width="${W}" height="${H}" fill="url(#glow)"/>
<rect width="${W}" height="${H}" fill="url(#lowglow)"/>
${body}
</svg>`;
}

const slides = [
  {
    name: "01-if-they-dont-get-it",
    body: `
      ${header()}
      ${text(["MESSAGING & CLARITY"], 64, 220, { size: 24, fill: c.orange, tracking: 4 })}
      ${text(["If they", "don't get it,", "they don't buy it."], 64, 390, { size: 94, leading: 102 })}
      ${text(["Your product can be powerful and still lose people", "because the message makes them work too hard."], 68, 770, { size: 34, weight: 700, fill: c.muted, leading: 50 })}
      ${signal(890, 1040, c.orange, 18)}
      <path d="M690 1110C760 1010 838 1050 890 1040C948 1029 980 980 1014 930" fill="none" stroke="url(#orange)" stroke-width="7" stroke-linecap="round" opacity="0.75"/>
      ${page(1)}
    `,
  },
  {
    name: "02-clear-beats-clever",
    body: `
      ${header()}
      ${text(["CLEAR BEATS CLEVER"], 64, 220, { size: 24, fill: c.orange, tracking: 4 })}
      ${text(["Say the", "outcome first."], 64, 390, { size: 98, leading: 106 })}
      ${text(["Then explain the product."], 68, 625, { size: 44, weight: 800, fill: c.muted })}
      <g transform="translate(64 830)">
        ${rect(0, 0, 952, 252, 34, c.panel, `stroke="${c.line}" stroke-width="2" filter="url(#shadow)"`)}
        ${text(["People do not want", "more complexity."], 46, 88, { size: 52, leading: 58 })}
        ${text(["They want a clearer next step."], 48, 204, { size: 33, weight: 800, fill: c.orange })}
      </g>
      ${page(2)}
    `,
  },
  {
    name: "03-feature-to-benefit",
    body: `
      ${header()}
      ${text(["FEATURE VS BENEFIT"], 64, 220, { size: 24, fill: c.orange, tracking: 4 })}
      ${text(["The feature", "is what it does."], 64, 390, { size: 86, leading: 94 })}
      ${text(["The benefit is why anyone cares."], 68, 620, { size: 42, weight: 800, fill: c.muted })}
      <g transform="translate(64 820)">
        ${rect(0, 0, 952, 130, 30, c.panel, `stroke="${c.line}" stroke-width="2"`)}
        ${text(["Feature: sleep tracking"], 42, 82, { size: 36, weight: 850, fill: c.muted })}
      </g>
      <g transform="translate(64 1000)">
        ${rect(0, 0, 952, 154, 34, "#111317", `stroke="url(#orange)" stroke-width="3" filter="url(#shadow)"`)}
        ${text(["Benefit: know when to recover"], 42, 94, { size: 40, weight: 900 })}
      </g>
      ${page(3)}
    `,
  },
  {
    name: "04-before-after",
    body: `
      ${header()}
      ${text(["BEFORE / AFTER"], 64, 220, { size: 24, fill: c.orange, tracking: 4 })}
      ${text(["Stop saying", "what it is."], 64, 390, { size: 96, leading: 104 })}
      ${text(["Say what it changes."], 68, 626, { size: 46, weight: 850, fill: c.muted })}
      <g transform="translate(64 790)">
        ${rect(0, 0, 952, 170, 32, c.panel, `stroke="${c.line}" stroke-width="2"`)}
        ${text(["AI-powered health app"], 44, 103, { size: 42, weight: 850, fill: c.muted })}
      </g>
      <g transform="translate(64 1010)">
        ${rect(0, 0, 952, 206, 36, "#111317", `stroke="url(#orange)" stroke-width="3" filter="url(#shadow)"`)}
        ${text(["Know what your body", "needs today."], 44, 82, { size: 54, leading: 61 })}
      </g>
      ${page(4)}
    `,
  },
  {
    name: "05-roundfit-homepage",
    body: `
      ${header()}
      ${text(["ROUNDFIT HOMEPAGE"], 64, 220, { size: 24, fill: c.orange, tracking: 4 })}
      ${text(["Headline"], 64, 372, { size: 44, fill: c.orange, tracking: 1 })}
      ${text(["Know what", "your body", "needs today."], 64, 475, { size: 86, leading: 94 })}
      <g transform="translate(64 890)">
        ${rect(0, 0, 952, 250, 36, c.panel, `stroke="${c.line}" stroke-width="2" filter="url(#shadow)"`)}
        ${text(["RoundFit turns your health data into", "one clear daily coaching instruction."], 46, 88, { size: 38, weight: 800, fill: c.muted, leading: 54 })}
        ${text(["Push. Recover. Refuel."], 46, 204, { size: 33, weight: 900, fill: c.orange })}
      </g>
      ${page(5)}
    `,
  },
  {
    name: "06-feature-rewrites",
    body: `
      ${header()}
      ${text(["FEATURE REWRITES"], 64, 220, { size: 24, fill: c.orange, tracking: 4 })}
      ${text(["Make every", "feature answer:", "\"so what?\""], 64, 390, { size: 86, leading: 94 })}
      <g transform="translate(64 810)">
        ${rect(0, 0, 952, 108, 28, c.panel, `stroke="${c.line}" stroke-width="2"`)}
        ${signal(50, 54, c.blue, 12)}
        ${text(["Sleep -> know when to recover"], 84, 69, { size: 33, weight: 850 })}
      </g>
      <g transform="translate(64 958)">
        ${rect(0, 0, 952, 108, 28, c.panel, `stroke="${c.line}" stroke-width="2"`)}
        ${signal(50, 54, c.green, 12)}
        ${text(["Food -> know when to refuel"], 84, 69, { size: 33, weight: 850 })}
      </g>
      <g transform="translate(64 1106)">
        ${rect(0, 0, 952, 108, 28, c.panel, `stroke="${c.line}" stroke-width="2"`)}
        ${signal(50, 54, c.orange, 12)}
        ${text(["Workouts -> know when to push"], 84, 69, { size: 33, weight: 850 })}
      </g>
      ${page(6)}
    `,
  },
  {
    name: "07-cta",
    body: `
      ${header()}
      ${text(["CTA"], 64, 220, { size: 24, fill: c.orange, tracking: 4 })}
      ${text(["The button", "should promise", "the next step."], 64, 390, { size: 88, leading: 96 })}
      <g transform="translate(64 820)">
        ${rect(0, 0, 952, 130, 30, c.panel, `stroke="${c.line}" stroke-width="2"`)}
        ${text(["Weak: Learn more"], 44, 82, { size: 38, weight: 850, fill: c.muted })}
      </g>
      <g transform="translate(64 1010)">
        ${rect(0, 0, 612, 96, 48, "url(#orange)", `filter="url(#shadow)"`)}
        ${text(["Get your daily instruction"], 306, 61, { size: 31, weight: 900, fill: "#101010", anchor: "middle" })}
      </g>
      ${page(7)}
    `,
  },
  {
    name: "08-final",
    body: `
      ${header()}
      ${text(["THE TEST"], 64, 220, { size: 24, fill: c.orange, tracking: 4 })}
      ${text(["Can they", "repeat it", "after one read?"], 64, 390, { size: 92, leading: 100 })}
      ${text(["If yes, your message is clear."], 68, 725, { size: 42, weight: 850, fill: c.muted })}
      <g transform="translate(64 910)">
        ${rect(0, 0, 952, 236, 36, "#111317", `stroke="url(#orange)" stroke-width="3" filter="url(#shadow)"`)}
        ${text(["RoundFit:"], 46, 74, { size: 30, weight: 900, fill: c.orange })}
        ${text(["Stop guessing.", "Know what to do today."], 46, 142, { size: 50, leading: 58 })}
      </g>
      ${page(8)}
    `,
  },
];

for (const slide of slides) {
  fs.writeFileSync(path.join(outDir, `${slide.name}.svg`), shell(slide.body));
}

console.log(slides.map((slide) => path.join(outDir, `${slide.name}.svg`)).join("\n"));
