import { useId, type ReactNode } from 'react';

/** Card artwork for the Tools landing page. Colours come from the design-system tokens, so both themes work. */

const ACCENT = 'var(--dsv2-accent)';
const GREEN = 'var(--dsv2-success)';
const AMBER = 'var(--dsv2-warning)';
const MUTED = 'var(--dsv2-text-tertiary)';
const LINE = 'var(--dsv2-border)';
const INK = 'var(--dsv2-text-primary)';
const PAPER = 'var(--dsv2-bg)';
const PANEL = 'var(--dsv2-surface)';

function Art({ children }: { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 320 140"
      width="100%"
      height="100%"
      preserveAspectRatio="xMidYMid meet"
      aria-hidden
      focusable="false"
    >
      {children}
    </svg>
  );
}

const MONO = 'ui-monospace, monospace';
const SANS = 'system-ui, sans-serif';

export function MaidenheadArt() {
  const clip = useId();
  return (
    <Art>
      <defs>
        <clipPath id={clip}>
          <circle cx="160" cy="150" r="120" />
        </clipPath>
      </defs>
      <circle cx="160" cy="150" r="120" fill={PANEL} stroke={LINE} />
      <g clipPath={`url(#${clip})`} stroke={ACCENT} strokeOpacity={0.35} fill="none">
        {[1, 30, 60, 90].map((rx) => (
          <ellipse key={rx} cx="160" cy="150" rx={rx} ry="120" />
        ))}
        {[50, 80, 110, 140].map((y) => (
          <path key={y} d={`M30 ${y} Q160 ${y - 18} 290 ${y}`} />
        ))}
      </g>
      <path
        d="M160 52 L190 50 L192 78 L161 80 Z"
        fill={ACCENT}
        fillOpacity={0.35}
        stroke={ACCENT}
        strokeWidth={1.5}
      />
      <g transform="translate(176 40)">
        <path d="M0 26 C-10 12 -9 0 0 0 C9 0 10 12 0 26Z" fill={GREEN} />
        <circle cy="9" r="3.5" fill={PAPER} />
      </g>
      <rect x="206" y="22" rx="6" width="70" height="26" fill={PAPER} stroke={LINE} />
      <text
        x="241"
        y="40"
        textAnchor="middle"
        fontFamily={MONO}
        fontSize="14"
        fontWeight="700"
        fill={INK}
      >
        IO85ws
      </text>
    </Art>
  );
}

export function BandPlanArt() {
  const bands: [number, number, string, number, string?][] = [
    [34, 46, ACCENT, 0.75, 'CW'],
    [84, 22, GREEN, 0.75],
    [110, 70, AMBER, 0.7, 'SSB'],
    [184, 30, ACCENT, 0.45],
    [218, 64, GREEN, 0.45, 'FM'],
  ];
  return (
    <Art>
      <line x1="20" y1="96" x2="300" y2="96" stroke={MUTED} />
      {Array.from({ length: 29 }, (_, i) => (
        <line
          key={i}
          x1={20 + i * 10}
          y1="96"
          x2={20 + i * 10}
          y2={i % 5 ? 101 : 106}
          stroke={MUTED}
        />
      ))}
      {bands.map(([x, w, colour, opacity, label]) => (
        <g key={x}>
          <rect x={x} y="62" width={w} height="26" rx="4" fill={colour} fillOpacity={opacity} />
          {label ? (
            <text
              x={x + w / 2}
              y="80"
              textAnchor="middle"
              fontFamily={SANS}
              fontSize="11"
              fontWeight="700"
              fill={PAPER}
            >
              {label}
            </text>
          ) : null}
        </g>
      ))}
      <path d="M150 30 v28" stroke={INK} strokeWidth={2} />
      <path d="M144 30 h12 l-6 8z" fill={INK} />
      <text x="150" y="124" textAnchor="middle" fontFamily={MONO} fontSize="11" fill={MUTED}>
        144.300 MHz
      </text>
    </Art>
  );
}

