---
name: Lumina Balanced Impact
colors:
  surface: '#f7f9fb'
  surface-dim: '#d8dadc'
  surface-bright: '#f7f9fb'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f2f4f6'
  surface-container: '#eceef0'
  surface-container-high: '#e6e8ea'
  surface-container-highest: '#e0e3e5'
  on-surface: '#191c1e'
  on-surface-variant: '#3c4a45'
  inverse-surface: '#2d3133'
  inverse-on-surface: '#eff1f3'
  outline: '#6c7a75'
  outline-variant: '#bbcac3'
  surface-tint: '#006b58'
  primary: '#006b58'
  on-primary: '#ffffff'
  primary-container: '#00bd9d'
  on-primary-container: '#004538'
  inverse-primary: '#46ddbb'
  secondary: '#565e74'
  on-secondary: '#ffffff'
  secondary-container: '#dae2fd'
  on-secondary-container: '#5c647a'
  tertiary: '#006b5f'
  on-tertiary: '#ffffff'
  tertiary-container: '#00bca8'
  on-tertiary-container: '#00453d'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#69fad7'
  primary-fixed-dim: '#46ddbb'
  on-primary-fixed: '#002019'
  on-primary-fixed-variant: '#005142'
  secondary-fixed: '#dae2fd'
  secondary-fixed-dim: '#bec6e0'
  on-secondary-fixed: '#131b2e'
  on-secondary-fixed-variant: '#3f465c'
  tertiary-fixed: '#62fae3'
  tertiary-fixed-dim: '#3cddc7'
  on-tertiary-fixed: '#00201c'
  on-tertiary-fixed-variant: '#005047'
  background: '#f7f9fb'
  on-background: '#191c1e'
  surface-variant: '#e0e3e5'
typography:
  display-lg:
    fontFamily: Geist
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 56px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Geist
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
    letterSpacing: -0.01em
  headline-lg-mobile:
    fontFamily: Geist
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.01em
  title-md:
    fontFamily: Geist
    fontSize: 20px
    fontWeight: '500'
    lineHeight: 28px
  body-lg:
    fontFamily: Geist
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-sm:
    fontFamily: Geist
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-caps:
    fontFamily: Geist
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.05em
  mono-data:
    fontFamily: Geist
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
    letterSpacing: -0.01em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  unit: 8px
  container-max: 1280px
  gutter: 24px
  margin-desktop: 40px
  margin-mobile: 16px
---

## Brand & Style
The design system is built on the philosophy of "Balanced Impact"—merging the clarity of institutional finance with the kinetic energy of modern fintech. It targets a demographic that values precision but seeks motivation through visual feedback.

The aesthetic direction is a hybrid of **Modern Corporate** and **Glassmorphism**. It utilizes high-clarity light surfaces for data-heavy utility tasks, juxtaposed with deep indigo immersive zones for high-value insights and "hero" moments. Visual interest is generated through soft glows and "growth" gradients that symbolize financial momentum. The atmosphere is professional and trustworthy, yet pulses with an underlying energy that encourages active wealth management.

## Colors
This design system utilizes a specialized color strategy to maintain focus while providing emotional "peaks."

- **Primary (Mint Green - #00BD9D):** Used for "Growth" indicators, primary actions, and success states. It represents prosperity and movement.
- **Secondary (Deep Indigo - #0F172A):** The anchor color. Used for sidebar navigation, header cards, and immersive dashboard sections to create high-contrast focus areas.
- **Tertiary (Electric Teal - #2DD4BF):** Used for accents, interactive states (hover/active), and data visualization highlights.
- **Surfaces:** The light mode base is an off-white/pale mint (`#F1F5F9`), providing a soft, low-strain background for prolonged data review.
- **Gradients:** Use "Growth Glows"—a linear gradient from Primary to Tertiary at 45 degrees—to highlight positive trends and achievements.

## Typography
The design system exclusively uses **Geist** to leverage its technical, precise character. 

- **Numerical Data:** For financial figures, use the `mono-data` style. Geist’s tabular figures ensure that numbers align perfectly in lists and tables.
- **Hierarchy:** Use `display-lg` sparingly for hero sections. Headlines should primarily use a semi-bold weight to feel authoritative.
- **Accessibility:** Maintain a minimum 1.5x line height for body text to ensure readability against the light-mint surfaces. 
- **Labels:** Use `label-caps` for table headers and small metadata categories to create a clear structural distinction from content.

## Layout & Spacing
The layout follows a **Fluid Grid** model with a maximum container width to prevent line-length issues on ultra-wide monitors.

- **Grid:** 12-column layout for desktop, 8-column for tablet, and 4-column for mobile.
- **Rhythm:** An 8px linear scale is used for all padding and margins. 
- **Adaptation:** On mobile, high-contrast Dark sections (Secondary color) should be reduced to header bands or "Summary Cards" to maintain visual clarity on smaller screens. 
- **Safe Areas:** Dashboards should maintain a 24px gutter between widgets to allow the background color to breathe, reinforcing the "clean" aesthetic.

## Elevation & Depth
Depth is communicated through **Tonal Layering** and **Glassmorphism**, rather than traditional heavy shadows.

- **Level 1 (Base):** Pale mint surface (#F1F5F9), flat.
- **Level 2 (Cards):** Pure white surfaces with a subtle 1px stroke (#E2E8F0).
- **Level 3 (Interactive/Overlays):** Glassmorphic panels. These use a semi-transparent white (80% opacity) with a 12px backdrop blur. 
- **Shadows:** When used for high-impact cards, shadows are "Ambient Glows"—extra-diffused (24px blur) with a 5% opacity tint of the Primary color (#00BD9D).
- **Dark Mode Elevation:** Within Dark sections, cards use a semi-transparent version of the Secondary color with a subtle inner-glow on the top border to simulate a light source.

## Shapes
The shape language is **Rounded**, striking a balance between the friendliness of consumer apps and the structure of professional tools.

- **Standard Elements:** Buttons, input fields, and small cards use a 0.5rem (8px) corner radius.
- **Large Containers:** Dashboard widgets and primary hero sections use `rounded-lg` (16px).
- **Interactive Pills:** Status indicators (e.g., "Active", "Pending") and main CTA buttons use `rounded-xl` (24px) or full pill shapes to draw the eye.
- **Strokes:** Use consistent 1.5px border widths for all outlined components to ensure they feel "crisp" but not fragile.

## Components
- **Buttons:** Primary buttons are solid Primary color with white text. Secondary buttons use a "Ghost" style with a 1.5px Primary color border. 
- **Input Fields:** Use a white background with a light grey border. On focus, the border transitions to Primary color with a soft 4px outer glow.
- **Glass Cards:** Used for high-level summaries. These must feature a 1px white border at 20% opacity and a backdrop blur of 10px.
- **Growth Streaks:** A custom component representing user consistency. This uses the "Growth Glow" gradient and a small spark icon.
- **Data Tables:** Row-based with alternating subtle mint backgrounds. Headers are in `label-caps` with a 1px solid bottom border.
- **Charts:** Use the Primary and Tertiary colors for positive data. Use a muted Coral (#F87171) only for negative financial trends, maintaining the "Motivating" vibe by keeping the palette mostly cool-toned.