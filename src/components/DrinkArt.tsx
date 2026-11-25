import { cn } from "@/lib/format";

type Palette = {
  bg: string;
  glow: string;
  top: string;
  bottom: string;
  foam: string;
  accent: string;
};

const PALETTES: Palette[] = [
  {
    bg: "#f6e7c5",
    glow: "#c56b45",
    top: "#c98a56",
    bottom: "#7b4529",
    foam: "#fff4e2",
    accent: "#a85331",
  },
  {
    bg: "#e7efe6",
    glow: "#617f66",
    top: "#9dbb84",
    bottom: "#4f7357",
    foam: "#f3f8ec",
    accent: "#3f5d47",
  },
  {
    bg: "#fde8d2",
    glow: "#e5b45a",
    top: "#f5c06a",
    bottom: "#d9853d",
    foam: "#fff6e6",
    accent: "#b46a26",
  },
  {
    bg: "#f5e3e7",
    glow: "#c4697e",
    top: "#e89aa7",
    bottom: "#a84e67",
    foam: "#fff2f4",
    accent: "#8e3f55",
  },
  {
    bg: "#e4eef1",
    glow: "#6d9bab",
    top: "#a2cfd8",
    bottom: "#4d8796",
    foam: "#f2fafb",
    accent: "#376c7b",
  },
];

type Kind = "coffee" | "tea" | "fruit" | "creamy" | "sparkling" | "water" | "beer";

const KINDS: Array<{ kind: Kind; pattern: RegExp }> = [
  { kind: "coffee", pattern: /cà phê|coffee|espresso|latte|americano|bạc xỉu|bạc sỉu|mocha|cappuccino/i },
  { kind: "tea", pattern: /trà|tea|matcha|oolong|jasmine|chai|sen/i },
  { kind: "beer", pattern: /bia|beer|tiger|heineken|lager/i },
  { kind: "water", pattern: /nước suối|water|lavie|aquafina|khoáng/i },
  { kind: "sparkling", pattern: /soda|bubble|trân châu|mật ong|có ga/i },
  { kind: "creamy", pattern: /sữa|milk|cacao|chocolate|ca cao|sinh tố|smoothie|đá xay|frappe|dừa|coconut/i },
  { kind: "fruit", pattern: /cam|chanh|dâu|berry|xoài|mango|đào|peach|tắc|ổi|bưởi|trái cây|juice/i },
];

function hashText(value: string) {
  let hash = 7;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}

function detectKind(name: string): Kind {
  return KINDS.find((entry) => entry.pattern.test(name))?.kind ?? "fruit";
}

/**
 * A deterministic, name-driven drink illustration. No network images needed:
 * the same drink name always produces the same glass, colours and garnishes.
 */
