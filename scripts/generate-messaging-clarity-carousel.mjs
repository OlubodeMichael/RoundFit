import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const outDir = path.join(root, "marketing", "social", "messaging-clarity-carousel");
fs.mkdirSync(outDir, { recursive: true });

const logoPath = "/Users/lacatel/Desktop/Roundfit/splash-icon-dark.png";
const logo = `data:image/png;base64,${fs.readFileSync(logoPath).toString("base64")}`;

const W = 1080;
const H = 1440;
const colors = {
  bg: "#050608",
  panel: "#17181d",
  panel2: "#202126",
  line: "#303137",
  white: "#f7f7f8",
  muted: "#a5a6ad",
  dim: "#6f717a",
  orange: "#ff7446",
  orange2: "#ff9a22",
  green: "#35d39a",
  blue: "#39bdf8",
  purple: "#9b7cff",
};

function esc(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function t(lines, x, y, opts = {}) {
  const {
    size = 64,
    weight = 800,
    fill = colors.white,
    leading = size * 1.12,
    anchor = "start",
    opacity = 1,
    tracking = 0,
  } = opts;

  const content = lines
    .map((line, index) => `<tspan x="${x}" dy="${index === 0 ? 0 : leading}">${esc(line)}</tspan>`)
    .join("");

  return `<text x="${x}" y="${y}" font-family="Inter, Arial, Helvetica, sans-serif" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}" opacity="${opacity}" letter-spacing="${tracking}">${content}</text>`;
}

function rect(x, y, w, h, r, fill, attrs = "") {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}" ${attrs}/>`;
}

function logoMark() {
  return `
    <g>
      <image href="${logo}" x="64" y="54" width="72" height="72" preserveAspectRatio="xMidYMid meet"/>
      ${t(["ROUNDFIT"], 142, 99, { size: 23, weight: 900, tracking: 4 })}
    </g>`;
}

function footer(index) {
  return `
    <g opacity="0.92">
      ${t([String(index).padStart(2, "0")], 64, 1364, { size: 24, weight: 900, fill: colors.dim, tracking: 3 })}
      <line x1="127" y1="1355" x2="1016" y2="1355" stroke="${colors.line}" stroke-width="2"/>
    </g>`;
}

function defs() {
  return `
    <defs>
      <linearGradient id="orange" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="${colors.orange2}"/>
        <stop offset="1" stop-color="${colors.orange}"/>
      </linearGradient>
      <radialGradient id="glow" cx="72%" cy="18%" r="65%">
        <stop offset="0" stop-color="${colors.orange}" stop-opacity="0.36"/>
        <stop offset="1" stop-color="${colors.orange}" stop-opacity="0"/>
      </radialGradient>
      <filter id="shadow" x="-30%" y="-30%" width="160%" height="160%">
        <feDropShadow dx="0" dy="28" stdDeviation="28" flood-color="#000" flood-opacity="0.34"/>
      </filter>
    </defs>`;
}

