import { designTokens } from "./tokens";

export { designTokens } from "./tokens";
export type { DesignTokens } from "./tokens";

export const appName = "MINIROS";

export const brandIdentity = {
  name: "MINIROS",
  expandedName: "Mini Retail Operations System",
  promise: "Track profit, not just sales.",
  mark: {
    geometry: "M",
    primary: {
      background: designTokens.colors.ink,
      foreground: designTokens.colors.accent,
    },
    inverse: {
      background: designTokens.colors.accent,
      foreground: designTokens.colors.ink,
    },
  },
} as const;

export const heroCopy = {
  eyebrow: "Mini Retail Operations System",
  headline: "Track profit, not just sales.",
  description:
    "Connect selling, stock, staffing, and closeout so every location decision rests on a complete operating record.",
};

export const brandTokens = {
  colors: {
    ink: designTokens.colors.ink,
    inkSubtle: designTokens.colors.inkSubtle,
    accent: designTokens.colors.accent,
    canvas: designTokens.colors.canvas,
    surface: designTokens.colors.surface,
    mutedForeground: designTokens.colors.mutedForeground,
    border: designTokens.colors.border,
  },
};
