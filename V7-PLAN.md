# TuroFleetManager v7.0 Plan

**Status:** Draft for review. No code changes yet.
**Owner:** Yaro (Iaroslav Savenkov)
**Context:** Turo fleet manager, 1 car today (2015 Nissan Altima in Las Vegas), co-run with dad. v6.0 currently shipped.
**Source:** Full audit by 2 specialized agents on 2026-04-16. Findings below are real, verified against `index.html` at specific line numbers.

---

## Guiding principles

1. **Fix broken things before building new things.** There's a silent revenue bug right now making dashboard numbers wrong. That's #1.
2. **Match complexity to scale.** 1 car = no team-management features, no 9-market surge calendars. Cut it.
3. **Protect the killer feature.** VIN Lookup is genuinely excellent — don't destabilize it while refactoring.
4. **No premature refactor.** Keep the single-file + no-build setup until real friction forces a split.
5. **Every feature must answer a business decision.** If it doesn't help decide buy/sell/price/service, it's bloat.

---

## Phase 1 — Stop the bleeding (critical fixes)

**Estimated effort:** 2–3 hours
**Goal:** App works correctly. Numbers are trustworthy. Users actually receive deploys. No obvious security holes.

### 1.1 Fix silent revenue bug [CRITICAL]
**File:** `index.html:1418`
**Problem:** Dashboard per-vehicle monthly revenue uses `x.date` but bookings store the field as `x.start`. Every vehicle shows $0/month. Break-even calculations are wrong. Profitability sort is meaningless.
**Fix:** `x.date||''` → `x.start||''`
**Verification:** Log a booking with revenue, confirm dashboard now shows real numbers.

### 1.2 Service worker cache versioning [CRITICAL]
**File:** `sw.js:3`
**Problem:** `CACHE_NAME='fleet-mgr-v1'` is static. When you `git push`, PWA users keep serving the old `index.html` from cache forever. Every deploy you've done since installing PWA has been invisible.
**Fix:**
- Bump `CACHE_NAME` per release (e.g. `fleet-mgr-v6.1`)
- Change fetch strategy for `index.html` to network-first with cache fallback
- Only cache responses where `resp.ok === true`
**Verification:** Deploy, confirm installed PWA picks up new version within a page reload.

### 1.3 XSS hardening [HIGH]
**File:** `index.html` — 20+ locations using `innerHTML` with user data
**Problem:** Team names, guest names, maintenance descriptions, incident notes all interpolated into HTML without escaping. A malicious team name like `<img src=x onerror=fetch(...)>` could steal the Supabase session token.
**Fix:** Add helper:
```js
const esc = s => String(s||'').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
```
Wrap every interpolated user field. Audit: team name, vehicle make/model/trim, guest, incident description, maintenance type, notification title/body.
**Verification:** Create a vehicle with name `<script>alert(1)</script>`, confirm it renders as literal text.

### 1.4 Collapse dual write paths [HIGH]
**File:** `index.html:604-690` and `757-789`
**Problem:** Two competing systems write to the same Supabase tables. `D.sFleet()` uploads the *entire fleet array* on any single edit. `DB.saveVehicle()` does targeted single-row upserts. Both fire on overlapping user actions. Multi-device = last-writer-wins on the entire table.
**Fix:** Delete the `D.sFleet/sExps/sBook/sMaint` bulk-upload paths. Use only `DB.*` targeted upserts.
**Verification:** Network tab shows 1 request per edit, not N.

### 1.5 Stale localStorage auto-login [HIGH]
**File:** `index.html:1164`
**Problem:** If `cu` (current user) is in localStorage and team exists, `launch()` runs immediately without verifying the Supabase session is still valid. Anyone with DevTools can paste a `cu` object and become you.
**Fix:** Always verify `sb.auth.getSession()` before launching when `CONFIGURED=true`. If invalid, redirect to login.

### 1.6 Superadmin hash replacement [MEDIUM]
**File:** `index.html:431-432`
**Problem:** `SA_HASH` + fixed salt `'FleetManagerSalt2026'` + plain SHA-256 = offline brute-forceable in seconds. Source is public on GitHub.
**Fix:** Two options:
- (a) Delete the superadmin back door entirely. The `isDev(email)` check already grants owner role to your email. That's enough.
- (b) Move SA check to a Supabase edge function with rate limiting.
**Recommendation:** Option (a). You don't need a separate SA tier.

### 1.7 Supabase RLS audit [CRITICAL — YOU DO THIS IN SUPABASE DASHBOARD]
**Not code — manual verification.**
1. Supabase dashboard → Database → Tables
2. For each table (`vehicles`, `expenses`, `bookings`, `maintenance`, `teams`, `team_members`, `profiles`, etc.), verify "RLS enabled" badge is ON
3. For each table, click Policies → confirm policies scope rows to `auth.uid()` or `team_id` that the user belongs to
4. If ANY table shows RLS disabled, your publishable key in public GitHub = anyone reads/writes that table
**I'll walk you through this when we start Phase 1.**