function shell(body) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
${defs()}
<rect width="${W}" height="${H}" fill="${colors.bg}"/>
<rect width="${W}" height="${H}" fill="url(#glow)"/>
${body}
</svg>`;
}

const slides = [
  {
    name: "01-messaging-clarity",
    body: `
      ${logoMark()}
      ${t(["MESSAGING & CLARITY"], 64, 212, { size: 24, weight: 900, fill: colors.orange, tracking: 4 })}
      ${t(["Make your", "product easier", "to understand."], 64, 330, { size: 92, weight: 900, leading: 99 })}
      ${t(["If people need ten seconds to understand", "what you do, the message is working too hard."], 68, 686, { size: 36, weight: 650, fill: colors.muted, leading: 52 })}
      <g transform="translate(64 900)">
        ${rect(0, 0, 952, 236, 36, colors.panel, `stroke="${colors.line}" stroke-width="2" filter="url(#shadow)"`)}
        ${t(["Clear beats clever."], 46, 82, { size: 52, weight: 900 })}
        ${t(["Say the outcome first. Explain the product second."], 48, 147, { size: 31, weight: 650, fill: colors.muted })}
      </g>
      ${footer(1)}
    `,
  },
  {
    name: "02-feature-vs-benefit",
    body: `
      ${logoMark()}
      ${t(["FEATURE VS BENEFIT"], 64, 212, { size: 24, weight: 900, fill: colors.orange, tracking: 4 })}
      ${t(["Don’t sell", "the feature.", "Sell the change."], 64, 330, { size: 88, weight: 900, leading: 97 })}
      <g transform="translate(64 735)">
        ${rect(0, 0, 952, 170, 32, colors.panel, `stroke="${colors.line}" stroke-width="2"`)}
        ${t(["Feature"], 44, 59, { size: 27, weight: 900, fill: colors.dim, tracking: 2 })}
        ${t(["AI-powered health app"], 44, 118, { size: 42, weight: 850 })}
      </g>
      <g transform="translate(64 940)">
        ${rect(0, 0, 952, 232, 32, "#111317", `stroke="url(#orange)" stroke-width="3" filter="url(#shadow)"`)}
        ${t(["Benefit"], 44, 63, { size: 27, weight: 900, fill: colors.orange, tracking: 2 })}
        ${t(["Know what your body", "needs today."], 44, 126, { size: 52, weight: 900, leading: 58 })}
      </g>
      ${footer(2)}
    `,
  },
  {
    name: "03-rewrite-the-core",
    body: `
      ${logoMark()}
      ${t(["PRACTICAL EXERCISE"], 64, 212, { size: 24, weight: 900, fill: colors.orange, tracking: 4 })}
      ${t(["Rewrite the", "core message."], 64, 330, { size: 94, weight: 900, leading: 103 })}
      <g transform="translate(64 650)">
        ${rect(0, 0, 952, 116, 26, colors.panel, `stroke="${colors.line}" stroke-width="2"`)}
        <circle cx="58" cy="58" r="18" fill="${colors.orange}"/>
        ${t(["Homepage headline"], 100, 70, { size: 38, weight: 850 })}
      </g>
      <g transform="translate(64 804)">
        ${rect(0, 0, 952, 116, 26, colors.panel, `stroke="${colors.line}" stroke-width="2"`)}
        <circle cx="58" cy="58" r="18" fill="${colors.blue}"/>
        ${t(["Subheadline"], 100, 70, { size: 38, weight: 850 })}
      </g>
      <g transform="translate(64 958)">
        ${rect(0, 0, 952, 116, 26, colors.panel, `stroke="${colors.line}" stroke-width="2"`)}
        <circle cx="58" cy="58" r="18" fill="${colors.green}"/>
        ${t(["CTA"], 100, 70, { size: 38, weight: 850 })}
      </g>
      <g transform="translate(64 1112)">
        ${rect(0, 0, 952, 116, 26, colors.panel, `stroke="${colors.line}" stroke-width="2"`)}
        <circle cx="58" cy="58" r="18" fill="${colors.purple}"/>
        ${t(["Feature descriptions"], 100, 70, { size: 38, weight: 850 })}
      </g>
      ${footer(3)}
    `,
  },
  {
    name: "04-roundfit-example",
    body: `
      ${logoMark()}
      ${t(["ROUNDFIT EXAMPLE"], 64, 212, { size: 24, weight: 900, fill: colors.orange, tracking: 4 })}
      ${t(["Say what", "changes for", "the user."], 64, 330, { size: 92, weight: 900, leading: 99 })}
      <g transform="translate(64 705)">
        ${rect(0, 0, 952, 452, 36, colors.panel, `stroke="${colors.line}" stroke-width="2" filter="url(#shadow)"`)}
        ${t(["Headline"], 48, 70, { size: 25, weight: 900, fill: colors.orange, tracking: 3 })}
        ${t(["Know what your body", "needs today."], 48, 145, { size: 55, weight: 900, leading: 62 })}
        <line x1="48" y1="248" x2="904" y2="248" stroke="${colors.line}" stroke-width="2"/>
        ${t(["Subheadline"], 48, 305, { size: 25, weight: 900, fill: colors.dim, tracking: 3 })}
        ${t(["RoundFit turns your health data into", "one clear daily coaching instruction."], 48, 364, { size: 35, weight: 700, fill: colors.muted, leading: 48 })}
      </g>
      <g transform="translate(64 1200)">
        ${rect(0, 0, 438, 86, 43, "url(#orange)")}
        ${t(["Get your daily instruction"], 219, 55, { size: 28, weight: 900, fill: "#111", anchor: "middle" })}
      </g>
      ${footer(4)}
    `,
  },
  {
    name: "05-before-after-headline",
    body: `
      ${logoMark()}
      ${t(["HOMEPAGE HEADLINE"], 64, 212, { size: 24, weight: 900, fill: colors.orange, tracking: 4 })}
      ${t(["Replace vague", "with useful."], 64, 330, { size: 96, weight: 900, leading: 104 })}
      <g transform="translate(64 675)">
        ${rect(0, 0, 952, 210, 34, colors.panel, `stroke="${colors.line}" stroke-width="2"`)}
        ${t(["Before"], 46, 67, { size: 25, weight: 900, fill: colors.dim, tracking: 3 })}
        ${t(["AI-powered health optimization"], 46, 130, { size: 42, weight: 850 })}
      </g>
      <g transform="translate(64 930)">
        ${rect(0, 0, 952, 262, 34, "#111317", `stroke="url(#orange)" stroke-width="3" filter="url(#shadow)"`)}
        ${t(["After"], 46, 67, { size: 25, weight: 900, fill: colors.orange, tracking: 3 })}
        ${t(["Know what your body", "needs today."], 46, 139, { size: 57, weight: 900, leading: 64 })}
      </g>
      ${footer(5)}
    `,
  },
  {
    name: "06-subheadline",
    body: `
      ${logoMark()}
      ${t(["SUBHEADLINE"], 64, 212, { size: 24, weight: 900, fill: colors.orange, tracking: 4 })}
      ${t(["Explain how", "without jargon."], 64, 330, { size: 96, weight: 900, leading: 104 })}
      <g transform="translate(64 704)">
        ${rect(0, 0, 952, 362, 36, colors.panel, `stroke="${colors.line}" stroke-width="2" filter="url(#shadow)"`)}
        ${t(["RoundFit looks at your sleep,", "nutrition, workouts, and recovery", "then gives you one clear next step."], 48, 92, { size: 43, weight: 850, leading: 59 })}
        <line x1="48" y1="262" x2="904" y2="262" stroke="${colors.line}" stroke-width="2"/>
        ${t(["No dashboards. No guessing."], 48, 322, { size: 34, weight: 800, fill: colors.orange })}
      </g>
      ${footer(6)}
    `,
  },
  {
    name: "07-cta",
    body: `
      ${logoMark()}
      ${t(["CTA"], 64, 212, { size: 24, weight: 900, fill: colors.orange, tracking: 4 })}
      ${t(["Ask for", "the next action."], 64, 330, { size: 96, weight: 900, leading: 104 })}
      <g transform="translate(64 695)">
        ${rect(0, 0, 952, 120, 30, colors.panel, `stroke="${colors.line}" stroke-width="2"`)}
        ${t(["Weak: Learn more"], 48, 75, { size: 38, weight: 850, fill: colors.muted })}
      </g>
      <g transform="translate(64 865)">
        ${rect(0, 0, 952, 144, 36, "#111317", `stroke="url(#orange)" stroke-width="3"`)}
        ${t(["Strong: Get your daily instruction"], 48, 88, { size: 40, weight: 900 })}
      </g>
      <g transform="translate(64 1060)">
        ${rect(0, 0, 548, 92, 46, "url(#orange)", `filter="url(#shadow)"`)}
        ${t(["Get your daily instruction"], 274, 59, { size: 29, weight: 900, fill: "#111", anchor: "middle" })}
      </g>
      ${footer(7)}
    `,
  },
  {
    name: "08-feature-descriptions",
    body: `
      ${logoMark()}
      ${t(["FEATURE DESCRIPTIONS"], 64, 212, { size: 24, weight: 900, fill: colors.orange, tracking: 4 })}
      ${t(["Turn features", "into outcomes."], 64, 330, { size: 96, weight: 900, leading: 104 })}
      <g transform="translate(64 646)">
        ${rect(0, 0, 952, 130, 28, colors.panel, `stroke="${colors.line}" stroke-width="2"`)}
        ${t(["Sleep tracking"], 42, 56, { size: 31, weight: 900 })}
        ${t(["Know when to recover."], 42, 101, { size: 28, weight: 700, fill: colors.muted })}
      </g>
      <g transform="translate(64 812)">
        ${rect(0, 0, 952, 130, 28, colors.panel, `stroke="${colors.line}" stroke-width="2"`)}
        ${t(["Nutrition logging"], 42, 56, { size: 31, weight: 900 })}
        ${t(["Know when to refuel."], 42, 101, { size: 28, weight: 700, fill: colors.muted })}
      </g>
      <g transform="translate(64 978)">
        ${rect(0, 0, 952, 130, 28, colors.panel, `stroke="${colors.line}" stroke-width="2"`)}
        ${t(["Workout history"], 42, 56, { size: 31, weight: 900 })}
        ${t(["Know when to push."], 42, 101, { size: 28, weight: 700, fill: colors.muted })}
      </g>
      <g transform="translate(64 1166)">
        ${rect(0, 0, 952, 86, 43, "url(#orange)")}
        ${t(["The outcome is the feature users remember."], 476, 55, { size: 28, weight: 900, fill: "#111", anchor: "middle" })}
      </g>
      ${footer(8)}
    `,
  },
  {
    name: "09-clarity-checklist",
    body: `
      ${logoMark()}
      ${t(["CLARITY CHECKLIST"], 64, 212, { size: 24, weight: 900, fill: colors.orange, tracking: 4 })}
      ${t(["Before you", "post or launch."], 64, 330, { size: 96, weight: 900, leading: 104 })}
      <g transform="translate(64 652)">
        ${rect(0, 0, 952, 520, 36, colors.panel, `stroke="${colors.line}" stroke-width="2" filter="url(#shadow)"`)}
        <circle cx="62" cy="82" r="18" fill="${colors.green}"/>
        ${t(["Can someone understand it in 5 seconds?"], 104, 93, { size: 34, weight: 850 })}
        <circle cx="62" cy="190" r="18" fill="${colors.green}"/>
        ${t(["Does it say the outcome first?"], 104, 201, { size: 34, weight: 850 })}
        <circle cx="62" cy="298" r="18" fill="${colors.green}"/>
        ${t(["Does it avoid technical language?"], 104, 309, { size: 34, weight: 850 })}
        <circle cx="62" cy="406" r="18" fill="${colors.green}"/>
        ${t(["Does the CTA tell them what to do next?"], 104, 417, { size: 34, weight: 850 })}
      </g>
      ${footer(9)}
    `,
  },
  {
    name: "10-final-message",
    body: `
      ${logoMark()}
      ${t(["FINAL MESSAGE"], 64, 212, { size: 24, weight: 900, fill: colors.orange, tracking: 4 })}
      ${t(["People do not", "buy complexity."], 64, 330, { size: 96, weight: 900, leading: 104 })}
      ${t(["They buy the feeling that", "the next step is clear."], 68, 608, { size: 46, weight: 800, fill: colors.muted, leading: 62 })}
      <g transform="translate(64 850)">
        ${rect(0, 0, 952, 230, 36, "#111317", `stroke="url(#orange)" stroke-width="3" filter="url(#shadow)"`)}
        ${t(["For RoundFit:"], 48, 72, { size: 29, weight: 900, fill: colors.orange })}
        ${t(["Stop guessing.", "Know what to do today."], 48, 143, { size: 53, weight: 900, leading: 60 })}
      </g>
      ${footer(10)}
    `,
  },
];

for (const slide of slides) {
  fs.writeFileSync(path.join(outDir, `${slide.name}.svg`), shell(slide.body));
}

console.log(slides.map((slide) => path.join(outDir, `${slide.name}.svg`)).join("\n"));
