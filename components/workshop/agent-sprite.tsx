"use client"

export type SpriteVariant =
  | "masta"
  | "scout"
  | "director"
  | "forge"
  | "curator"
  | "reflector"
  | "packer"
  | "lister"

interface SpritePalette {
  skin: string
  hair: string
  shirt: string
  pants: string
  /** Hat colour, or null to draw bare hair. */
  hat: string | null
  /** Two-coloured accessory: tool colour, tool accent. */
  tool: { color: string; accent: string } | null
  /** Optional small badge (e.g. crown jewel). */
  badge: string | null
}

const PALETTES: Record<SpriteVariant, SpritePalette> = {
  masta:     { skin: "#f5cfa0", hair: "#3a2a18", shirt: "#a31d2b", pants: "#5a1019", hat: "#f4c022", tool: null,                              badge: "#fff5b0" },
  scout:     { skin: "#f5d6b8", hair: "#4a3520", shirt: "#2a6cb0", pants: "#23456e", hat: "#7a5230", tool: { color: "#2d2a26", accent: "#bcd6ff" }, badge: null },
  director:  { skin: "#f3c8a8", hair: "#1d1310", shirt: "#7c3dc4", pants: "#3b2360", hat: "#1d1310", tool: { color: "#caa46c", accent: "#ff7aa2" }, badge: null },
  forge:     { skin: "#e9b48a", hair: "#cf3f1b", shirt: "#c0392b", pants: "#2c2c2c", hat: "#e74c3c", tool: { color: "#6a5a4a", accent: "#a8a8a8" }, badge: null },
  curator:   { skin: "#f0c39a", hair: "#2e3e54", shirt: "#117a7a", pants: "#0f4e4e", hat: null,      tool: { color: "#f6f6e8", accent: "#117a7a" }, badge: null },
  reflector: { skin: "#e8b89c", hair: "#5a3a1a", shirt: "#4a3aa0", pants: "#28236a", hat: null,      tool: { color: "#cf8a3a", accent: "#fff0c0" }, badge: null },
  packer:    { skin: "#f0c08a", hair: "#3d2a18", shirt: "#a05a2c", pants: "#3a261a", hat: "#6a4a30", tool: { color: "#b58a4a", accent: "#6a3f1c" }, badge: null },
  lister:    { skin: "#f3cfa6", hair: "#2c1f12", shirt: "#2f8f4a", pants: "#1c5a2e", hat: "#1d3a22", tool: { color: "#f3e6c6", accent: "#2a2010" }, badge: null },
}

interface AgentSpriteProps {
  variant: SpriteVariant
  /** Pixels (square-ish — sprite is 24×32 viewBox, will scale proportionally). */
  size?: number
  /** Direction: 1 = facing right, -1 = facing left. */
  facing?: 1 | -1
  /** Plays the walking sub-animation when true. */
  walking?: boolean
  /** Plays the work bounce when true. */
  working?: boolean
  className?: string
}

/**
 * Tiny pixel-art character drawn with SVG rects. 24 × 32 design grid;
 * shapeRendering="crispEdges" + transform: scale on the wrapping <svg>
 * gives a crisp upscaled look without raster sprite sheets.
 */
