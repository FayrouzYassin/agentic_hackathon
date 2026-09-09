/**
 * Semantic design tokens for the mobile app.
 *
 * These tokens mirror the naming conventions used in web artifacts (index.css)
 * so that multi-artifact projects share a cohesive visual identity.
 *
 * Replace the placeholder values below with values that match the project's
 * brand. If a sibling web artifact exists, read its index.css and convert the
 * HSL values to hex so both artifacts use the same palette.
 *
 * To add dark mode, add a `dark` key with the same token names.
 * The useColors() hook will automatically pick it up.
 */

const colors = {
  light: {
    // Legacy aliases (kept for backward compatibility)
    text: '#163A3F',
    tint: '#D9635D',

    // Core surfaces
    background: '#F6F7F3',
    foreground: '#163A3F',

    // Cards / elevated surfaces
    card: '#FFFFFF',
    cardForeground: '#163A3F',

    // Primary action color (buttons, links, active states)
    primary: '#D9635D',
    primaryForeground: '#ffffff',

    // Secondary / less-emphasis interactive surfaces
    secondary: '#E6EFEC',
    secondaryForeground: '#21545A',

    // Muted / subdued elements (dividers, timestamps, placeholders)
    muted: '#EDF1EE',
    mutedForeground: '#6C817F',

    // Accent highlights (badges, selected items, focus rings)
    accent: '#F4D6C8',
    accentForeground: '#8B403D',

    // Destructive actions (delete, error states)
    destructive: '#C94D4A',
    destructiveForeground: '#ffffff',

    // Borders and input outlines
    border: '#DCE6E1',
    input: '#D0DDD8',

    // App-specific surfaces
    teal: '#21545A',
    tealDeep: '#163A3F',
    sage: '#DCEBE4',
    coralSoft: '#FBE6DE',
    sand: '#F2EBDD',
    scrim: 'rgba(22,58,63,0.36)',
  },

  // Border radius (in px). Sync from the sibling web artifact's --radius
  // CSS variable. This value applies to cards, buttons, inputs, and modals.
  radius: 18,
};

export default colors;
