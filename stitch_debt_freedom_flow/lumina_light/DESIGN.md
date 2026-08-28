---
name: Lumina Light
colors:
  surface: '#FFFFFF'
  surface-dim: '#d2d9f4'
  surface-bright: '#faf8ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f2f3ff'
  surface-container: '#eaedff'
  surface-container-high: '#e2e7ff'
  surface-container-highest: '#dae2fd'
  on-surface: '#131b2e'
  on-surface-variant: '#3c4a45'
  inverse-surface: '#283044'
  inverse-on-surface: '#eef0ff'
  outline: '#6c7a75'
  outline-variant: '#bbcac3'
  surface-tint: '#006b58'
  primary: '#006b58'
  on-primary: '#ffffff'
  primary-container: '#00bd9d'
  on-primary-container: '#004538'
  inverse-primary: '#46ddbb'
  secondary: '#731be5'
  on-secondary: '#ffffff'
  secondary-container: '#8d42ff'
  on-secondary-container: '#fdf6ff'
  tertiary: '#4e6700'
  on-tertiary: '#ffffff'
  tertiary-container: '#8db50c'
  on-tertiary-container: '#314200'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#69fad7'
  primary-fixed-dim: '#46ddbb'
  on-primary-fixed: '#002019'
  on-primary-fixed-variant: '#005142'
  secondary-fixed: '#ebdcff'
  secondary-fixed-dim: '#d4bbff'
  on-secondary-fixed: '#270058'
  on-secondary-fixed-variant: '#5d00c2'
  tertiary-fixed: '#c6f251'
  tertiary-fixed-dim: '#abd535'
  on-tertiary-fixed: '#151f00'
  on-tertiary-fixed-variant: '#3a4d00'
  background: '#faf8ff'
  on-background: '#131b2e'
  surface-variant: '#dae2fd'
  surface-alt: '#F8FAFC'
  text-primary: '#0F172A'
  text-secondary: '#64748B'
  accent-teal: '#00BD9D'
  accent-violet: '#8A3FFC'
  accent-lime: '#88B000'
  border-soft: '#E2E8F0'
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
  margin-main: 20px
  padding-card: 16px
  gap-sm: 8px
  gap-md: 16px
  gap-lg: 24px
  gutter: 12px
---

## Brand & Style

The design system evolves into a light-mode expression of "Modern Fintech," shifting from atmospheric depth to a crisp, high-clarity workspace. It maintains the core identity of an energetic, transparent, and trustworthy financial mentor. The aesthetic transitions toward a **Minimalist** foundation with **Glassmorphism** accents, emphasizing a "breathable" interface that feels sophisticated and relentlessly optimistic.

The visual narrative is driven by extreme legibility and a sense of openness. By utilizing a clean white base, the interface removes the cognitive load of traditional banking apps, replacing it with a focused environment where financial progress is celebrated through vibrant, adjusted neon accents. The brand feels professional yet approachable—a precision tool that radiates positive momentum.

## Colors

The palette is recalibrated for high-contrast visibility on light surfaces, ensuring the "energetic" personality of the brand isn't lost in the transition.

- **Primary (Vibrant Teal):** Adjusted to a slightly deeper hue (#00BD9D) to maintain accessibility standards on white backgrounds while retaining its "neon" energy. Used for primary actions and growth indicators.
- **Secondary (Vibrant Violet):** A rich, punchy violet (#8A3FFC) used for interactive elements and debt categories.
- **Tertiary (Neon Lime):** A sophisticated lime (#88B000) optimized for visibility. This color is strictly reserved for "streaks" and progress rewards.
- **Neutral (Slate & Navy):** Headings utilize a deep Dark Slate (#0F172A) for maximum authority. Secondary text and metadata use a soft Slate Gray (#64748B) to create a clear visual hierarchy.
- **Backgrounds:** The primary surface is pure white (#FFFFFF), with #F8FAFC used for section backgrounds and container fills to provide subtle structural separation.

## Typography

This system uses **Geist** as its primary typeface to convey technical precision. Headlines are aggressive and heavy, utilizing tight letter-spacing to command attention.

For data-dense environments, **JetBrains Mono** provides a distinctive fintech character, ensuring that numerical data—such as interest rates and dates—is instantly legible and feels "engineered." In this light mode version, font weights for body text are kept at a standard 400 to ensure the clean lines of the font are preserved without becoming too faint against the white background.

## Layout & Spacing

The layout follows a **Fluid Grid** model with a focus on generous white space to enhance the feeling of transparency.

- **Vertical Rhythm:** Built on a 4px baseline. All heights and vertical margins must be multiples of 4.
- **Grid:** Use a 12-column grid for desktop and a single-column fluid layout for mobile.
- **Safe Areas:** All floating elements and primary navigation must respect a 20px horizontal "safe margin" from the device edges.
- **Reflow:** On tablet and desktop, cards should transition from full-width to a multi-column masonry or grid layout to prevent line lengths from becoming unreadable.

## Elevation & Depth

In light mode, hierarchy is achieved through **Tonal Layers** and **Low-Contrast Outlines** rather than heavy shadows.

- **Base Level:** Pure White (#FFFFFF) surface.
- **Surface Level:** Content cards use a very subtle off-white fill (#F8FAFC) or a semi-transparent white with backdrop blur (Glassmorphism) when placed over colored backgrounds.
- **Outlines:** Instead of traditional shadows, use 1px "soft borders" (#E2E8F0) to define card boundaries.
- **Interactive Depth:** Only the most critical primary actions (e.g., "Pay Now") may use a very soft, tinted ambient shadow (Teal at 10% opacity, 12px blur) to suggest lift.

## Shapes

The system uses the **ROUND_EIGHT** philosophy (0.5rem base) to maintain a modern, friendly character that softens the hard data of finance.

- **Standard Elements:** 8px (0.5rem) for inputs and small cards.
- **Containers:** 16px (rounded-lg) for main dashboard cards.
- **Hero Elements:** 24px (rounded-xl) for primary "Total Balance" or chart containers.
- **Interactive:** Buttons and tags use a full **Pill** shape to differentiate them from static content containers.

## Components

- **Buttons:** Primary buttons are pill-shaped, using a solid Vibrant Teal (#00BD9D) with white text. Secondary buttons use a transparent fill with a 1px teal border.
- **Input Fields:** Designed for maximum clarity with a subtle light-gray fill (#F8FAFC) and a 1px border (#E2E8F0). Upon focus, the border transitions to Vibrant Teal.
- **Chips & Tags:** Use a low-opacity version of the Secondary Violet (8% opacity) with a solid Violet label for high contrast.
- **Progress Streaks:** Displayed as a horizontal sequence of pill-shaped nodes. The "Active" node uses the Neon Lime (#88B000) to create a visual "win" state.
- **Cards:** White surfaces with a #E2E8F0 border. For featured content, use a Glassmorphic effect with a 20px backdrop blur and a thin white inner-glow edge.
- **Data Visualization:** Line charts use a 3px stroke in Vibrant Teal. Fill the area beneath the line with a soft gradient (Teal at 10% to 0% opacity) to provide volume without clutter.