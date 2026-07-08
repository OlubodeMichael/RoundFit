import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const outDir = path.join(root, "marketing", "social");
fs.mkdirSync(outDir, { recursive: true });

const darkLogoPath = "/Users/lacatel/Desktop/Roundfit/ios-dark.png";
const lightLogoPath = "/Users/lacatel/Desktop/Roundfit/ios-light.png";
const darkLogo = `data:image/png;base64,${fs.readFileSync(darkLogoPath).toString("base64")}`;
const lightLogo = `data:image/png;base64,${fs.readFileSync(lightLogoPath).toString("base64")}`;

const W = 1080;
const H = 1080;
const orange = "#ff870f";
const orange2 = "#ffad32";
const black = "#050505";
const ink = "#111111";
const white = "#ffffff";
const bone = "#f7f3eb";
const gray = "#8f8f8f";
const green = "#45d483";
const red = "#ff625c";
const blue = "#62a8ff";

function esc(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function text(lines, x, y, opts = {}) {
  const {
    size = 54,
    weight = 800,
    fill = white,
    leading = size * 1.08,
    family = "Inter, Arial, Helvetica, sans-serif",
    anchor = "start",
    opacity = 1,
    tracking = 0,
  } = opts;

  const tspans = lines
    .map((line, index) => {
      const dy = index === 0 ? 0 : leading;
      return `<tspan x="${x}" dy="${index === 0 ? 0 : dy}">${esc(line)}</tspan>`;
    })
    .join("");

  return `<text x="${x}" y="${y}" font-family="${family}" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}" opacity="${opacity}" letter-spacing="${tracking}">${tspans}</text>`;
}

function logo(href, x, y, size, opacity = 1) {
  return `<image href="${href}" x="${x}" y="${y}" width="${size}" height="${size}" opacity="${opacity}" preserveAspectRatio="xMidYMid meet"/>`;
}

function roundedRect(x, y, w, h, r, fill, extra = "") {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}" ${extra}/>`;
}

function noise(opacity = 0.16) {
  return `
  <filter id="grain">
    <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="3" stitchTiles="stitch"/>
    <feColorMatrix type="saturate" values="0"/>
    <feComponentTransfer><feFuncA type="table" tableValues="0 ${opacity}"/></feComponentTransfer>
  </filter>
  <rect width="1080" height="1080" filter="url(#grain)" opacity="0.35"/>`;
}

function writeSvg(name, body) {
  const file = path.join(outDir, `${name}.svg`);
  fs.writeFileSync(file, body.trimStart());
  return file;
}

function shell(name, bg = black, defs = "") {
  return (content) => `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<defs>
  <linearGradient id="orangeGlow" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="${orange2}"/>
    <stop offset="1" stop-color="${orange}"/>
  </linearGradient>
  <radialGradient id="softOrange" cx="72%" cy="20%" r="58%">
    <stop offset="0" stop-color="${orange}" stop-opacity="0.42"/>
    <stop offset="1" stop-color="${orange}" stop-opacity="0"/>
  </radialGradient>
  <filter id="shadow" x="-30%" y="-30%" width="160%" height="160%">
    <feDropShadow dx="0" dy="24" stdDeviation="24" flood-color="#000000" flood-opacity="0.28"/>
  </filter>
  ${defs}
</defs>
<rect width="${W}" height="${H}" fill="${bg}"/>
${content}
</svg>`;
}

const files = [];

files.push(writeSvg("01-stop-guessing", shell("01")(`
  <rect width="${W}" height="${H}" fill="${black}"/>
  <rect width="${W}" height="${H}" fill="url(#softOrange)"/>
  ${noise(0.12)}
  ${logo(darkLogo, 70, 62, 84)}
  ${text(["ROUNDFIT"], 164, 114, { size: 30, weight: 900, tracking: 4 })}
  ${text(["Stop guessing", "what your body", "needs today."], 70, 245, { size: 83, leading: 91, weight: 900 })}
  ${text(["RoundFit turns sleep, nutrition,", "workouts, and recovery into", "one clear daily instruction."], 74, 548, { size: 33, leading: 45, weight: 650, fill: "#d6d6d6" })}
  <g transform="translate(70 735)">
    ${roundedRect(0, 0, 940, 224, 32, "#121212", `stroke="#2b2b2b" stroke-width="2" filter="url(#shadow)"`)}
    ${text(["TODAY'S MOVE"], 42, 56, { size: 24, weight: 900, fill: orange, tracking: 3 })}
    ${text(["Recover + refuel"], 42, 128, { size: 62, weight: 900 })}
    ${text(["Your sleep is low and yesterday's load was high."], 46, 181, { size: 28, weight: 650, fill: "#bdbdbd" })}
    <circle cx="847" cy="112" r="46" fill="url(#orangeGlow)"/>
    <path d="M827 111l15 16 30-36" fill="none" stroke="#111" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>
  </g>
`)));

