import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const outDir = path.join(root, "marketing", "social", "roundfit-clarity-carousel");
fs.mkdirSync(outDir, { recursive: true });

const logoPath = "/Users/lacatel/Desktop/Roundfit/splash-icon-dark.png";
const logo = `data:image/png;base64,${fs.readFileSync(logoPath).toString("base64")}`;

const W = 1080;
const H = 1440;
const C = {
  bg: "#050608",
  white: "#f7f7f8",
  muted: "#a7a8af",
  dim: "#6f717a",
  panel: "#15161b",
  line: "#2b2d35",
  orange: "#ff7446",
  orange2: "#ff9a22",
  green: "#36d49a",
  blue: "#35bdf7",
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
    size = 80,
    weight = 900,
    fill = C.white,
    leading = size * 1.08,
    anchor = "start",
    opacity = 1,
    tracking = 0,
  } = opts;
  return `<text x="${x}" y="${y}" font-family="Inter, Arial, Helvetica, sans-serif" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}" opacity="${opacity}" letter-spacing="${tracking}">${lines
    .map((line, index) => `<tspan x="${x}" dy="${index === 0 ? 0 : leading}">${esc(line)}</tspan>`)
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

function footer(n) {
  return `
    <text x="64" y="1370" font-family="Inter, Arial, Helvetica, sans-serif" font-size="22" font-weight="900" fill="${C.dim}" letter-spacing="4">${String(n).padStart(2, "0")}</text>
    <line x1="128" y1="1362" x2="1016" y2="1362" stroke="${C.line}" stroke-width="2"/>`;
}

function pill(label, x, y, color = C.orange) {
  return `
    <g transform="translate(${x} ${y})">
      ${rect(0, 0, 254, 70, 35, color)}
      ${text([label], 127, 45, { size: 27, weight: 900, fill: "#101010", anchor: "middle" })}
    </g>`;
}

function defs() {
  return `
    <defs>
      <linearGradient id="orange" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="${C.orange2}"/>
        <stop offset="1" stop-color="${C.orange}"/>
      </linearGradient>
      <radialGradient id="glow" cx="74%" cy="14%" r="70%">
        <stop offset="0" stop-color="${C.orange}" stop-opacity="0.38"/>
        <stop offset="1" stop-color="${C.orange}" stop-opacity="0"/>
      </radialGradient>
      <radialGradient id="lowglow" cx="48%" cy="82%" r="62%">
        <stop offset="0" stop-color="${C.orange}" stop-opacity="0.18"/>
        <stop offset="1" stop-color="${C.orange}" stop-opacity="0"/>
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
<rect width="${W}" height="${H}" fill="${C.bg}"/>
<rect width="${W}" height="${H}" fill="url(#glow)"/>
<rect width="${W}" height="${H}" fill="url(#lowglow)"/>
${body}
</svg>`;
}

const slides = [
  {
    name: "01-stop-guessing",
    body: `
      ${header()}
      ${text(["YOU TRACK EVERYTHING"], 64, 220, { size: 24, fill: C.orange, tracking: 4 })}
      ${text(["But what", "should you", "do today?"], 64, 390, { size: 100, leading: 108 })}
      ${text(["RoundFit turns your health data into", "one clear daily coaching instruction."], 68, 800, { size: 37, weight: 750, fill: C.muted, leading: 54 })}
      <g transform="translate(64 1045)">
        ${rect(0, 0, 952, 150, 38, "#111317", `stroke="url(#orange)" stroke-width="3" filter="url(#shadow)"`)}
        ${text(["Know what your body needs today."], 476, 91, { size: 38, weight: 900, anchor: "middle" })}
      </g>
      ${footer(1)}
    `,
  },
  {
    name: "02-data-isnt-clarity",
    body: `
      ${header()}
      ${text(["THE PROBLEM"], 64, 220, { size: 24, fill: C.orange, tracking: 4 })}
      ${text(["More data", "doesn't mean", "more clarity."], 64, 390, { size: 92, leading: 100 })}
      <g transform="translate(64 810)">
        ${rect(0, 0, 952, 294, 38, C.panel, `stroke="${C.line}" stroke-width="2" filter="url(#shadow)"`)}
        ${text(["Sleep score.", "Calories.", "Workout load.", "Recovery."], 48, 80, { size: 42, weight: 850, fill: C.muted, leading: 56 })}
        ${text(["Now what?"], 682, 238, { size: 56, weight: 900, fill: C.orange })}
      </g>
      ${footer(2)}
    `,
  },
  {
    name: "03-one-instruction",
    body: `
      ${header()}
      ${text(["THE ROUNDFIT WAY"], 64, 220, { size: 24, fill: C.orange, tracking: 4 })}
      ${text(["One daily", "instruction.", "No guessing."], 64, 390, { size: 94, leading: 102 })}
      <g transform="translate(64 860)">
        ${rect(0, 0, 952, 228, 40, "#111317", `stroke="url(#orange)" stroke-width="3" filter="url(#shadow)"`)}
        ${text(["Today:"], 52, 74, { size: 31, weight: 900, fill: C.orange })}
        ${text(["Keep it light."], 52, 154, { size: 68, weight: 900 })}
      </g>
      ${text(["Personalized to your body, goal, and week."], 68, 1190, { size: 32, weight: 750, fill: C.muted })}
      ${footer(3)}
    `,
  },
  {
    name: "04-push-recover-refuel",
    body: `
      ${header()}
      ${text(["YOUR NEXT MOVE"], 64, 220, { size: 24, fill: C.orange, tracking: 4 })}
      ${text(["Push.", "Recover.", "Refuel."], 64, 390, { size: 106, leading: 116 })}
      <g transform="translate(64 900)">
        ${pill("PUSH", 0, 0, C.orange)}
        ${pill("RECOVER", 342, 0, C.white)}
        ${pill("REFUEL", 684, 0, C.orange)}
      </g>
      ${text(["RoundFit helps you choose the right one."], 68, 1135, { size: 36, weight: 800, fill: C.muted })}
      ${footer(4)}
    `,
  },
  {
    name: "05-sleep-benefit",
    body: `
      ${header()}
      ${text(["SLEEP"], 64, 220, { size: 24, fill: C.blue, tracking: 4 })}
      ${text(["Don't just", "track sleep.", "Use it."], 64, 390, { size: 96, leading: 104 })}
      <g transform="translate(64 860)">
        ${rect(0, 0, 952, 232, 38, C.panel, `stroke="${C.line}" stroke-width="2" filter="url(#shadow)"`)}
        ${text(["Low sleep + high training load"], 48, 80, { size: 36, weight: 850, fill: C.muted })}
        ${text(["Recover today."], 48, 162, { size: 62, weight: 900 })}
      </g>
      ${footer(5)}
    `,
  },
  {
    name: "06-nutrition-benefit",
    body: `
      ${header()}
      ${text(["NUTRITION"], 64, 220, { size: 24, fill: C.green, tracking: 4 })}
      ${text(["Don't just", "log food.", "Act on it."], 64, 390, { size: 96, leading: 104 })}
      <g transform="translate(64 860)">
        ${rect(0, 0, 952, 232, 38, C.panel, `stroke="${C.line}" stroke-width="2" filter="url(#shadow)"`)}
        ${text(["Under-eating + workout planned"], 48, 80, { size: 36, weight: 850, fill: C.muted })}
        ${text(["Refuel first."], 48, 162, { size: 62, weight: 900 })}
      </g>
      ${footer(6)}
    `,
  },
  {
    name: "07-connected-signals",
    body: `
      ${header()}
      ${text(["CONNECTED SIGNALS"], 64, 220, { size: 24, fill: C.orange, tracking: 4 })}
      ${text(["Your body", "doesn't work", "in separate apps."], 64, 390, { size: 92, leading: 100 })}
      <g transform="translate(64 865)">
        ${rect(0, 0, 952, 250, 40, C.panel, `stroke="${C.line}" stroke-width="2" filter="url(#shadow)"`)}
        ${text(["Sleep  •  Nutrition  •  Workouts  •  Recovery"], 476, 98, { size: 32, weight: 900, fill: C.muted, anchor: "middle" })}
        <line x1="174" y1="143" x2="778" y2="143" stroke="url(#orange)" stroke-width="6" stroke-linecap="round"/>
        <circle cx="476" cy="143" r="22" fill="url(#orange)"/>
      </g>
      ${footer(7)}
    `,
  },
  {
    name: "08-cta",
    body: `
      ${header()}
      ${text(["ROUNDFIT"], 64, 220, { size: 24, fill: C.orange, tracking: 4 })}
      ${text(["Stop", "collecting", "confusion."], 64, 390, { size: 100, leading: 108 })}
      ${text(["Turn your health data into", "a decision you can trust."], 68, 770, { size: 40, weight: 800, fill: C.muted, leading: 58 })}
      <g transform="translate(64 1040)">
        ${rect(0, 0, 604, 98, 49, "url(#orange)", `filter="url(#shadow)"`)}
        ${text(["Get your daily instruction"], 302, 62, { size: 31, weight: 900, fill: "#101010", anchor: "middle" })}
      </g>
      ${footer(8)}
    `,
  },
];

for (const slide of slides) {
  fs.writeFileSync(path.join(outDir, `${slide.name}.svg`), shell(slide.body));
}

console.log(slides.map((slide) => path.join(outDir, `${slide.name}.svg`)).join("\n"));