export function AgentSprite({
  variant,
  size = 48,
  facing = 1,
  walking = false,
  working = false,
  className = "",
}: AgentSpriteProps) {
  const p = PALETTES[variant]
  const outline = "#1a1208"
  const boots = "#1d1208"

  return (
    <svg
      viewBox="0 0 24 32"
      width={size}
      height={(size / 24) * 32}
      shapeRendering="crispEdges"
      className={`workshop-sprite ${working ? "workshop-sprite-working" : ""} ${walking ? "workshop-sprite-walking" : ""} ${className}`}
      style={{ transform: `scaleX(${facing})` }}
    >
      {/* Shadow */}
      <ellipse cx="12" cy="30" rx="6" ry="1.2" fill="#000" opacity="0.25" />

      {/* Legs (animated when walking) */}
      <g className="workshop-leg workshop-leg-l">
        <rect x="9" y="24" width="2" height="5" fill={p.pants} />
        <rect x="9" y="29" width="2" height="1" fill={boots} />
      </g>
      <g className="workshop-leg workshop-leg-r">
        <rect x="13" y="24" width="2" height="5" fill={p.pants} />
        <rect x="13" y="29" width="2" height="1" fill={boots} />
      </g>

      {/* Body / shirt */}
      <rect x="8" y="15" width="8" height="9" fill={p.shirt} />
      <rect x="8" y="15" width="8" height="1" fill="#000" opacity="0.18" />
      {/* Arms */}
      <g className="workshop-arm workshop-arm-l">
        <rect x="6" y="16" width="2" height="6" fill={p.shirt} />
        <rect x="6" y="22" width="2" height="1" fill={p.skin} />
      </g>
      <g className="workshop-arm workshop-arm-r">
        <rect x="16" y="16" width="2" height="6" fill={p.shirt} />
        <rect x="16" y="22" width="2" height="1" fill={p.skin} />
      </g>

      {/* Neck */}
      <rect x="11" y="14" width="2" height="1" fill={p.skin} />

      {/* Head */}
      <rect x="8" y="7" width="8" height="7" fill={p.skin} />
      <rect x="8" y="7" width="8" height="1" fill={outline} opacity="0.18" />
      {/* Eyes */}
      <rect x="10" y="10" width="1" height="1" fill={outline} />
      <rect x="13" y="10" width="1" height="1" fill={outline} />
      {/* Mouth */}
      <rect x="11" y="12" width="2" height="1" fill={outline} opacity="0.55" />

      {/* Hair (peeking under hat) */}
      <rect x="7" y="7" width="10" height="2" fill={p.hair} />

      {/* Hat */}
      {p.hat && variant !== "masta" && (
        <>
          <rect x="7" y="5" width="10" height="3" fill={p.hat} />
          <rect x="6" y="6" width="12" height="1" fill={p.hat} />
        </>
      )}

      {/* Masta's crown */}
      {variant === "masta" && (
        <>
          <rect x="7" y="3" width="10" height="2" fill={p.hat ?? "#f4c022"} />
          <rect x="7" y="5" width="10" height="1" fill={p.hat ?? "#f4c022"} />
          {/* Crown spikes */}
          <rect x="7" y="1" width="2" height="2" fill={p.hat ?? "#f4c022"} />
          <rect x="11" y="1" width="2" height="2" fill={p.hat ?? "#f4c022"} />
          <rect x="15" y="1" width="2" height="2" fill={p.hat ?? "#f4c022"} />
          {p.badge && <rect x="11" y="3" width="2" height="1" fill={p.badge} />}
        </>
      )}

      {/* Role-specific accessories */}
      {variant === "scout" && p.tool && (
        <>
          {/* Binoculars held to face */}
          <rect x="9" y="9" width="6" height="2" fill={p.tool.color} />
          <rect x="9" y="10" width="2" height="1" fill={p.tool.accent} />
          <rect x="13" y="10" width="2" height="1" fill={p.tool.accent} />
        </>
      )}
      {variant === "director" && p.tool && (
        <>
          {/* Palette */}
          <rect x="3" y="20" width="5" height="4" fill={p.tool.color} />
          <rect x="4" y="21" width="1" height="1" fill={p.tool.accent} />
          <rect x="6" y="21" width="1" height="1" fill="#7c3dc4" />
          <rect x="4" y="22" width="1" height="1" fill="#1d8d4d" />
        </>
      )}
      {variant === "forge" && p.tool && (
        <>
          {/* Hammer */}
          <rect x="18" y="14" width="4" height="3" fill={p.tool.accent} />
          <rect x="19" y="17" width="2" height="6" fill={p.tool.color} />
        </>
      )}
      {variant === "curator" && p.tool && (
        <>
          {/* Clipboard */}
          <rect x="3" y="17" width="5" height="6" fill={p.tool.color} />
          <rect x="4" y="18" width="3" height="1" fill={p.tool.accent} />
          <rect x="4" y="20" width="3" height="1" fill={p.tool.accent} />
          {/* Glasses */}
          <rect x="9" y="10" width="2" height="2" fill="none" stroke={outline} strokeWidth="0.4" />
          <rect x="13" y="10" width="2" height="2" fill="none" stroke={outline} strokeWidth="0.4" />
          <rect x="11" y="11" width="2" height="1" fill={outline} opacity="0.5" />
        </>
      )}
      {variant === "reflector" && p.tool && (
        <>
          {/* Book */}
          <rect x="3" y="18" width="5" height="5" fill={p.tool.color} />
          <rect x="3" y="18" width="5" height="1" fill={p.tool.accent} />
          <rect x="5" y="19" width="1" height="3" fill="#fff0c0" />
        </>
      )}
      {variant === "packer" && p.tool && (
        <>
          {/* Cardboard box */}
          <rect x="3" y="18" width="6" height="5" fill={p.tool.color} />
          <rect x="3" y="18" width="6" height="1" fill={p.tool.accent} />
          <rect x="5" y="18" width="2" height="1" fill={p.tool.accent} />
        </>
      )}
      {variant === "lister" && p.tool && (
        <>
          {/* Storefront sign */}
          <rect x="18" y="14" width="4" height="6" fill={p.tool.color} />
          <rect x="18" y="14" width="4" height="1" fill={p.tool.accent} />
          <rect x="19" y="16" width="2" height="1" fill={p.tool.accent} />
          <rect x="19" y="18" width="2" height="1" fill={p.tool.accent} />
        </>
      )}
    </svg>
  )
}