files.push(writeSvg("02-from-dashboard-to-decision", shell("02", bone)(`
  <rect width="${W}" height="${H}" fill="${bone}"/>
  <circle cx="888" cy="139" r="250" fill="${orange}" opacity="0.14"/>
  ${logo(lightLogo, 72, 60, 86)}
  ${text(["FROM DASHBOARD"], 72, 198, { size: 36, weight: 900, fill: ink, tracking: 3 })}
  ${text(["to decision."], 72, 303, { size: 112, weight: 900, fill: ink })}
  <g transform="translate(72 422)">
    ${roundedRect(0, 0, 286, 286, 30, white, `stroke="#e5dfd3" stroke-width="2"`)}
    ${text(["Sleep"], 34, 64, { size: 29, weight: 800, fill: ink })}
    ${text(["5h 41m"], 34, 139, { size: 54, weight: 900, fill: ink })}
    ${text(["Low recovery"], 34, 194, { size: 26, weight: 700, fill: gray })}
    <path d="M34 230C82 190 116 249 161 214S230 192 252 148" fill="none" stroke="${blue}" stroke-width="9" stroke-linecap="round"/>
  </g>
  <g transform="translate(397 422)">
    ${roundedRect(0, 0, 286, 286, 30, white, `stroke="#e5dfd3" stroke-width="2"`)}
    ${text(["Workout"], 34, 64, { size: 29, weight: 800, fill: ink })}
    ${text(["High"], 34, 139, { size: 58, weight: 900, fill: ink })}
    ${text(["Load yesterday"], 34, 194, { size: 26, weight: 700, fill: gray })}
    <circle cx="208" cy="210" r="46" fill="${orange}" opacity="0.18"/>
    <circle cx="208" cy="210" r="29" fill="${orange}"/>
  </g>
  <g transform="translate(722 422)">
    ${roundedRect(0, 0, 286, 286, 30, white, `stroke="#e5dfd3" stroke-width="2"`)}
    ${text(["Nutrition"], 34, 64, { size: 29, weight: 800, fill: ink })}
    ${text(["-32g"], 34, 139, { size: 58, weight: 900, fill: ink })}
    ${text(["Protein gap"], 34, 194, { size: 26, weight: 700, fill: gray })}
    <path d="M202 176v70M167 211h70" stroke="${red}" stroke-width="11" stroke-linecap="round"/>
  </g>
  <g transform="translate(72 778)">
    ${roundedRect(0, 0, 936, 178, 34, ink, `filter="url(#shadow)"`)}
    ${text(["One instruction:"], 48, 68, { size: 31, weight: 850, fill: orange })}
    ${text(["Easy session. Add protein."], 48, 131, { size: 58, weight: 900 })}
  </g>
`)));

files.push(writeSvg("03-push-recover-refuel", shell("03")(`
  <rect width="${W}" height="${H}" fill="${black}"/>
  <path d="M0 838C260 705 458 706 684 785C830 836 959 826 1080 742V1080H0Z" fill="${orange}" opacity="0.96"/>
  ${noise(0.11)}
  ${logo(darkLogo, 72, 58, 82)}
  ${text(["Push,", "recover,", "or refuel?"], 72, 230, { size: 104, leading: 108, weight: 900 })}
  ${text(["RoundFit reads the signals together,", "so your next move is obvious."], 76, 575, { size: 34, leading: 47, weight: 650, fill: "#d9d9d9" })}
  <g transform="translate(78 704)">
    ${roundedRect(0, 0, 274, 160, 28, "#ffffff", `opacity="0.14"`)}
    ${text(["PUSH"], 137, 65, { size: 32, weight: 950, fill: white, anchor: "middle", tracking: 2 })}
    ${text(["when ready"], 137, 111, { size: 25, weight: 700, fill: "#f7e0c5", anchor: "middle" })}
  </g>
  <g transform="translate(403 704)">
    ${roundedRect(0, 0, 274, 160, 28, "#ffffff", `opacity="0.92"`)}
    ${text(["RECOVER"], 137, 65, { size: 32, weight: 950, fill: ink, anchor: "middle", tracking: 2 })}
    ${text(["when loaded"], 137, 111, { size: 25, weight: 700, fill: "#555", anchor: "middle" })}
  </g>
  <g transform="translate(728 704)">
    ${roundedRect(0, 0, 274, 160, 28, "#ffffff", `opacity="0.14"`)}
    ${text(["REFUEL"], 137, 65, { size: 32, weight: 950, fill: white, anchor: "middle", tracking: 2 })}
    ${text(["when depleted"], 137, 111, { size: 25, weight: 700, fill: "#f7e0c5", anchor: "middle" })}
  </g>
  ${text(["KNOW WHAT YOUR BODY NEEDS TODAY"], 540, 983, { size: 28, weight: 900, fill: ink, anchor: "middle", tracking: 2 })}
`)));

