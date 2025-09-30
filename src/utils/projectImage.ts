// simple deterministic SVG image generator based on project name
// returns a data URL for an SVG with gradient and center initial

function hashString(str: string): string {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    // same mixing used previously
    h += (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24);
  }
  return (h >>> 0).toString(16);
}

function pickColors(seed: string): [string, string] {
  const base = parseInt(seed.slice(-6).padStart(6, "0"), 16);
  const c1 = (base & 0xffffff).toString(16).padStart(6, "0");
  const c2 = ((~base) & 0xffffff).toString(16).padStart(6, "0").slice(0, 6);
  return [`#${c1}`, `#${c2}`];
}

export function generateSVGDataURL(name = "Project", w = 800, h = 480): string {
  const seed = hashString(name);
  const [c1, c2] = pickColors(seed);
  const initials = (name
    .split(" ")
    .map((s) => (s ? s[0] : ""))
    .slice(0, 2)
    .join("") || "P"
  ).toUpperCase();

  const svg = `
  <svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}' viewBox="0 0 ${w} ${h}">
    <defs>
      <linearGradient id="g" x1="0" x2="1" y1="0" y2="1">
        <stop offset="0" stop-color="${c1}" stop-opacity="1"/>
        <stop offset="1" stop-color="${c2}" stop-opacity="1"/>
      </linearGradient>
    </defs>
    <rect width="100%" height="100%" fill="url(#g)" rx="18" />
    <g fill="rgba(255,255,255,0.08)">
      <circle cx="${w * 0.2}" cy="${h * 0.25}" r="${Math.min(w,h) * 0.18}" />
      <circle cx="${w * 0.85}" cy="${h * 0.7}" r="${Math.min(w,h) * 0.12}" />
    </g>
    <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle"
      font-family="Inter, System-ui, -apple-system, Roboto, 'Segoe UI', sans-serif"
      font-size="${Math.round(Math.min(w,h) / 6)}"
      fill="white" opacity="0.95">${initials}</text>
  </svg>`.trim();

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
