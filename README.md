# Turo Fleet Manager

A single-file fleet management app for Turo hosts. Tracks vehicles, bookings, finances, and maintenance. Runs as a PWA in the browser, installs to your phone/desktop, or ships as a native Windows app via Electron.

**Live demo:** https://yaroslavs1k.github.io/TuroFleetManager/

## Features

- **Dashboard** — revenue chart, fleet snapshot sorted by profit, break-even tracker, upcoming bookings, maintenance alerts, surge-event calendar by market
- **VIN Lookup** — NHTSA decode, KBB/Edmunds cross-reference, recalls, complaints, and a BUY / CAUTION / PASS verdict before you buy a car
- **Fleet** — vehicle cards with photos, filter by status, sort by profit/trips/rate
- **Calendar** — monthly view with color-coded bookings and maintenance
- **Finances** — revenue vs expenses chart, per-vehicle P&L, Turo CSV import
- **Team Management** — owner / driver / detailer roles with pending-request flow
- **Offline-first** — works without internet via service worker
- **Optional cloud sync** — Supabase backend for multi-device access

## Stack

- Vanilla JS + Chart.js (no framework)
- localStorage (primary) + Supabase (optional sync)
- Service worker for offline
- Electron + electron-builder for Windows desktop

## Running locally

### As a web app
Just open `index.html` in a browser. That's it.

Or serve it:
```
npx serve .
```

### As an Electron desktop app
```
npm install
npm start
```

### Build Windows installer
```
npm run build
```
Installer drops in `dist/`.

## Install as PWA

Visit the live URL in Chrome or Edge and click the install icon in the address bar. Adds to Start menu / home screen, runs in its own window, works offline.

## Deploy

GitHub Pages auto-publishes `main`. Push to deploy:
```
git add index.html
git commit -m "..."
git push origin main
```
Live site updates in 30-60 seconds.

## License

MIT