files.push(writeSvg("04-mixed-signals", shell("04", "#0b0b0b")(`
  <rect width="${W}" height="${H}" fill="#0b0b0b"/>
  <rect x="42" y="42" width="996" height="996" rx="48" fill="#101010" stroke="#262626" stroke-width="2"/>
  ${logo(darkLogo, 75, 75, 72)}
  ${text(["Mixed signals", "should not mean", "mixed decisions."], 75, 244, { size: 78, leading: 88, weight: 900 })}
  <g transform="translate(75 572)">
    ${roundedRect(0, 0, 930, 86, 22, "#181818", `stroke="#2e2e2e" stroke-width="2"`)}
    <circle cx="44" cy="43" r="14" fill="${green}"/>
    ${text(["Great workout yesterday"], 83, 54, { size: 31, weight: 800, fill: "#eeeeee" })}
    ${text(["+",], 875, 54, { size: 35, weight: 900, fill: green, anchor: "middle" })}
  </g>
  <g transform="translate(75 682)">
    ${roundedRect(0, 0, 930, 86, 22, "#181818", `stroke="#2e2e2e" stroke-width="2"`)}
    <circle cx="44" cy="43" r="14" fill="${red}"/>
    ${text(["Poor sleep"], 83, 54, { size: 31, weight: 800, fill: "#eeeeee" })}
    ${text(["-",], 875, 54, { size: 35, weight: 900, fill: red, anchor: "middle" })}
  </g>
  <g transform="translate(75 792)">
    ${roundedRect(0, 0, 930, 86, 22, "#181818", `stroke="#2e2e2e" stroke-width="2"`)}
    <circle cx="44" cy="43" r="14" fill="${orange}"/>
    ${text(["Low HRV"], 83, 54, { size: 31, weight: 800, fill: "#eeeeee" })}
    ${text(["?"], 875, 54, { size: 35, weight: 900, fill: orange, anchor: "middle" })}
  </g>
  <g transform="translate(75 912)">
    ${roundedRect(0, 0, 930, 82, 24, "url(#orangeGlow)")}
    ${text(["RoundFit: recover today."], 465, 53, { size: 36, weight: 950, fill: ink, anchor: "middle" })}
  </g>
`)));

files.push(writeSvg("05-cycle-aware", shell("05", bone)(`
  <rect width="${W}" height="${H}" fill="${bone}"/>
  <path d="M0 0H1080V374C860 452 698 434 520 365C336 294 164 315 0 400Z" fill="${black}"/>
  ${logo(darkLogo, 72, 62, 78)}
  ${text(["Your body is not", "the same every day."], 72, 212, { size: 77, leading: 88, weight: 900 })}
  ${text(["Your coaching should not be either."], 76, 410, { size: 34, weight: 750, fill: ink })}
  <g transform="translate(90 525)">
    <circle cx="180" cy="180" r="166" fill="none" stroke="#dfd5c8" stroke-width="22"/>
    <path d="M180 14a166 166 0 0 1 156 110" fill="none" stroke="${orange}" stroke-width="22" stroke-linecap="round"/>
    <path d="M336 124a166 166 0 0 1-46 182" fill="none" stroke="${red}" stroke-width="22" stroke-linecap="round"/>
    <path d="M290 306a166 166 0 0 1-214-4" fill="none" stroke="${blue}" stroke-width="22" stroke-linecap="round"/>
    <circle cx="180" cy="180" r="104" fill="${white}" stroke="#eadfce" stroke-width="2"/>
    ${text(["Cycle-aware"], 180, 168, { size: 29, weight: 900, fill: ink, anchor: "middle" })}
    ${text(["guidance"], 180, 209, { size: 29, weight: 900, fill: ink, anchor: "middle" })}
  </g>
  <g transform="translate(520 532)">
    ${roundedRect(0, 0, 430, 116, 26, white, `stroke="#e5dfd3" stroke-width="2"`)}
    ${text(["Training"], 34, 48, { size: 25, weight: 850, fill: gray })}
    ${text(["Lower intensity"], 34, 91, { size: 35, weight: 920, fill: ink })}
    ${roundedRect(0, 148, 430, 116, 26, white, `stroke="#e5dfd3" stroke-width="2"`)}
    ${text(["Nutrition"], 34, 196, { size: 25, weight: 850, fill: gray })}
    ${text(["Increase iron-rich foods"], 34, 239, { size: 34, weight: 920, fill: ink })}
    ${roundedRect(0, 296, 430, 116, 26, white, `stroke="#e5dfd3" stroke-width="2"`)}
    ${text(["Recovery"], 34, 344, { size: 25, weight: 850, fill: gray })}
    ${text(["Protect sleep window"], 34, 387, { size: 34, weight: 920, fill: ink })}
  </g>
  ${text(["PERSONALIZED TO YOUR BODY, GOAL, AND WEEK"], 540, 1011, { size: 24, weight: 900, fill: ink, anchor: "middle", tracking: 2 })}
`)));

console.log(files.join("\n"));