export function TrackingArt() {
  return (
    <Art>
      {[56, 36, 16].map((r) => (
        <circle key={r} cx="160" cy="70" r={r} fill="none" stroke={ACCENT} strokeOpacity={0.3} />
      ))}
      <path d="M160 14 v112 M104 70 h112" stroke={ACCENT} strokeOpacity={0.25} />
      <path d="M160 70 L200 30 A56 56 0 0 1 216 70 Z" fill={ACCENT} fillOpacity={0.18} />
      <path
        d="M112 102 Q150 20 214 46"
        fill="none"
        stroke={GREEN}
        strokeWidth={2}
        strokeDasharray="4 4"
      />
      <g transform="translate(190 36) rotate(20)">
        <rect x="-5" y="-5" width="10" height="10" fill={INK} />
        <rect x="-19" y="-3" width="12" height="6" fill={ACCENT} />
        <rect x="7" y="-3" width="12" height="6" fill={ACCENT} />
      </g>
      <text x="236" y="116" fontFamily={MONO} fontSize="11" fill={MUTED}>
        AOS 14:02
      </text>
    </Art>
  );
}

export function FirmwareArt() {
  return (
    <Art>
      <g transform="translate(50 28)">
        <rect width="74" height="74" rx="8" fill={PANEL} stroke={ACCENT} strokeWidth={1.5} />
        {[16, 30, 44, 58].map((p) => (
          <path
            key={p}
            d={`M${p} -9 v9 M${p} 74 v9 M-9 ${p} h9 M74 ${p} h9`}
            stroke={ACCENT}
            strokeWidth={2}
          />
        ))}
        <path d="M40 18 l-12 22 h12 l-6 18 l18 -26 h-12 l6 -14z" fill={AMBER} />
      </g>
      <path
        d="M134 65 C170 65 170 92 204 92"
        fill="none"
        stroke={MUTED}
        strokeWidth={3}
        strokeDasharray="1 7"
        strokeLinecap="round"
      />
      <g transform="translate(206 14)">
        <rect x="18" y="-4" width="6" height="22" rx="2" fill={MUTED} />
        <rect width="60" height="112" rx="10" fill={PANEL} stroke={LINE} strokeWidth={1.5} />
        <rect x="8" y="12" width="44" height="28" rx="3" fill={GREEN} fillOpacity={0.18} />
        <text
          x="30"
          y="31"
          textAnchor="middle"
          fontFamily={MONO}
          fontSize="10"
          fontWeight="700"
          fill={GREEN}
        >
          MM9PDY
        </text>
        {[0, 1, 2].flatMap((r) =>
          [0, 1, 2].map((c) => (
            <rect
              key={`${r}-${c}`}
              x={10 + c * 15}
              y={50 + r * 14}
              width="11"
              height="9"
              rx="2"
              fill={LINE}
            />
          )),
        )}
      </g>
      <rect x="50" y="118" width="74" height="6" rx="3" fill={LINE} />
      <rect x="50" y="118" width="48" height="6" rx="3" fill={GREEN} />
    </Art>
  );
}

export function PropagationArt() {
  return (
    <Art>
      <path d="M0 130 Q160 80 320 130 V140 H0Z" fill={ACCENT} fillOpacity={0.12} />
      <path d="M0 130 Q160 80 320 130" fill="none" stroke={ACCENT} strokeOpacity={0.6} />
      <path
        d="M-10 60 Q160 -10 330 60"
        fill="none"
        stroke={AMBER}
        strokeOpacity={0.35}
        strokeWidth={10}
      />
      <path
        d="M40 116 L100 46 L160 104 L220 46 L280 116"
        fill="none"
        stroke={GREEN}
        strokeWidth={2}
      />
      <circle cx="40" cy="116" r="4" fill={INK} />
      <circle cx="280" cy="116" r="4" fill={INK} />
      <text x="300" y="24" textAnchor="end" fontFamily={SANS} fontSize="10" fill={AMBER}>
        F2 layer
      </text>
    </Art>
  );
}
