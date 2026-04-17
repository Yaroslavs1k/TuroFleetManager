# Turo Fleet Manager

## Project Overview
A professional fleet management app for a Turo car-sharing business based in Las Vegas / Henderson, NV. Single-file PWA (vanilla JS + Chart.js + localStorage) with optional Supabase cloud sync and an Electron desktop wrapper.

## Architecture
- **index.html** — entire app in one file (HTML + CSS + JS, ~3400 lines)
- **main.js** — Electron entry point (loads index.html in a BrowserWindow)
- **manifest.json** — PWA manifest for home-screen install
- **sw.js** — service worker for offline caching
- **package.json** — Electron build config (electron-builder → NSIS installer for Windows)

## Current Version
`v6.0` (string hardcoded in `index.html`, line 426 and line 3013 About card).
`package.json` still reads `4.0.0` — bump when cutting a new `.exe` release.

## Design
- **Palette:** deep navy/charcoal (`#161616`, `#10232A`, `#3D4D55`) with warm gold (`#B58863`), cream (`#D3C3B9`), sage (`#6dba7d`)
- **Typography:** Rajdhani (headings), Plus Jakarta Sans (body)
- **Layout:** top nav with centered logo, tabs on left, full-width responsive grid, bottom nav on mobile
- **Animations:** viewport-triggered fade-ups, staggered stat-card counters, Chart.js bar rise

## Features (v6.0)
1. **Dashboard** — bento-grid stats, revenue chart, fleet snapshot (all vehicles, sorted by profit), break-even per vehicle, upcoming bookings, maintenance due, dynamic surge events from selected market
2. **VIN Lookup** — NHTSA decode, KBB/Edmunds pricing cross-reference, recalls, complaints, research links, full Claude AI report, **Quick Buy Decision card** (BUY / CAUTION / PASS verdict), pre-filled add-to-fleet modal
3. **Fleet** — responsive vehicle cards with photos, per-vehicle stats, filter pills (All / Listed / Unlisted / Needs Maintenance), sort dropdown (Profit / Trips / Rate / Newest)
4. **Calendar** — monthly view, color-coded bookings and maintenance, surge events pulled from selected market
5. **Finances** — revenue vs expenses chart, per-vehicle P&L, expense log, Turo CSV import with preview, vehicle filter, expense category chips
6. **Settings** — fleet owner info, in-app notifications (maintenance/booking/detail reminders), full JSON export/import of all data
7. **Team Management** — multi-user teams with owner/driver/detailer roles, pending-request flow
8. **Command Palette** — Ctrl+K search across actions and vehicles
9. **Mobile polish** — 2-col stat cards on tablet, 1-col on phone, 44px touch targets

## Data Storage
All data in localStorage, optionally synced to Supabase:
- `fleet` — vehicle roster
- `expenses` — expense log
- `bookings` — booking calendar
- `maintenance` — maintenance records
- `worklog`, `payhistory`, `payrates` — team labor tracking

## Supabase Cloud Sync (v1.0)
- Optional — app works fully offline without it
- Anon key + URL stored in `index.html` (line ~433); RLS enforces per-team access
- `syncAllFromSupabase()` pulls on launch; changes push on write

## APIs Used
- NHTSA VIN Decode (free): `https://vpic.nhtsa.dot.gov/api/vehicles/decodevinvalues/{VIN}?format=json`
- NHTSA Recalls (free): `https://api.nhtsa.gov/recalls/recallsByVehicle?make={make}&model={model}&modelYear={year}`
- NHTSA Complaints (free): `https://api.nhtsa.gov/complaints/complaintsByVehicle?make={make}&model={model}&modelYear={year}`
- Supabase (user-provided instance)

## Owner
Iaroslav "Yaro" Savenkov. Las Vegas / Henderson, NV area.

## Deployment

### GitHub Pages (web)
- Live URL: `https://yaroslavs1k.github.io/TuroFleetManager/`
- Push workflow: `git add index.html && git commit -m "..." && git push origin main`
- Pages redeploys in 30–60s after push

### Electron desktop (Windows)
- Dev: `npm start`
- Build installer: `npm run build` (outputs NSIS `.exe` to `dist/`)
- Shortcut name: "Turo Fleet Manager"

### PWA install
- Chrome/Edge → install icon in address bar → adds to Start menu / home screen
- Works offline after first load (service worker)

## Privacy Note
No real VINs, names, or addresses are hardcoded in source. Seed fleet data was scrubbed; git history was rewritten to remove it from all past commits.

## gstack Skills
gstack installed globally at `~/.claude/skills/gstack/`. Key routes:
- Verify deploy / screenshot / test live site → `/browse`
- Comprehensive QA pass → `/qa`
- Code review before merge → `/review`
- Debug broken feature → `/investigate`
- Ship / deploy → `/ship`

### Common commands
```
/browse https://yaroslavs1k.github.io/TuroFleetManager/
/qa
/review
/investigate
```

### After every push
```
/browse https://yaroslavs1k.github.io/TuroFleetManager/
```
Takes a screenshot, checks console errors, verifies live load.

## Skill routing

When the user's request matches an available skill, ALWAYS invoke it using the Skill
tool as your FIRST action. Do NOT answer directly, do NOT use other tools first.

Key routing rules:
- Product ideas, brainstorming → invoke office-hours
- Bugs, errors, "why is this broken" → invoke investigate
- Ship, deploy, push, create PR → invoke ship
- QA, test the site, find bugs → invoke qa
- Code review, check my diff → invoke review
- Update docs after shipping → invoke document-release
- Weekly retro → invoke retro
- Design system, brand → invoke design-consultation
- Visual audit, design polish → invoke design-review
- Architecture review → invoke plan-eng-review
- Save progress, checkpoint, resume → invoke checkpoint
- Code quality, health check → invoke health
- Browser testing, verify live site → invoke browse