### Phase 1 acceptance criteria
- [ ] Dashboard revenue shows real numbers per vehicle
- [ ] Force-deploy a cosmetic change, verify PWA picks it up on reload
- [ ] Vehicle name with `<script>` renders as literal text
- [ ] Network tab shows 1 Supabase write per edit, not many
- [ ] Clearing session storage but keeping `cu` does not auto-launch
- [ ] Superadmin path removed OR hardened
- [ ] RLS verified on all Supabase tables

---

## Phase 2 — Data foundation (enables everything after)

**Estimated effort:** 1 day
**Goal:** Data model is correct. Multi-device is safe. Nothing silently corrupts.

### 2.1 Vehicle references: array-index → UUID
**Files:** `index.html` throughout
**Problem:** Bookings store `ci: 0` (car index in the fleet array). Delete a vehicle, all booking history shifts by one — expenses get attributed to the wrong car.
**Fix:**
- Vehicles already have `id` field when stored in Supabase. Use it everywhere.
- Migrate legacy data: on launch, if any booking has `ci` but no `vehicleId`, look up the car at that index and assign `vehicleId = fleet[ci].id`. Then treat `ci` as legacy/fallback.
- Update render paths (`renderDash`, `renderFin`, `renderCal`) to join on `vehicleId`.
**Risk:** This is the most invasive change. Do it in one commit with a migration function that runs once and writes a migration-complete flag.

### 2.2 Add `updated_at` + conflict detection
**File:** `index.html` — Supabase write paths
**Problem:** Multi-device writes can silently overwrite. No way to know "your dad just changed this 30 seconds ago."
**Fix:**
- Every write includes `updated_at: new Date().toISOString()`
- Before writing, do a `SELECT updated_at` and compare. If server is newer than last-read local, show a conflict warning: "Dad changed this at 3:14 PM — keep yours / use his?"
- For now, log to activity feed so you can see conflicts after the fact

### 2.3 Sync status indicator
**Location:** Top nav, next to logo
**Shows:** "● Synced" (green) / "⟳ Syncing…" (amber) / "⚠ Offline (3 pending)" (red) / "Last synced 14m ago"
**Why:** Right now sync is invisible. You don't know if your edits made it to the cloud until you reload on another device and find they didn't.

### 2.4 Soft deletes with 30-day recovery
**Files:** `index.html:515` and all `.delete()` calls
**Problem:** Deletes are hard. Accidentally removing a vehicle wipes all history.
**Fix:** Add `deleted_at` column. Instead of deleting, set `deleted_at = now()`. Filter `is.null(deleted_at)` on reads. Add a "Trash" section in Settings with 30-day restore.

### 2.5 Fix `sbRead` cache TTL
**File:** `index.html:473-475`
**Problem:** Comment claims 30-second cache but code has no TTL check.
**Fix:** Store `{t: Date.now(), data}` and check `Date.now() - cached.t < 30000`.

### 2.6 Export backup rotation
**File:** `index.html:3359-3381`
**Problem:** Export-All is a single JSON blob with identical filename each time.
**Fix:** Timestamp filenames (`fleet-backup-2026-04-16.json`), keep rolling last 12 in IndexedDB, one-click restore from any.

### Phase 2 acceptance criteria
- [ ] Delete a vehicle, booking history stays attached to the right car (via UUID)
- [ ] Simulate multi-device write conflict, see the conflict warning
- [ ] Offline edit + come back online = sync indicator shows pending queue, then flushes
- [ ] Deleted vehicle recoverable from trash within 30 days
- [ ] Cache staleness visibly fixes itself after 30s

---

## Phase 3 — Focus the product (cut bloat)

**Estimated effort:** 1 day
**Goal:** Every feature earns its keep. Dashboard shows what matters most.

### 3.1 Dashboard hierarchy reshuffle
**File:** `index.html:1466-1469`
**Problem:** Stat cards go Fleet Value → Active → Revenue → Occupancy. At 7 AM on your phone you want to answer "did money come in and is the car rented today?"
**Fix:** Reorder to: **Net Profit MTD → Revenue MTD → Occupancy → Next Booking ETA**. Fleet Value moves to a smaller secondary row.

