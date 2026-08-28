---
name: Vivid Velocity
colors:
  surface: '#f4fbf7'
  surface-dim: '#d4dcd7'
  surface-bright: '#f4fbf7'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eef5f1'
  surface-container: '#e8f0eb'
  surface-container-high: '#e3eae6'
  surface-container-highest: '#dde4e0'
  on-surface: '#161d1b'
  on-surface-variant: '#3c4a45'
  inverse-surface: '#2b322f'
  inverse-on-surface: '#ebf2ee'
  outline: '#6c7a75'
  outline-variant: '#bbcac3'
  surface-tint: '#006b58'
  primary: '#006b58'
  on-primary: '#ffffff'
  primary-container: '#00bd9d'
  on-primary-container: '#004538'
  inverse-primary: '#46ddbb'
  secondary: '#5b598c'
  on-secondary: '#ffffff'
  secondary-container: '#c7c3fe'
  on-secondary-container: '#514f81'
  tertiary: '#7825ea'
  on-tertiary: '#ffffff'
  tertiary-container: '#bb94ff'
  on-tertiary-container: '#5100aa'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#69fad7'
  primary-fixed-dim: '#46ddbb'
  on-primary-fixed: '#002019'
  on-primary-fixed-variant: '#005142'
  secondary-fixed: '#e3dfff'
  secondary-fixed-dim: '#c4c1fb'
  on-secondary-fixed: '#181445'
  on-secondary-fixed-variant: '#444173'
  tertiary-fixed: '#ebdcff'
  tertiary-fixed-dim: '#d4bbff'
  on-tertiary-fixed: '#270058'
  on-tertiary-fixed-variant: '#5d00c2'
  background: '#f4fbf7'
  on-background: '#161d1b'
  surface-variant: '#dde4e0'
  growth-teal: '#00BD9D'
  deep-indigo: '#1E1B4B'
  electric-violet: '#8A3FFC'
  success-lime: '#A3E635'
  surface-base: '#FAFAFF'
  accent-glow: rgba(0, 189, 157, 0.6)
typography:
  display-lg:
    fontFamily: Geist
    fontSize: 56px
    fontWeight: '900'
    lineHeight: 60px
    letterSpacing: -0.06em
  headline-lg:
    fontFamily: Geist
    fontSize: 36px
    fontWeight: '800'
    lineHeight: 40px
    letterSpacing: -0.04em
  headline-lg-mobile:
    fontFamily: Geist
    fontSize: 30px
    fontWeight: '800'
    lineHeight: 36px
    letterSpacing: -0.03em
  headline-md:
    fontFamily: Geist
    fontSize: 26px
    fontWeight: '700'
    lineHeight: 32px
    letterSpacing: -0.02em
  body-lg:
    fontFamily: Geist
    fontSize: 18px
    fontWeight: '500'
    lineHeight: 28px
    letterSpacing: -0.01em
  body-md:
    fontFamily: Geist
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  label-md:
    fontFamily: JetBrains Mono
    fontSize: 14px
    fontWeight: '700'
    lineHeight: 20px
    letterSpacing: 0.02em
  label-sm:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.04em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  unit: 4px
  container-margin: 24px
  gutter: 16px
  gap-compact: 8px
  gap-standard: 20px
  gap-feature: 40px
---

## Brand & Style

The design system is a **Hyper-Impact / Modern** evolution focused on peak performance and high-velocity financial growth. It shifts away from static layouts toward a dynamic, energetic visual language that emphasizes momentum and clarity. The personality is unapologetically bold, "charger-efficient," and premium, targeting a user base that demands instant data recognition and high-octane visual feedback.

The aesthetic blends **Minimalism** for structural integrity with **Vibrant Glassmorphism** and **High-Contrast** elements. The visual narrative is built around "Saturated Momentum"—using deep, multi-stop gradients and intense glow effects to create a UI that feels alive and responsive. It is designed to evoke a sense of power, precision, and relentless upward progress.

## Colors

The palette is engineered for maximum perceptual contrast. The core visual hook is the **Teal-to-Deep Indigo** gradient, which signifies transition and growth.

