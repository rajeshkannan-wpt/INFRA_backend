# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v54.0.0/ before writing any code.

# Memory — Jarvis

- Jarvis already has a page in ONB v1.0 (the mobile onboarding flow, ONB-1.0 – ONB-1.7).
- Exact screen file not yet identified in the codebase — update this entry when known.

# Memory — Tech notes

- Phone formatting/validation uses `libphonenumber-js` (mobile metadata bundle): AsYouType input, E.164 length caps per country code, example placeholders. Source of truth — not `constants/countries.ts` lengths/format.
- OTP screen displays numbers via `formatInternational()` (country code + no trunk zero).
- Chats tab: new contact → draft chat view only; enters chats store after first message. Existing contact → matched by ID or digits-normalized phone → opens stored history.
- `Colors` export lives in `constants/countries.ts` (theme.ts was renamed); themed components import it from there.
- Known pre-existing type/lint issues remain in `(tabs)/explore.tsx` ×3 — intentionally untouched.