### 3.2 Keep roles, trim other bloat
**Decision:** Team Management + roles stay fully functional — Yaro wants them ready for future employees. No flag, no hide.
**Still flag off / remove:**
- Worklog / Pay rates / Pay history (not useful at current scale; revisit when you have a paid employee clocking hours)
- Superadmin panel (see Phase 1.6 — kill it)
**Role audit while we're there:** review the 8 existing roles (owner/manager/mechanic/detailer/delivery_driver/accountant/employee/superadmin). Confirm which ones you actually plan to use so we can make sure each role has sensible permissions defined now, before you invite anyone. Worth a 10-min conversation before we start Phase 3.
**Mechanism for worklog hide:** Add `FEATURES = {worklog: false}` at top of `index.html`. Wrap nav entries, modals, render calls in `if(FEATURES.worklog)`. Keep the code.

### 3.3 Delete unused market surge data
**File:** `index.html:1446-1508` (MARKETS object)
**Action:** Keep only Las Vegas + maybe 2 others you might actually expand to. Delete the rest. Probably saves 5–10 KB of inline data.

### 3.4 Consistent empty states
**Pattern (already used on Dashboard):** Icon + short message + primary CTA button
**Apply to:** Finances (no expenses yet), Calendar (no bookings), Fleet (no vehicles — already has it), VIN Lookup (no searches yet)

### 3.5 Loading skeletons
**Problem:** Supabase sync happens on login invisibly. Users see old data then it pops to new.
**Fix:** Show skeleton cards (grey rectangles with shimmer) on tab content until sync completes for that tab.

### 3.6 Typography fix for small numbers
**Problem:** Rajdhani at ≤12px in stat cards loses legibility.
**Fix:** Use Plus Jakarta Sans (body font) for any number ≤12px. Keep Rajdhani for headers and large stat values.