- **Primary (Growth Teal):** #00BD9D. This is the "active" energy of the system. It is used for primary CTAs, positive growth vectors, and progress indicators.
- **Secondary (Deep Indigo):** #1E1B4B. This provides the structural weight. It is used as the anchor point for gradients and for primary typography to ensure a heavy, authoritative presence.
- **Tertiary (Electric Violet):** #8A3FFC. Used for secondary interactive tiers and high-alert notifications that sit outside the primary growth flow.
- **Hyper-Impact Contrast:** Unlike standard themes, gradients here are more saturated. Use a linear-gradient (135deg) from `#00BD9D` to `#1E1B4B` for major display containers to create a sense of deep, recessed space.
- **Neutral:** The background is a crisp, cool `#FAFAFF`. Surface containers use highly saturated variants of the primary hue to maintain "vibrancy" even in neutral states.

## Typography

Typography is treated as a structural element. **Geist** is the primary driver, utilized with ultra-heavy weights and tighter tracking to create a "locked-in," professional feel.

- **Headline Density:** Headlines use `900` weight for Display and `800` for Large Headlines. The negative letter-spacing is aggressive to create a dense visual block that feels authoritative.
- **Technical Precision:** **JetBrains Mono** is mandatory for all currency, percentages, and data points. In this system, it is set at a higher weight (`700`) than standard to ensure data "pops" against saturated background gradients.
- **Scaling:** On mobile, tracking is slightly relaxed compared to desktop to maintain legibility while preserving the bold character.

## Layout & Spacing

The layout follows a **Fluid Grid** model with high-tension spacing. Elements are grouped tightly to imply a relationship, with larger gaps between functional blocks to facilitate rapid scanning.

- **Grid Model:** 12-column system for desktop, 8-column for tablet, and a single-column flow for mobile. Margins are kept wide (`24px`) to frame the high-impact content.
- **Rhythm:** A 4px baseline grid ensures alignment. Vertical spacing between feature sections (`gap-feature`) is increased to `40px` to prevent the bold typography and saturated gradients from overwhelming the user.
- **Content Flow:** Financial data is organized into "Growth Tracks"—vertical columns that use narrow gutters to maintain a sense of connected, upward momentum.

## Elevation & Depth

This system avoids traditional gray shadows in favor of **Chromatic Glows** and **Saturated Layers**.

- **Hyper-Glow:** Primary interactive elements use an intensified ambient glow. This is a `25px` blur using `#00BD9D` at `60%` opacity. For secondary actions, use an indigo glow (`#1E1B4B` at `30%` opacity).
- **Glassmorphism:** Overlays and dropdowns use a "Frosted Teal" effect: a `30px` backdrop blur with a `15%` opacity primary tint and a `2px` solid white border at `40%` opacity.
- **Tonal Stacking:** Surfaces are tiered using saturation rather than lightness. The further "forward" an element is, the more vibrant its gradient or border becomes.
- **Growth Indicators:** Progress bars and success states feature an inner-glow to make them appear "backlit," as if the growth metric is a light source within the UI.

## Shapes

The shape language balances the aggressive, high-contrast colors with "Rounded" geometry to maintain a modern, premium feel.

- **Interactive Components:** Buttons and chips are strictly **Pill-shaped** (full radius). This provides a soft touchpoint that contrasts with the dense, rectangular blocks of the grid.
- **Structural Containers:** Dashboard widgets and cards use a `1rem` (16px) radius. 
- **Focus States:** Active or focused containers utilize a `2px` primary-to-secondary gradient border, reinforcing the "velocity" narrative.

## Components

- **Buttons:** Primary buttons are defined by a Teal-to-Indigo gradient with a high-intensity Teal glow. Text is white, Geist 800.
- **Progress Indicators:** Use "backlit" styling. The fill is a saturated Teal gradient with a `4px` outer glow. The track is a deep, desaturated indigo.
- **Input Fields:** Use a subtle `10%` Teal background tint with a `1px` deep indigo border. On focus, the border thickens to `2px` and triggers a soft primary glow.
- **Growth Chips:** Small, pill-shaped indicators for percentage changes. Positive growth must use the "Success Lime" (#A3E635) with a matching soft glow to ensure maximum vibrancy.
- **Cards:** Feature cards use a "Depth-Fill" approach—a deep Indigo background with Geist Display typography in white. Data-dense cards remain white with 1px structural borders and bold JetBrains Mono data points.
- **Charts:** Area charts use a 3px thick teal stroke with a high-saturation gradient fill (`60%` to `0%` opacity). Data points (nodes) trigger an immediate glow effect when hovered.