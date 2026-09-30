// The Umbra mark: a total eclipse. A true black disc (the AI a company cannot see into), a corona
// of light bleeding outward (what Umbra reveals), and one diamond-ring flare on the rim (the moment
// something hidden becomes visible). Deterministic, so the mark is identical everywhere it is drawn.
// The animated version of the same mark lives in brand/eclipse.js.

export function markSVG({ size = 64, particles = 150, seed = 11, animated = false, id = 'u' } = {}) {
  let s = seed;
  const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const C = 50, R = 22; // centre and disc radius in a 100 box
  const rays = [], dots = [];
  for (let i = 0; i < 64; i++) {
    const a = r() * Math.PI * 2, len = 4 + r() * 20, w = (0.35 + r() * 0.9).toFixed(2);
    const x0 = C + Math.cos(a) * (R - 0.5), y0 = C + Math.sin(a) * (R - 0.5), x1 = C + Math.cos(a) * (R + len), y1 = C + Math.sin(a) * (R + len);
    rays.push(`<line x1="${x0.toFixed(2)}" y1="${y0.toFixed(2)}" x2="${x1.toFixed(2)}" y2="${y1.toFixed(2)}" stroke-width="${w}"/>`);
  }
  for (let i = 0; i < particles; i++) {
    const a = r() * Math.PI * 2, u = Math.pow(r(), 1.3), d = R + 1 + u * 24;
    const sz = (1.5 - u * 0.9).toFixed(2), k = r();
    const fill = k < 0.07 ? 'var(--plasma,#8B7CFF)' : k < 0.3 ? 'var(--flare,#FFB347)' : 'var(--corona,#F5E6C8)';
    dots.push(`<rect x="${(C + Math.cos(a) * d - sz / 2).toFixed(2)}" y="${(C + Math.sin(a) * d - sz / 2).toFixed(2)}" width="${sz}" height="${sz}" fill="${fill}" opacity="${(0.95 - u * 0.8).toFixed(2)}"/>`);
  }
  const th = -0.85, fx = C + Math.cos(th) * R, fy = C + Math.sin(th) * R, L = 16;
  return `<svg class="umbra-mark" viewBox="0 0 100 100" width="${size}" height="${size}" aria-hidden="true">
  <defs>
    <radialGradient id="${id}h" cx="50" cy="50" r="50" gradientUnits="userSpaceOnUse"><stop offset="${R * 2}%" stop-color="#FFD696" stop-opacity=".55"/><stop offset="62%" stop-color="#FFB347" stop-opacity=".16"/><stop offset="100%" stop-color="#8B7CFF" stop-opacity="0"/></radialGradient>
    <radialGradient id="${id}r" cx="50" cy="50" r="${R + 24}" gradientUnits="userSpaceOnUse"><stop offset="${Math.round(R / (R + 24) * 100)}%" stop-color="#FFF0D7" stop-opacity=".95"/><stop offset="100%" stop-color="#FFB347" stop-opacity="0"/></radialGradient>
    <radialGradient id="${id}c" cx="50" cy="50" r="${R * 1.32}" gradientUnits="userSpaceOnUse"><stop offset="${Math.round(100 / 1.32)}%" stop-color="#FFF6E4"/><stop offset="84%" stop-color="#FFE2B4" stop-opacity=".6"/><stop offset="100%" stop-color="#FFB347" stop-opacity="0"/></radialGradient>
    <radialGradient id="${id}f" cx="${fx.toFixed(2)}" cy="${fy.toFixed(2)}" r="11" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#fff"/><stop offset=".18" stop-color="#FFECC8" stop-opacity=".7"/><stop offset="1" stop-color="#FFC878" stop-opacity="0"/></radialGradient>
  </defs>
  <circle cx="50" cy="50" r="49" fill="url(#${id}h)"/>
  <g class="${animated ? 'corona-spin' : ''}" style="transform-origin:50px 50px"><g stroke="url(#${id}r)" stroke-linecap="round">${rays.join('')}</g>${dots.join('')}</g>
  <circle cx="50" cy="50" r="${R * 1.32}" fill="url(#${id}c)"/>
  <circle cx="${fx.toFixed(2)}" cy="${fy.toFixed(2)}" r="11" fill="url(#${id}f)"/>
  <g stroke="#FFF8E8" stroke-linecap="round" opacity=".85"><line x1="${(fx - L).toFixed(2)}" y1="${fy.toFixed(2)}" x2="${(fx + L).toFixed(2)}" y2="${fy.toFixed(2)}" stroke-width=".7"/><line x1="${fx.toFixed(2)}" y1="${(fy - L).toFixed(2)}" x2="${fx.toFixed(2)}" y2="${(fy + L).toFixed(2)}" stroke-width=".7"/></g>
  <circle cx="50" cy="50" r="${R}" fill="#000"/>
  <circle cx="50" cy="50" r="${R + 0.3}" fill="none" stroke="#FFEECD" stroke-width=".8" opacity=".9"/>
</svg>`;
}
