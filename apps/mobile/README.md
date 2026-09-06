# Sealine Mobile

Expo (React Native) app for Sealine. Uses file-based routing with `expo-router`.

The project follows Expo's **Continuous Native Generation (CNG)** workflow, so it works with **both Expo Go and Android Studio**.

## Prerequisites

- Node.js >= 20
- pnpm (see root `package.json` `packageManager`)
- For Android Studio: Android Studio with an Android SDK + emulator/device

## Two ways to run

### 1. Expo Go (no native build required)

```bash
pnpm install
pnpm start
```

Scan the QR code with the Expo Go app:
- Android: scan from the Expo Go app, or press `a` (Connecting to Expo Go requires your phone and machine on the same network)
- Only JS-only + Expo Go-bundled native modules work here (all of this project's deps qualify)

### 2. Android Studio (native build)

The native `android/` folder is generated and gitignored. Generate it, then open it in Android Studio:

```bash
pnpm install
pnpm --filter sealine-mobile prebuild:android    # or: npx expo prebuild -p android
pnpm --filter sealine-mobile android             # or: npx expo run:android
```

Then open `apps/mobile/android` in Android Studio (File > Open) to edit native code,
or hit **Run** in Android Studio to build and install a development build onto an emulator/device.

> Whenever `app.json` changes (plugins, icons, package id, etc.), re-run `expo prebuild -p android`
> to keep the native project in sync. EAS Build / `expo run:android` do this automatically.

## Env

Copy `.env.example` to `.env` (already gitignored). `EXPO_PUBLIC_*` variables are inlined at build time.

## Scripts

| Script | Description |
| --- | --- |
| `pnpm start` | Start Metro (Expo Go / dev build / web) |
| `pnpm android` | Prebuild + compile + install a dev build on Android |
| `pnpm prebuild:android` | Generate/refresh the `android/` native project |
| `pnpm ios` | Compile + install a dev build on iOS simulator |
| `pnpm web` | Run in a browser |
| `pnpm lint` | ESLint |

## Project structure

- `app/` — expo-router routes
- `components/` — reusable UI
- `api/` — backend/mock/realtime clients
- `providers/` — session & theme context
- `hooks/` — shared hooks
- `constants/` — typography, countries, etc.