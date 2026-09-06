// constants/typography.ts
// All fonts switched to Lato (@expo-google-fonts/lato).
// Mapping: Fraunces-Black -> Lato-Black, Fraunces-Italic -> Lato-Italic,
// SpaceGrotesk-Regular -> Lato-Regular, SpaceGrotesk-Medium -> Lato-Bold.
// Lato has no 500-Medium variant -> use Lato-Bold for medium-weight text.
export const Fonts = {
  /** Logo / wordmark — Lato black */
  logo: 'Lato-Black',
  /** Headings — Lato black */
  heading: 'Lato-Black',
  /** Normal / body text — Lato regular */
  body: 'Lato-Regular',
  /** Emphasized body text — Lato bold (no medium variant) */
  bodyMedium: 'Lato-Bold',
} as const;