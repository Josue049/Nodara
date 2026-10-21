import { useId } from "react";

// Estrellas en posiciones fijas (generador lineal congruente con semilla): el dibujo es idéntico en servidor y cliente.
const STARS = (() => {
  let s = 7;
  const rnd = () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
  return Array.from({ length: 70 }, () => ({ x: rnd() * 1200, y: rnd() * 150, r: 0.4 + rnd() * 1.1, o: 0.35 + rnd() * 0.6 }));
})();

const v = (name: string) => `var(--banner-${name})`;

/**
 * Panorámica de montañas (ilustración propia en SVG, sin imágenes externas). Decorativa.
 * Los colores salen de los tokens `--banner-*` de globals.css: paisaje diurno en tema claro y nocturno en oscuro,
 * con la misma composición (cielo, halo, astro, estrellas, cuatro cordilleras y niebla).
 */
export function MountainBanner({ className }: { className?: string }) {
  const id = useId();
  const u = (k: string) => `url(#${id}-${k})`;
  return (
    <svg viewBox="0 0 1200 300" preserveAspectRatio="xMidYMid slice" className={className} aria-hidden focusable="false" data-testid="home-banner-art">
      <defs>
        <linearGradient id={`${id}-sky`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" style={{ stopColor: v("sky-1") }} />
          <stop offset="0.55" style={{ stopColor: v("sky-2") }} />
          <stop offset="1" style={{ stopColor: v("sky-3") }} />
        </linearGradient>
        <radialGradient id={`${id}-glow`} cx="0.74" cy="0.5" r="0.45">
          <stop offset="0" style={{ stopColor: v("glow"), stopOpacity: v("glow-opacity") }} />
          <stop offset="1" style={{ stopColor: v("glow"), stopOpacity: 0 }} />
        </radialGradient>
        <linearGradient id={`${id}-far`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" style={{ stopColor: v("far-1") }} />
          <stop offset="1" style={{ stopColor: v("far-2") }} />
        </linearGradient>
        <linearGradient id={`${id}-mid`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" style={{ stopColor: v("mid-1") }} />
          <stop offset="1" style={{ stopColor: v("mid-2") }} />
        </linearGradient>
        <linearGradient id={`${id}-mist`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" style={{ stopColor: v("mist"), stopOpacity: 0 }} />
          <stop offset="1" style={{ stopColor: v("mist"), stopOpacity: v("mist-opacity") }} />
        </linearGradient>
      </defs>
      <rect width="1200" height="300" fill={u("sky")} />
      <rect width="1200" height="300" fill={u("glow")} />
      <g style={{ opacity: v("star-opacity") }}>
        {STARS.map((st, i) => (
          <circle key={i} cx={st.x} cy={st.y} r={st.r} style={{ fill: v("star") }} opacity={st.o} />
        ))}
      </g>
      <circle cx="890" cy="92" r="34" style={{ fill: v("orb-halo") }} opacity="0.18" />
      <circle cx="890" cy="92" r="22" style={{ fill: v("orb") }} />
      <path d="M0 190 80 150 140 170 230 108 300 150 380 122 460 160 540 102 620 150 700 124 790 165 880 112 960 150 1050 118 1130 155 1200 134V300H0Z" fill={u("far")} />
      <rect y="130" width="1200" height="90" fill={u("mist")} />
      <path d="M0 222 90 182 170 210 260 160 340 200 430 170 520 214 610 176 700 205 800 160 890 200 980 176 1080 214 1200 180V300H0Z" fill={u("mid")} />
      <path d="M0 256 120 216 220 246 330 210 450 250 560 226 680 258 790 222 900 250 1010 228 1120 255 1200 236V300H0Z" style={{ fill: v("near") }} />
      <path d="M0 284 160 262 320 280 500 266 680 286 860 268 1040 284 1200 270V300H0Z" style={{ fill: v("front") }} />
    </svg>
  );
}
