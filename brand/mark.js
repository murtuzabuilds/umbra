// The Umbra mark: an eclipse. A dark disc (the shadow you cannot see into) ringed by a
// corona of particles (the light Umbra brings). Particle density falls off with distance,
// like a real corona, and a few particles burn violet: the signals Corona has found.
// Deterministic, so the mark is identical everywhere it is drawn.

export function markSVG({ size = 64, particles = 150, seed = 11, animated = false, id = 'u' } = {}) {
  let s = seed;
  const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const C = 50, R = 24; // centre and disc radius in a 100 box
  const rects = [];
  for (let i = 0; i < particles; i++) {
    const a = r() * Math.PI * 2;
    const falloff = Math.pow(r(), 2.2); // most particles hug the rim
    const d = R + 3 + falloff * 21;
    const x = C + Math.cos(a) * d, y = C + Math.sin(a) * d;
    const sz = (1.9 - falloff * 1.3).toFixed(2);
    const hot = r() < 0.08;
    const op = (0.95 - falloff * 0.75).toFixed(2);
    const tw = animated && r() < 0.45 ? ` class="um-tw" style="animation-delay:-${(r() * 4).toFixed(2)}s;animation-duration:${(2.2 + r() * 3).toFixed(2)}s"` : '';
    rects.push(`<rect x="${(x - sz / 2).toFixed(2)}" y="${(y - sz / 2).toFixed(2)}" width="${sz}" height="${sz}" fill="${hot ? 'var(--plasma,#8B7CFF)' : 'var(--corona,#F5E6C8)'}" opacity="${op}"${tw}/>`);
  }
  const style = animated ? `<style>
    .umbra-mark .um-glow{transform-origin:50px 50px;animation:umBreathe 5s ease-in-out infinite}
    .umbra-mark .um-spin{transform-origin:50px 50px;animation:umSpin 90s linear infinite}
    .umbra-mark .um-spin2{transform-origin:50px 50px;animation:umSpin 140s linear infinite reverse}
    .umbra-mark .um-tw{animation:umTw 3s ease-in-out infinite}
    .umbra-mark .um-orbit{transform-origin:50px 50px;animation:umSpin 7s cubic-bezier(.45,.05,.55,.95) infinite}
    .umbra-mark .um-rim{animation:umRim 5s ease-in-out infinite}
    .umbra-mark:hover .um-spin,.umbra-mark:hover .um-spin2{animation-duration:14s}
    .umbra-mark:hover .um-glow{animation-duration:1.6s}
    @keyframes umSpin{to{transform:rotate(360deg)}}
    @keyframes umBreathe{0%,100%{transform:scale(1);opacity:.85}50%{transform:scale(1.08);opacity:1}}
    @keyframes umTw{0%,100%{opacity:.15}50%{opacity:1}}
    @keyframes umRim{0%,100%{opacity:.75}50%{opacity:1}}
    @media (prefers-reduced-motion: reduce){.umbra-mark *{animation:none!important}}
  </style>` : '';
  const half = Math.ceil(rects.length / 2);
  const ring = animated ? `<g class="um-spin">${rects.slice(0, half).join('')}</g><g class="um-spin2">${rects.slice(half).join('')}</g>` : `<g style="transform-origin:50px 50px">${rects.join('')}</g>`;
  const orbit = animated ? `<g class="um-orbit"><circle cx="50" cy="${50 - R - 1}" r="7" fill="url(#${id}f)"/><circle cx="50" cy="${50 - R - 1}" r="1.3" fill="#FFF8EA"/></g>` : '';
  return `<svg class="umbra-mark" viewBox="0 0 100 100" width="${size}" height="${size}" aria-hidden="true">${style}
  <defs><radialGradient id="${id}g" cx="50%" cy="50%" r="50%"><stop offset="44%" stop-color="var(--corona,#F5E6C8)" stop-opacity=".0"/><stop offset="50%" stop-color="var(--corona,#F5E6C8)" stop-opacity=".55"/><stop offset="62%" stop-color="var(--flare,#FFB347)" stop-opacity=".12"/><stop offset="100%" stop-color="var(--flare,#FFB347)" stop-opacity="0"/></radialGradient>
  <radialGradient id="${id}f"><stop offset="0" stop-color="#FFF8EA"/><stop offset=".35" stop-color="#FFD9A0" stop-opacity=".55"/><stop offset="1" stop-color="#FFB347" stop-opacity="0"/></radialGradient></defs>
  <circle class="${animated ? 'um-glow' : ''}" cx="50" cy="50" r="46" fill="url(#${id}g)"/>
  ${ring}
  <circle class="${animated ? 'um-rim' : ''}" cx="50" cy="50" r="${R + 0.9}" fill="none" stroke="var(--corona,#F5E6C8)" stroke-width="1.1" opacity=".9"/>
  ${orbit}
  <circle cx="50" cy="50" r="${R}" fill="var(--void,#05060A)"/>
</svg>`;
}
