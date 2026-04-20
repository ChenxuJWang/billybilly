# billybilly

An expense management app. The main app lives in [`expense-tracker`](./expense-tracker).

## Hosting Setup

`expense-tracker` is configured as a static Vite SPA with Firebase Auth and Firestore on the client side.

- Firebase Hosting is the primary deployment target.
- GitHub Actions runs CI on every PR and push to `main`.
- Pull requests deploy preview builds with the dev web app config.
- Pushes to `main` deploy the live tester site with the prod web app config.

## Local Development

1. `expense-tracker/.env.development` already contains the current dev Firebase web app config.
2. `expense-tracker/.env.production` contains the production Firebase web app config for the separate prod project.
3. If you want local overrides, copy [`expense-tracker/.env.example`](./expense-tracker/.env.example) to `expense-tracker/.env.local` and adjust values there.
4. Run:

```bash
cd expense-tracker
npm ci
npm run dev
```

## Firebase Project Layout

This repo is wired to separate Firebase projects for environment isolation:

- `dev` project `billybilly-8f5a5`: used by local development and GitHub preview deployments.
- `prod` project `billybilly-prod`: used by the tester-facing site deployed from `main`.

For local CLI use, copy [`expense-tracker/.firebaserc.example`](./expense-tracker/.firebaserc.example) to `expense-tracker/.firebaserc`.

The Firebase Hosting config lives in [`expense-tracker/firebase.json`](./expense-tracker/firebase.json) and rewrites all routes to `index.html` so `BrowserRouter` refreshes work on hosted environments.

## GitHub Configuration

Add these repository variables for preview builds:

- `VITE_FIREBASE_API_KEY_DEV`
- `VITE_FIREBASE_AUTH_DOMAIN_DEV`
- `VITE_FIREBASE_PROJECT_ID_DEV`
- `VITE_FIREBASE_STORAGE_BUCKET_DEV`
- `VITE_FIREBASE_MESSAGING_SENDER_ID_DEV`
- `VITE_FIREBASE_APP_ID_DEV`

Add these repository variables for production builds:

- `VITE_FIREBASE_API_KEY_PROD`
- `VITE_FIREBASE_AUTH_DOMAIN_PROD`
- `VITE_FIREBASE_PROJECT_ID_PROD`
- `VITE_FIREBASE_STORAGE_BUCKET_PROD`
- `VITE_FIREBASE_MESSAGING_SENDER_ID_PROD`
- `VITE_FIREBASE_APP_ID_PROD`

Add these repository secrets:

- `FIREBASE_SERVICE_ACCOUNT_DEV`
- `FIREBASE_SERVICE_ACCOUNT_PROD`

The workflows are:

- [`expense-tracker-ci.yml`](./.github/workflows/expense-tracker-ci.yml): runs `npm ci`, `npm run lint`, and `npm run build`.
- [`expense-tracker-preview.yml`](./.github/workflows/expense-tracker-preview.yml): builds with the dev Firebase web app config and deploys a 30-day Firebase preview for each PR.
- [`expense-tracker-live.yml`](./.github/workflows/expense-tracker-live.yml): builds with the prod Firebase web app config and deploys the live Hosting site on pushes to `main`.

In GitHub branch protection, make the CI workflow a required status check before merging to `main`.

## Alternative Static Hosts

- [`expense-tracker/vercel.json`](./expense-tracker/vercel.json) enables SPA rewrites for Vercel.
- [`expense-tracker/public/_redirects`](./expense-tracker/public/_redirects) enables SPA rewrites for Netlify.
- Cloudflare Pages can host the same `dist/` output; configure it to build `expense-tracker` with `npm run build`.

## Tester Smoke Checklist

Run this after each deploy to the live tester URL:

- Sign up and sign in.
- Create a ledger.
- Import transactions.
- Invite another user.
- Refresh a non-root route like `/transactions` or `/settings`.

## Notes

- The current browser-side LLM API key flow remains unchanged for now. If you later want to use an app-owned shared key, add a serverless proxy before exposing that key to testers.
- The existing Dockerfile is not part of the recommended hosting path for the F&F rollout.
- With the current env files, dev and prod no longer share the same Firestore/Auth/Storage resources.
