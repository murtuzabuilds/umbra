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
    rects.push(`<rect x="${(x - sz / 2).toFixed(2)}" y="${(y - sz / 2).toFixed(2)}" width="${sz}" height="${sz}" fill="${hot ? 'var(--plasma,#8B7CFF)' : 'var(--corona,#F5E6C8)'}" opacity="${op}"/>`);
  }
  return `<svg class="umbra-mark" viewBox="0 0 100 100" width="${size}" height="${size}" aria-hidden="true">
  <defs><radialGradient id="${id}g" cx="50%" cy="50%" r="50%"><stop offset="44%" stop-color="var(--corona,#F5E6C8)" stop-opacity=".0"/><stop offset="50%" stop-color="var(--corona,#F5E6C8)" stop-opacity=".55"/><stop offset="62%" stop-color="var(--flare,#FFB347)" stop-opacity=".12"/><stop offset="100%" stop-color="var(--flare,#FFB347)" stop-opacity="0"/></radialGradient></defs>
  <circle cx="50" cy="50" r="46" fill="url(#${id}g)"/>
  <g class="${animated ? 'corona-spin' : ''}" style="transform-origin:50px 50px">${rects.join('')}</g>
  <circle cx="50" cy="50" r="${R + 0.9}" fill="none" stroke="var(--corona,#F5E6C8)" stroke-width="1.1" opacity=".9"/>
  <circle cx="50" cy="50" r="${R}" fill="var(--void,#05060A)"/>
</svg>`;
}
