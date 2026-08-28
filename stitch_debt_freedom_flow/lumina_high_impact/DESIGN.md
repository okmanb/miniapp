---
name: Lumina High-Impact
colors:
  surface: '#faf8ff'
  surface-dim: '#B8C2E6'
  surface-bright: '#faf8ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f2f3ff'
  surface-container: '#D1D9F5'
  surface-container-high: '#C4CDED'
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
  neon-teal-glow: rgba(0, 189, 157, 0.4)
  neon-violet-glow: rgba(138, 63, 252, 0.4)
typography:
  display-lg:
    fontFamily: Geist
    fontSize: 48px
    fontWeight: '900'
    lineHeight: 52px
    letterSpacing: -0.05em
  headline-lg:
    fontFamily: Geist
    fontSize: 32px
    fontWeight: '800'
    lineHeight: 40px
    letterSpacing: -0.03em
  headline-lg-mobile:
    fontFamily: Geist
    fontSize: 28px
    fontWeight: '800'
    lineHeight: 34px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Geist
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
    letterSpacing: -0.01em
  body-lg:
    fontFamily: Geist
    fontSize: 18px
    fontWeight: '500'
    lineHeight: 28px
  body-md:
    fontFamily: Geist
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  label-md:
    fontFamily: JetBrains Mono
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
    letterSpacing: 0.02em
  label-sm:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: '600'
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
  margin-main: 24px
  gutter: 16px
  gap-sm: 8px
  gap-md: 16px
  gap-lg: 32px
  padding-card: 20px
---

## Brand & Style

The design system is a high-octane evolution of a financial assistant, moving away from soft atmospheric depths toward a **High-Contrast / Modern** aesthetic with **Glassmorphism** accents. It functions as a precision-engineered tool for wealth management, radiating a personality that is authoritative, hyper-efficient, and technologically advanced.

The visual narrative is driven by "Neon Clarity"—the juxtaposition of a pristine white primary surface against deep, structural container colors and vibrant, glowing interactive elements. This creates a high-impact hierarchy that demands attention where it matters most: financial progress and actionable data. The style balances the reliability of traditional finance with the aggressive energy of a cutting-edge startup.

## Colors

The palette is engineered for maximum visual punch. By deepening the `surface-dim` and `container` tokens, we create a more dramatic backdrop for the "neon" brand colors to pop.

- **Primary (Neon Teal):** #00bd9d serves as the pulse of the system. It is used for growth indicators and primary actions. To enhance the "neon" effect, use it in gradients transitioning from #00bd9d to #46ddbb.
- **Secondary (Vibrant Violet):** #8A3FFC provides a high-contrast counterpoint, used for debt management and secondary interactive tiers.
- **Tertiary (Electric Lime):** #88B000 is reserved for positive streaks and "success" states, providing a high-visibility reward for user progress.
- **Neutral Hierarchy:** The primary surface remains pure white (#FFFFFF). Backgrounds use a deepened `surface-dim` (#B8C2E6) to create a clear structural distinction. Text uses a deep Navy (#0F172A) for uncompromised legibility.

## Typography

The typography is bold, technical, and high-impact. **Geist** is used for the majority of the interface, with increased weights for headlines (reaching 900 for Display) to reinforce the "Financial Assistant" authority. Tight letter-spacing on headings gives the UI a dense, modern feel.

**JetBrains Mono** is utilized for all numerical data and technical labels. This ensures that monetary values and percentages are clearly distinguishable from descriptive text, conveying a sense of algorithmic precision. In this high-impact version, weights are slightly increased across the board to ensure no information is lost against the more vibrant container colors.

## Layout & Spacing

The layout utilizes a **Fluid Grid** with an emphasis on aggressive grouping and clear vertical rhythm.

- **Grid System:** A 12-column grid for desktop and a 4-column grid for tablet, collapsing to a single-column fluid flow on mobile. 
- **Rhythm:** A strict 4px baseline. Spacing between major sections uses `gap-lg` (32px) to ensure the high-impact colors and bold type have room to breathe.
- **Responsive Behavior:** Card padding increases from 16px on mobile to 20px on desktop to maintain a sense of luxury and space. On larger screens, the dashboard reflows into multi-column layouts to keep line lengths of financial data manageable and scannable.

## Elevation & Depth

This system uses **Tonal Layers** and **Glassmorphism** to establish a hierarchy that feels physical yet digital.

- **Layering:** The base is pure White (#FFFFFF). Content is organized into containers using `surface-dim` (#B8C2E6) to create immediate structural depth.
- **Neon Glow:** Instead of traditional neutral shadows, high-priority interactive elements (like the "Transfer" button) use an **Ambient Glow**. This is a soft, 15px blur using the element's own color at 30% opacity, simulating a neon light reflecting off the surface.
- **Backdrop Blur:** Modals and navigation overlays use a Glassmorphic effect with a 24px blur and a 1px semi-transparent white border to maintain clarity over the vibrant dashboard content.
- **Borders:** Use 1px solid borders (#E2E8F0) for standard cards, transitioning to a 2px Neon Teal border for active or "focused" states.

## Shapes

The shape language is sophisticated and "Rounded," balancing the aggressive typography with approachable corners.

- **Standard Elements:** 8px (0.5rem) for input fields and small utility cards.
- **Main Containers:** 16px (1rem) for primary dashboard widgets and account cards.
- **Hero Containers:** 24px (1.5rem) for high-impact summary sections (e.g., Net Worth display).
- **Interactive Elements:** Buttons, tags, and status chips always use a **Full Pill** shape to distinguish them as clickable, moving parts within the fixed grid layout.

## Components

- **Buttons:** Primary buttons are solid Neon Teal (#00BD9D) pills with white text and a matching neon glow on hover. Secondary buttons use a thick 2px border in Vibrant Violet (#8A3FFC).
- **Input Fields:** Pure white backgrounds with a `surface-container` (#D1D9F5) 1px border. On focus, the border expands to 2px Neon Teal with a subtle inner-glow.
- **Cards:** Dashboard cards use a pure white surface with a thin `surface-container-high` border. For "Pro" or "Featured" cards, use a gradient border (Teal to Violet) with a 20px backdrop blur.
- **Data Viz:** Charts must use the neon palette. Area charts should use a 3px thick stroke with a high-contrast gradient fill that fades from 40% opacity to 0%.
- **Status Indicators:** Use the "Electric Lime" (#88B000) for all growth/positive metrics. Use a bold, solid fill to ensure it stands out against the deeper container colors.
- **Lists:** Transaction lists use alternating row colors between white and `surface-container-low` to maintain high scannability in data-dense views.