### Phase 3 acceptance criteria
- [ ] Dashboard first card = Net Profit MTD
- [ ] Team Management fully functional, roles kept live (per Yaro's decision)
- [ ] Role permission matrix documented for each of the 8 roles
- [ ] Worklog / Pay rates hidden behind feature flag (code preserved)
- [ ] All empty states follow same icon+message+CTA pattern
- [ ] Tab switches show skeletons until data loads
- [ ] MARKETS object slimmed to 1–3 markets

---

## Phase 4 — Capture loop (v7.0 feature release)

**Estimated effort:** 1 week
**Goal:** Close the gaps where real fleet operations lose money or waste time.

### 4.1 Photo check-in/check-out [HIGHEST ROI]
**Flow:** At trip start, 4-corner photos + odometer photo, upload to Supabase Storage, attach to booking. Same at end. Side-by-side diff view for damage disputes.
**Why:** Biggest real-world pain for Turo hosts is guest damage disputes. Turo's own app handles this poorly. Having timestamped photos with odometer readings wins you disputes.
**Storage cost:** Supabase Storage free tier = 1 GB, ~1000 photos at 1 MB each. Compress to 400 KB → 2500 photos. Years of runway.

### 4.2 Turo CSV monthly auto-prompt
**Files:** existing `importCSV()` + `_getAmt()` in `index.html`
**Problem:** Revenue data is empty because CSV import is manual and you forget.
**Fix:**
- On the 1st of each month, dashboard banner: "Import last month's Turo earnings"
- One-tap CSV picker
- Dedupe on trip ID — re-importing is safe
- Preview the mapping before commit (which column = revenue, which = trip ID)

### 4.3 Push notifications for real alerts
**Types:**
- Insurance renewal: 30/14/3 days out
- Registration renewal: 30/14/3 days out
- Maintenance overdue: daily until addressed
- New booking confirmed: immediate
**Mechanism:** Web Push API (works in installed PWA on desktop + Android). iOS requires PWA install on home screen (works since iOS 16.4).

### 4.4 iCal export for bookings + maintenance
**Why:** You already track bookings. Export as `.ics` subscription URL so it shows up on iPhone Calendar, Google Calendar. No more dual-entry.
**Implementation:** Generate iCalendar format string on demand, serve as `Calendar Subscription` link from Settings.

### Phase 4 acceptance criteria
- [ ] Take 4-corner photos + odometer on a test trip, upload, view side-by-side diff
- [ ] Dismiss CSV prompt, gets re-shown next month
- [ ] Receive push notification for a test maintenance alert
- [ ] Subscribe to calendar URL on iPhone, see upcoming bookings

---

## Phase 5 — Decision superpowers (v7.1)

**Estimated effort:** 1 week
**Goal:** App directly supports the 5 decisions that matter: which car to buy, what to charge, when to sell, when to service, am I profitable.

### 5.1 Schedule C tax export
**Output:** IRS Schedule C-formatted PDF or CSV, grouped into line items:
- Part I Line 1: Gross receipts (all booking revenue)
- Part II Line 9: Car & truck expenses (mileage or actual)
- Part II Line 15: Insurance
- Part II Line 21: Repairs and maintenance
- Part II Line 22: Supplies
- Part II Line 13: Depreciation (Section 179 from VIN analyzer)
**Why:** Saves 4 hours in April. Makes your CPA cheaper (less reconciliation work).

### 5.2 "Best next car" recommender
**Inputs:** Budget range, market (Las Vegas), your existing fleet (to avoid duplication)
**Outputs:** 3–5 candidate vehicle segments with expected monthly profit, break-even, risk score
**Data source:** Reuses VIN Lookup market model + depreciation curves already built
**UI:** New tab or section under VIN Lookup. "Given $15k, what should I buy?"

### 5.3 Cashflow forecast (next 30 days)
**Inputs:** Upcoming confirmed bookings, recurring expenses (insurance monthly, payment, avg maintenance), pending invoices
**Output:** Day-by-day cash position chart
**Answers:** "Can I afford the down payment on car #2 by July?"

### 5.4 VIN Lookup mobile TL;DR mode
**Problem:** 14-section report is too long to scroll at a dealership.
**Fix:** Collapsible "TL;DR" toggle at top showing only:
- Quick Buy Decision card
- Negotiation Card (target/max/walk-away)
- Recalls/complaints summary (1 line each)
- Expand to see everything else

### 5.5 Live asking-price slider in VIN Lookup
**Problem:** At a dealership, you want to see "what if he drops to $12.5k?" in real time.
**Fix:** Asking-price input becomes a slider. Verdict card re-computes on slide. Watch BUY/CAUTION/PASS flip as you negotiate mentally.

### Phase 5 acceptance criteria
- [ ] Generate Schedule C export for fake full year, verify numbers match manual calc
- [ ] "Best next car" returns 3 specific segment recommendations with reasoning
- [ ] Cashflow chart shows realistic 30-day forward projection
- [ ] VIN Lookup TL;DR toggle works on mobile
- [ ] Slider in VIN Lookup re-computes verdict live

---

## Phase 6 — Deferred (not now, maybe never)

These are tempting but not worth the effort right now:

- **Module split** — Only when single-file friction actually slows you down. Today it doesn't.
- **Native Turo API integration** — Turo has no public host API. Don't chase.
- **Competitor price scraper** — Gray area on Turo ToS. Skip.
- **Multi-market expansion** — Until you actually operate outside Las Vegas, don't pay the complexity tax.
- *(Team Management moved from deferred to active — kept live for future hires.)*

---

## Rollout strategy

1. **Phase 1 ships first**, as one commit per fix, tested live before the next.
2. **Phase 2 ships as one big commit** (the UUID migration needs atomicity).
3. **Phase 3 ships as incremental polish.**
4. **Phase 4 and 5 become v7.0 and v7.1 named releases.**
5. **After each phase:** run `/browse` on live site, verify visually, then move on.

## Risks and open questions

- **RLS status unknown.** Before anything else, verify RLS is on for all Supabase tables. If it's off, your data is public-readable right now.
- **Migration safety for UUID switch.** Need a dry-run mode that shows the proposed mapping before committing.
- **Photo storage costs at scale.** Fine at 1 car. At 10 cars × 50 trips/mo × 10 photos = 5000 photos/mo. Budget for Supabase tier upgrade around car #5.
- **Push notification reliability on iOS.** Requires PWA install on home screen. Desktop Chrome/Edge is solid.

## Estimated total effort

| Phase | Effort | Outcome |
|---|---|---|
| 1 | 2–3 hrs | App numbers correct, deploys visible, no XSS, RLS verified |
| 2 | 1 day | Multi-device safe, soft deletes, sync transparency |
| 3 | 1 day | Dashboard right, bloat gone, polish consistent |
| 4 | 1 week | Photos, CSV auto-prompt, push alerts, calendar sync |
| 5 | 1 week | Tax export, next-car recommender, cashflow, mobile VIN |

**Total v7.x delivery: ~2.5 weeks of focused work spread over whenever.**

---

## What I need from Yaro

1. **Approve or edit this plan.** Reorder phases, add/remove features, push back on anything that feels wrong.
2. **Confirm Supabase RLS status** before Phase 1 starts. Screenshot of Tables page is ideal.
3. **Decide: kill superadmin or keep it?** (recommendation: kill)
4. **Pick where to start.** Phase 1.1 (revenue bug) is the obvious answer, but you're the boss.

---

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 0 | — | — |
| Codex Review | `/codex review` | Independent 2nd opinion | 0 | — | — |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 0 | — | — |
| Design Review | `/plan-design-review` | UI/UX gaps | 0 | — | — |
| DX Review | `/plan-devex-review` | Developer experience gaps | 0 | — | — |

**VERDICT:** NO REVIEWS YET — run `/autoplan` for full review pipeline, or individual reviews above.