export function DrinkArt({
  name,
  className,
  compact = false,
}: {
  name: string;
  className?: string;
  compact?: boolean;
}) {
  const hash = hashText(name);
  const palette = PALETTES[hash % PALETTES.length];
  const kind = detectKind(name);
  const gradientId = `drink-art-${hash.toString(36)}`;
  const hot = kind === "coffee" || kind === "tea";
  const cup = hot
    ? "M33 41h54l-5 49a9 9 0 0 1-9 8H47a9 9 0 0 1-9-8Z"
    : "M34 35h52l-6 55a9 9 0 0 1-9 8H49a9 9 0 0 1-9-8Z";
  const fill = hot
    ? "M37 48h46l-4 40a7 7 0 0 1-7 6H48a7 7 0 0 1-7-6Z"
    : "M38 44h44l-5 44a7 7 0 0 1-7 6H50a7 7 0 0 1-7-6Z";

  return (
    <div className={cn("relative overflow-hidden", className)} aria-hidden="true">
      <div
        className="absolute inset-0"
        style={{ background: `linear-gradient(150deg, ${palette.bg} 0%, ${palette.glow}44 100%)` }}
      />
      <div className="absolute -left-8 -top-10 size-28 rounded-full bg-white/30 blur-2xl" />
      <div
        className="absolute -bottom-12 -right-6 size-32 rounded-full opacity-35 blur-2xl"
        style={{ backgroundColor: palette.glow }}
      />
      <div className="absolute left-1/2 top-1/2 size-[68%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/35" />

      <svg
        viewBox="0 0 120 120"
        className={cn(
          "absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 drop-shadow-sm",
          compact ? "size-[92%]" : "size-[82%]",
        )}
        fill="none"
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={palette.top} />
            <stop offset="100%" stopColor={palette.bottom} />
          </linearGradient>
        </defs>

        <ellipse cx="60" cy="102" rx="33" ry="5" fill="#4a3428" opacity="0.12" />

        {hot && (
          <>
            <path
              d="M86 49h6a12 12 0 0 1 0 24h-8"
              stroke="#fffaf0"
              strokeWidth="7"
              strokeLinecap="round"
            />
            <path
              d="M48 29c-5-5 4-9-1-14M60 27c-5-5 4-9-1-14M72 29c-5-5 4-9-1-14"
              stroke={palette.accent}
              strokeWidth="2"
              strokeLinecap="round"
              opacity="0.45"
            />
          </>
        )}

        <path d={cup} fill="#fffaf0" fillOpacity="0.94" stroke="#ffffff" strokeWidth="2" />
        <path d={fill} fill={`url(#${gradientId})`} />
        <ellipse cx="60" cy={hot ? 48 : 44} rx={hot ? 23 : 22} ry="4" fill={palette.foam} opacity="0.92" />

        {!hot && (
          <>
            <path d="M64 18 72 51" stroke={palette.accent} strokeWidth="4" strokeLinecap="round" opacity="0.85" />
            <rect x="44" y="52" width="12" height="12" rx="2" fill="#ffffff" opacity="0.32" transform="rotate(-16 50 58)" />
            <rect x="63" y="63" width="11" height="11" rx="2" fill="#ffffff" opacity="0.26" transform="rotate(18 68 68)" />
            <circle cx="49" cy="79" r="2.2" fill="#ffffff" opacity="0.5" />
            <circle cx="71" cy="83" r="1.6" fill="#ffffff" opacity="0.45" />
          </>
        )}

        {kind === "coffee" && (
          <>
            <ellipse cx="20" cy="26" rx="6" ry="4" fill={palette.accent} opacity="0.45" transform="rotate(-35 20 26)" />
            <path d="M20 23v6" stroke={palette.foam} strokeWidth="1" opacity="0.7" />
          </>
        )}
        {kind === "tea" && (
          <path
            d="M96 25c8 1 10 8 3 13-7-1-10-8-3-13Z"
            fill={palette.accent}
            opacity="0.4"
          />
        )}
        {kind === "fruit" && (
          <>
            <circle cx="94" cy="28" r="10" fill="#e5b45a" opacity="0.8" />
            <path d="M94 18v20M84 28h20" stroke="#fff8ee" strokeWidth="1.2" opacity="0.75" />
          </>
        )}
        {kind === "sparkling" && (
          <>
            <circle cx="20" cy="30" r="3" fill={palette.accent} opacity="0.4" />
            <circle cx="27" cy="20" r="2" fill={palette.accent} opacity="0.3" />
            <circle cx="98" cy="45" r="2.5" fill={palette.accent} opacity="0.35" />
          </>
        )}
        {kind === "water" && (
          <path d="M95 22c5 7 7 10 7 13a7 7 0 0 1-14 0c0-3 2-6 7-13Z" fill={palette.accent} opacity="0.4" />
        )}
        {kind === "beer" && (
          <>
            <circle cx="25" cy="27" r="4" fill={palette.foam} opacity="0.8" />
            <circle cx="33" cy="19" r="2.5" fill={palette.foam} opacity="0.65" />
          </>
        )}
      </svg>

      <div
        className="absolute inset-x-0 bottom-0 h-1/3"
        style={{ background: "linear-gradient(to top, rgba(74,52,40,0.16), transparent)" }}
      />
    </div>
  );
}
