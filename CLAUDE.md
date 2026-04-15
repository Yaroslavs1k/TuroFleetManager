# Turo Fleet Manager

## Project Overview
A professional fleet management web application for a Turo car-sharing business based in Las Vegas / Henderson, NV. Built as a single-file PWA (Progressive Web App) with vanilla JS, Chart.js, and localStorage.

## Architecture
- **index.html** -- Complete app in one file (HTML + CSS + JS)
- **manifest.json** -- PWA manifest for home screen installation
- **sw.js** -- Service worker for offline caching
- **server.js** -- Optional Node.js dev server
- **skill/SKILL.md** -- VIN lookup skill with 16-section fleet analysis
- **tools/** -- Python scripts for generating DOCX negotiation cards
- **depreciation-chart.html** -- Interactive Chart.js depreciation curve

## Design
- **Color palette**: Deep navy/charcoal (#161616, #10232A, #3D4D55) with warm gold (#B58863), warm cream (#D3C3B9), and sage green (#6dba7d)
- **Typography**: Rajdhani (headings) + Plus Jakarta Sans (body)
- **Layout**: Top nav with centered logo, tabs on left. Full-width responsive grid. Bottom nav on mobile.
- **Animations**: Viewport-triggered fade-up reveals, staggered stat card counters, Chart.js bar rising animations

## Features (v4.0)
1. **Dashboard** -- Bento grid stats, Chart.js revenue chart, upcoming bookings, maintenance due
2. **VIN Lookup** -- NHTSA API decode, pricing estimates, recalls, complaints, research links, Claude AI full report
3. **Fleet** -- Responsive vehicle card grid with per-vehicle stats
4. **Calendar** -- Monthly view with color-coded bookings and maintenance
5. **Finances** -- Revenue vs expenses Chart.js, per-vehicle P&L, expense log, Turo CSV import
6. **Settings** -- Fleet owner info, export/import data
7. **Command Palette** -- Ctrl+K search across all actions and vehicles

## Data Storage
All data in localStorage:
- `fleet` -- Vehicle roster
- `expenses` -- Expense log
- `bookings` -- Booking calendar
- `maintenance` -- Maintenance records

## APIs Used
- NHTSA VIN Decode (free): `https://vpic.nhtsa.dot.gov/api/vehicles/decodevinvalues/{VIN}?format=json`
- NHTSA Recalls (free): `https://api.nhtsa.gov/recalls/recallsByVehicle?make={make}&model={model}&modelYear={year}`
- NHTSA Complaints (free): `https://api.nhtsa.gov/complaints/complaintsByVehicle?make={make}&model={model}&modelYear={year}`

## Fleet Roster (Current)
- 2015 Nissan Altima 2.5 S -- Purchased $11,000, listed on Turo at $39-54/day, 4 trips

## Owner
Las Vegas / Henderson, NV. ZIP: 89014.

## Deployment
- **GitHub Pages URL**: `https://yaroslavs1k.github.io/TuroFleetManager/`
- **Push workflow**: `git add index.html && git commit -m "..." && git push origin main`
- **After push**: GitHub Pages updates in ~30–60 seconds

## gstack Skills
gstack is installed globally at `~/.claude/skills/gstack/`. Use these skills for deployment verification and QA:

### Skill routing
- Open a URL, verify deployment, take a screenshot, test the app → use `/browse`
- After pushing to GitHub Pages → use `/browse` to verify the live site loads correctly
- Comprehensive app testing (forms, navigation, state) → use `/qa`
- Code review before merge → use `/review`
- Debug a broken feature → use `/investigate`

### Key commands for this project
```
/browse https://yaroslavs1k.github.io/TuroFleetManager/
/qa
/review
/investigate
```

### Deployment verification workflow
After every `git push origin main`, optionally run:
```
/browse https://yaroslavs1k.github.io/TuroFleetManager/
```
This takes a screenshot, checks for console errors, and verifies the app loads.
