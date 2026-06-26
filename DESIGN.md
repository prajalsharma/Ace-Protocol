# ACE Protocol — Design Checklist

Distilled from taste-skill, impeccable.style, and ui-ux-pro-max. Applied to the
**existing** UI as a refinement pass — inherit the current system, do not rebuild.

## Inherit, don't replace
- Reuse existing design tokens, fonts, components, radius + spacing rhythm.
- New work must fit the current system. One product brief, captured here.

## Anti-AI-slop (remove on sight)
- ❌ AI purple/pink gradients, oversaturated defaults, gradient text overlays.
- ❌ Glassmorphism, ghost cards, low-contrast containers.
- ❌ Emojis used as functional icons → use Lucide/Heroicons SVGs.
- ❌ "Boost your productivity" marketing filler copy.
- ❌ Placeholders / half-finished sections.

## Typography
- Intentional, disciplined pairing; match brand mood. Inherit codebase fonts.

## Color & contrast
- Restrained palette via tokens. Min 4.5:1 text contrast (WCAG AA). Dark-mode parity.

## Spacing & layout
- Respect spacing tokens + radius increments. Breakpoints: 375 / 768 / 1024 / 1440.
- Bento-grid for dashboards; layout variance over repetitive grids.

## Motion
- Transitions 150–300ms; honor `prefers-reduced-motion`; no gratuitous motion.

## Interaction & a11y
- `cursor-pointer` + visible hover state on every clickable element.
- Visible focus states; full keyboard nav. WCAG AA minimum.

## Pre-flight gate (before shipping UI)
- No a11y violations, all interactive elements keyboard-navigable, responsive at all
  breakpoints, no placeholders, copy matches product (no filler).
