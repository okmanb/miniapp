---
name: Lumina Finance
colors:
  surface: '#0b1326'
  surface-dim: '#0b1326'
  surface-bright: '#31394d'
  surface-container-lowest: '#060e20'
  surface-container-low: '#131b2e'
  surface-container: '#171f33'
  surface-container-high: '#222a3d'
  surface-container-highest: '#2d3449'
  on-surface: '#dae2fd'
  on-surface-variant: '#b9cac4'
  inverse-surface: '#dae2fd'
  inverse-on-surface: '#283044'
  outline: '#83948f'
  outline-variant: '#3a4a46'
  surface-tint: '#00dfc1'
  primary: '#d7fff3'
  on-primary: '#00382f'
  primary-container: '#00f5d4'
  on-primary-container: '#006c5c'
  inverse-primary: '#006b5b'
  secondary: '#e0b6ff'
  on-secondary: '#4c007d'
  secondary-container: '#6d11ad'
  on-secondary-container: '#d7a4ff'
  tertiary: '#ecffb2'
  on-tertiary: '#283500'
  tertiary-container: '#bceb00'
  on-tertiary-container: '#516700'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#26fedc'
  primary-fixed-dim: '#00dfc1'
  on-primary-fixed: '#00201a'
  on-primary-fixed-variant: '#005144'
  secondary-fixed: '#f2daff'
  secondary-fixed-dim: '#e0b6ff'
  on-secondary-fixed: '#2e004e'
  on-secondary-fixed-variant: '#6a0baa'
  tertiary-fixed: '#c3f400'
  tertiary-fixed-dim: '#abd600'
  on-tertiary-fixed: '#161e00'
  on-tertiary-fixed-variant: '#3c4d00'
  background: '#0b1326'
  on-background: '#dae2fd'
  surface-variant: '#2d3449'
typography:
  display-lg:
    fontFamily: Geist
    fontSize: 48px
    fontWeight: '800'
    lineHeight: 56px
    letterSpacing: -0.04em
  headline-lg:
    fontFamily: Geist
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-lg-mobile:
    fontFamily: Geist
    fontSize: 28px
    fontWeight: '700'
    lineHeight: 36px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Geist
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  body-lg:
    fontFamily: Geist
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Geist
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  label-md:
    fontFamily: JetBrains Mono
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
    letterSpacing: 0.02em
  label-sm:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.05em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  unit: 4px
  container-padding: 20px
  stack-gap-sm: 8px
  stack-gap-md: 16px
  stack-gap-lg: 24px
  grid-gutter: 12px
---

## Brand & Style

The design system is built on a "Modern Fintech" aesthetic that balances institutional trustworthiness with the encouraging energy of a personal mentor. It moves away from the anxiety-inducing spreadsheets of traditional banking, favoring a supportive, "good vibe" atmosphere that celebrates progress and momentum.

The visual style is a sophisticated blend of **Corporate Modern** structure and **Glassmorphism**. It utilizes deep, atmospheric backgrounds to create a focused environment, while vibrant accent layers and translucent surfaces provide a sense of lightness and technical polish. The interface should feel like a premium financial assistant—precise, clear, and relentlessly optimistic about the user's financial journey.

## Colors

The palette is optimized for a high-end dark mode experience. The foundation is built on deep navies and slates to reduce eye strain and provide a canvas for vibrant data visualization.

- **Primary (Electric Teal):** Used for primary actions, success states, and positive growth indicators.
- **Secondary (Soft Violet):** Used for secondary features, debt categories, and glassmorphic glow effects.
- **Tertiary (Energetic Lime):** Reserved specifically for "streaks" and rapid progress indicators to provide a high-contrast visual reward.
- **Neutral (Deep Slate):** The structural base, ranging from the deep background (#0F172A) to lighter slate tones for card borders and secondary text.

## Typography

This design system utilizes **Geist** for its technical precision and modern, airy feel. Headlines are set with tight letter-spacing and heavy weights to create a sense of impact and authority. For data-heavy elements, such as debt amounts and date labels, **JetBrains Mono** is employed to provide a "developer-tool" level of clarity and a distinct fintech character.

When displaying large currency amounts (Display LG), use the ultra-bold weight to emphasize financial milestones. Body text should maintain a generous line height to ensure readability against dark backgrounds.

## Layout & Spacing

The layout follows a **Fluid Grid** model optimized for mobile-first interactions. It uses a 4px baseline shift to ensure all elements align to a consistent vertical rhythm. 

- **Margins:** A standard 20px horizontal margin is maintained for all main containers.
- **Card Spacing:** Elements within cards use a 16px internal padding.
- **Grouping:** Use 8px gaps for related items (e.g., a label and an input) and 24px gaps between distinct sections (e.g., a chart and a list).
- **Safe Areas:** Ensure bottom-sheet components and floating action buttons respect the device's home indicator safe zones.

## Elevation & Depth

Hierarchy is established through **Tonal Layering** and **Glassmorphism** rather than traditional heavy shadows.

1.  **Base Layer:** The deepest Slate color (#0F172A).
2.  **Surface Layer:** Semi-transparent cards (10-15% opacity white or primary tint) with a 20px backdrop blur.
3.  **Accent Elevation:** Subtle, colored outer glows (5-10% opacity of the accent color) are used for active states or "streak" cards to make them appear to emit light.
4.  **Borders:** Use 1px "ghost borders"—thin, low-opacity lines (White at 10% opacity) to define shapes without creating visual clutter.

## Shapes

The shape language is friendly and modern, characterized by generous corner radii that soften the technical nature of the app.

- **Standard Cards:** Use 16px (rounded-lg) for most content containers.
- **Feature/Hero Cards:** Use 24px (rounded-xl) for primary dashboard elements like the "Total Progress" chart.
- **Buttons & Chips:** Use fully rounded (Pill) shapes to encourage interaction and provide a distinct contrast against the rectangular grid.

## Components

- **Buttons:** Primary buttons are pill-shaped with a vibrant gradient (Teal to Blue) or solid Electric Teal. Labels are bold and centered.
- **Progress Streaks:** Displayed as a horizontal sequence of pill-shaped nodes. The "Active" node uses the Energetic Lime tertiary color with a soft outer glow.
- **Glass Cards:** Used for all list items. They must feature a 1px inner border (top/left) to simulate a light-catching edge.
- **Input Fields:** Minimalist design with only a bottom border or a subtle dark-tinted fill. Focus states are indicated by the border turning Electric Teal.
- **Chips:** Small, pill-shaped tags used for categorizing debt types (e.g., "Student Loan", "Credit Card"). Use low-opacity fills of the Secondary Violet.
- **Data Visualization:** Line charts should use thick, smoothed strokes (3px) with a subtle gradient fill below the line, transitioning from 20% opacity to 0%.