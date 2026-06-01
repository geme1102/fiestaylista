---
name: Celebration Luxe
colors:
  surface: '#faf9f8'
  surface-dim: '#dadad9'
  surface-bright: '#faf9f8'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f4f3f2'
  surface-container: '#eeeeed'
  surface-container-high: '#e9e8e7'
  surface-container-highest: '#e3e2e1'
  on-surface: '#1a1c1c'
  on-surface-variant: '#574048'
  inverse-surface: '#2f3130'
  inverse-on-surface: '#f1f0ef'
  outline: '#8b7079'
  outline-variant: '#debec8'
  surface-tint: '#b4136d'
  primary: '#b10e6b'
  on-primary: '#ffffff'
  primary-container: '#d23284'
  on-primary-container: '#fffbff'
  inverse-primary: '#ffb0cd'
  secondary: '#904d00'
  on-secondary: '#ffffff'
  secondary-container: '#fe932c'
  on-secondary-container: '#663500'
  tertiary: '#4648d4'
  on-tertiary: '#ffffff'
  tertiary-container: '#6063ee'
  on-tertiary-container: '#fffbff'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#ffd9e4'
  primary-fixed-dim: '#ffb0cd'
  on-primary-fixed: '#3e0022'
  on-primary-fixed-variant: '#8c0053'
  secondary-fixed: '#ffdcc3'
  secondary-fixed-dim: '#ffb77d'
  on-secondary-fixed: '#2f1500'
  on-secondary-fixed-variant: '#6e3900'
  tertiary-fixed: '#e1e0ff'
  tertiary-fixed-dim: '#c0c1ff'
  on-tertiary-fixed: '#07006c'
  on-tertiary-fixed-variant: '#2f2ebe'
  background: '#faf9f8'
  on-background: '#1a1c1c'
  surface-variant: '#e3e2e1'
typography:
  display-lg:
    fontFamily: Outfit
    fontSize: 48px
    fontWeight: '900'
    lineHeight: 56px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Outfit
    fontSize: 32px
    fontWeight: '800'
    lineHeight: 40px
    letterSpacing: -0.01em
  headline-lg-mobile:
    fontFamily: Outfit
    fontSize: 28px
    fontWeight: '800'
    lineHeight: 34px
  headline-md:
    fontFamily: Outfit
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
  body-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  label-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
    letterSpacing: 0.05em
  caption:
    fontFamily: Plus Jakarta Sans
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 4px
  container-margin: 20px
  gutter: 16px
  section-gap-desktop: 80px
  section-gap-mobile: 40px
---

## Brand & Style
This design system is crafted for a premium Colombian gift list platform, balancing the warmth of local celebrations with high-end digital sophistication. The brand personality is joyful, aspirational, and meticulously organized. It evokes an emotional response of excitement and trust, positioning the platform as a concierge for life's most precious milestones.

The visual direction utilizes **Glassmorphism** combined with a **Corporate Modern** structure. By layering translucent surfaces over soft, warm backgrounds, the UI achieves a sense of depth and lightness. The aesthetic is "Social-First," prioritizing vibrant gradients and celebratory imagery to reflect the festive nature of Weddings, Baby Showers, and Birthdays.

## Colors
The palette is centered around a vibrant Rose primary gradient that signifies passion and celebration. A dedicated "Cash Fund Gold" (#D97706) is used to highlight financial gifts, providing a psychological link to value and tradition.

**Surface Strategy:**
- **Light Mode:** Uses #FAF9F8 (Off-white/Stone) as the base to keep the interface feeling "airy" and editorial.
- **Dark Mode:** Uses #0B0F19 (Deep Navy) to allow gradients and glass effects to glow with a neon-like premium quality.
- **Event Contexts:** The UI dynamically shifts its accent colors based on the event type (e.g., Indigo for Weddings, Sky for Baptisms) while maintaining the global Rose gradient for primary actions to ensure brand consistency.

## Typography
The typography pairing balances high-impact geometry with modern readability. **Outfit** is utilized for headings at heavy weights (800-900), providing a confident, fashion-forward look reminiscent of luxury event invitations. 

**Plus Jakarta Sans** serves as the functional workhorse for body text and interface labels. Its soft curves complement the Outfit headlines while ensuring high legibility for long lists of gift items and registry descriptions. For mobile, headline sizes are aggressively scaled down to prevent awkward wrapping on small devices while maintaining their visual weight.

## Layout & Spacing
The system follows a **Mobile-First** philosophy, optimized for the "on-the-go" nature of event planning. 

- **Grid:** A 12-column fluid grid for desktop with wide 24px gutters. For mobile, a 4-column grid with 20px side margins to ensure content doesn't feel cramped against the screen edges.
- **Bottom Navigation:** On mobile, primary navigation is anchored to the bottom using a glassmorphic bar. This ensures "thumb-friendly" access to the Registry, Home, and Account views.
- **Rhythm:** An 8pt linear scaling system is used for component internal spacing, while layout sections use larger increments (40px/80px) to create the generous whitespace characteristic of premium brands.

## Elevation & Depth
Depth is created through **Glassmorphism** and **Ambient Shadows** rather than traditional heavy borders.

1.  **The Base Layer:** Solid background (#FAF9F8 or #0B0F19).
2.  **The Glass Layer:** Cards and Modals use a backdrop-blur (12px to 20px) with a semi-transparent white or gray fill. A subtle 1px white border (20% opacity) is applied to "catch the light" on the edges of these glass elements.
3.  **The Shadow Layer:** Primary elements (like CTA buttons) use a "Glow Shadow" — a soft, diffused shadow tinted with the primary color (`shadow-rose-500/20`). This makes the elements feel as though they are emitting light onto the glass surfaces beneath them.

## Shapes
The shape language is consistently **Rounded**, avoiding sharp corners to maintain a friendly and welcoming tone. 

- **Standard Elements:** Input fields, list items, and small cards use `rounded-xl` (0.5rem / 12px-16px).
- **Featured Elements:** Main call-to-action buttons and large product cards use `rounded-2xl` to feel more tactile and "squishy."
- **Interactive Triggers:** Avatars and icon-only buttons use a full circle/pill shape to distinguish them from structural content.

## Components
- **Buttons:** Primary buttons must use the Rose-to-Fuchsia gradient with white text and a `shadow-lg` tinted in Rose. Secondary buttons should be glass-styled with a 1px border.
- **Input Fields:** Rounded-xl with a light gray border. Upon focus, they transition to a 2px Rose ring with a subtle inner glow. 
- **Gift Cards:** These use a vertical stack: a high-quality product image at the top with a `rounded-lg` clip, followed by typography and a "Add to Registry" button. The card background itself is glassmorphic.
- **Bottom Nav (Mobile):** A fixed glass bar with an active state indicated by a small gradient dot beneath the icon or a color shift to the primary Rose.
- **Cash Fund Widget:** Always uses the Gold (#D97706) palette to differentiate it from physical products, often featuring a subtle "shimmer" animation to denote its special status.
- **Progress Bars:** Used for "Fundraising" goals, these should utilize the primary gradient against a light-gray track.