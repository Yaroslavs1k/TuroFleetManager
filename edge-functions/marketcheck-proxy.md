# MarketCheck Proxy Edge Function — Deployment Guide

## What this is

A Supabase Edge Function that proxies calls from the Fleet Manager app to the MarketCheck API. The API key stays in Supabase secrets (not in public code). The app calls this function instead of MarketCheck directly.

## Deployment (5 minutes, all in Supabase dashboard)

### Step 1 — Add the secret

1. Open your Supabase project → **Project Settings** (bottom-left gear icon)
2. Click **Edge Functions** in the left sidebar
3. Click the **Secrets** tab
4. Click **Add new secret**
5. Name: `MARKETCHECK_KEY`
6. Value: paste your MarketCheck API key (`W2dn...b9`)
7. Save

### Step 2 — Create the function

1. In the sidebar, click **Edge Functions**
2. Click **Create a new function**
3. Name: `marketcheck-proxy`
4. Replace the default code with the code block below
5. Click **Deploy function**

### Step 3 — Code to paste

```typescript
// Supabase Edge Function: marketcheck-proxy
// Proxies VIN-based market comp lookups. Hides API key.

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const MARKETCHECK_KEY = Deno.env.get("MARKETCHECK_KEY");
const ALLOWED_ORIGINS = [
  "https://yaroslavs1k.github.io",
  "http://localhost:3000",
  "http://localhost:8080",
  "file://"
];

const corsHeaders = (origin: string) => ({
  "Access-Control-Allow-Origin": ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
});

serve(async (req) => {
  const origin = req.headers.get("origin") || "";

  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders(origin) });
  }

  if (!MARKETCHECK_KEY) {
    return new Response(
      JSON.stringify({ error: "Server not configured: MARKETCHECK_KEY missing" }),
      { status: 500, headers: { ...corsHeaders(origin), "Content-Type": "application/json" } }
    );
  }

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get("action") || "comps";
    const vin = url.searchParams.get("vin");
    const zip = url.searchParams.get("zip") || "89014";
    const radius = url.searchParams.get("radius") || "100";

    if (!vin || !/^[A-HJ-NPR-Z0-9]{17}$/i.test(vin)) {
      return new Response(
        JSON.stringify({ error: "Invalid VIN" }),
        { status: 400, headers: { ...corsHeaders(origin), "Content-Type": "application/json" } }
      );
    }

    let endpoint: string;

    if (action === "specs") {
      // Full vehicle specs including trim, MSRP, features
      endpoint = `https://mc-api.marketcheck.com/v2/decode/car/${vin}/specs?api_key=${MARKETCHECK_KEY}`;
    } else if (action === "listings") {
      // Active dealer listings for this exact VIN.
      // Verified 2026-04-17: MarketCheck's ?vins= filter is buggy and silently returns
      // year/make/model comps instead of filtering to the VIN. Strategy:
      //   1) Try /v2/listing/car/{VIN} — direct VIN endpoint (returns the specific car if indexed).
      //   2) Fall back to /search/car/active?vins=VIN and let the client filter by exact VIN match.
      const directRes = await fetch(
        `https://mc-api.marketcheck.com/v2/listing/car/${vin}?api_key=${MARKETCHECK_KEY}`
      );
      if (directRes.ok) {
        const direct = await directRes.json();
        // Normalize to the `{ listings: [...] }` shape the client expects
        const normalized = direct && direct.vin
          ? { listings: [direct], num_found: 1, source: "direct" }
          : { listings: [], num_found: 0, source: "direct-empty" };
        if (normalized.listings.length) {
          return new Response(
            JSON.stringify(normalized),
            { headers: { ...corsHeaders(origin), "Content-Type": "application/json" } }
          );
        }
      }
      // Fallback: search endpoint (client will filter by exact VIN match)
      endpoint = `https://mc-api.marketcheck.com/v2/search/car/active?api_key=${MARKETCHECK_KEY}&vins=${vin}`;
    } else {
      // Default: market comps for same year/make/model in ZIP radius
      // First decode to get year/make/model, then search comps
      const decodeRes = await fetch(
        `https://mc-api.marketcheck.com/v2/decode/car/${vin}/specs?api_key=${MARKETCHECK_KEY}`
      );
      if (!decodeRes.ok) {
        return new Response(
          JSON.stringify({ error: "VIN decode failed", status: decodeRes.status }),
          { status: decodeRes.status, headers: { ...corsHeaders(origin), "Content-Type": "application/json" } }
        );
      }
      const specs = await decodeRes.json();
      const year = specs.year;
      const make = specs.make;
      const model = specs.model;

      endpoint = `https://mc-api.marketcheck.com/v2/search/car/active?api_key=${MARKETCHECK_KEY}&year=${year}&make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}&zip=${zip}&radius=${radius}&rows=50`;

      const compsRes = await fetch(endpoint);
      const comps = await compsRes.json();

      // Compute summary stats
      const listings = comps.listings || [];
      const prices = listings.map((l: any) => l.price).filter((p: number) => p > 0);
      const miles = listings.map((l: any) => l.miles).filter((m: number) => m > 0);

      const summary = {
        count: listings.length,
        avg_price: prices.length ? Math.round(prices.reduce((a: number, b: number) => a + b, 0) / prices.length) : null,
        median_price: prices.length ? prices.sort((a: number, b: number) => a - b)[Math.floor(prices.length / 2)] : null,
        min_price: prices.length ? Math.min(...prices) : null,
        max_price: prices.length ? Math.max(...prices) : null,
        avg_miles: miles.length ? Math.round(miles.reduce((a: number, b: number) => a + b, 0) / miles.length) : null,
        listings: listings.slice(0, 10).map((l: any) => ({
          price: l.price,
          miles: l.miles,
          dealer: l.dealer?.name,
          city: l.dealer?.city,
          state: l.dealer?.state,
          vdp_url: l.vdp_url,
        })),
        specs: {
          year: specs.year,
          make: specs.make,
          model: specs.model,
          trim: specs.trim,
          msrp: specs.msrp,
          base_msrp: specs.base_msrp,
        },
      };

      return new Response(
        JSON.stringify(summary),
        { headers: { ...corsHeaders(origin), "Content-Type": "application/json" } }
      );
    }

    // Direct passthrough for specs / listings actions
    const res = await fetch(endpoint);
    const data = await res.json();

    return new Response(
      JSON.stringify(data),
      { status: res.status, headers: { ...corsHeaders(origin), "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Proxy error", message: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders(origin), "Content-Type": "application/json" } }
    );
  }
});
```

### Step 4 — Test it

After deploying, test from your browser. Replace `YOUR-PROJECT-REF` with your Supabase project ref (visible in the URL of your Supabase dashboard, like `yeohfqzdgvhwyjmezdii`):

```
https://YOUR-PROJECT-REF.supabase.co/functions/v1/marketcheck-proxy?vin=1N4AL3AP7FC411076&zip=89014
```

You should get back JSON with live dealer listings for 2015 Nissan Altima in the Las Vegas area.

If you see an error, check:
- Secret is named exactly `MARKETCHECK_KEY` (case-sensitive)
- The function deployed (green checkmark in dashboard)
- MarketCheck API key is valid (test it directly: `https://mc-api.marketcheck.com/v2/decode/car/1N4AL3AP7FC411076/specs?api_key=YOUR_KEY`)

### Step 5 — Tell me it's deployed

Once the test URL returns data, tell me "edge function deployed" and paste the project ref (or the full function URL) and I'll wire it into the app's VIN Lookup.

## Security notes

- API key lives only in Supabase Secrets, never in public code
- CORS restricted to your GitHub Pages domain + localhost
- VIN validation rejects anything that isn't a valid 17-char VIN format (prevents the proxy being used to hammer MarketCheck with junk)
- Since this is a proxy, MarketCheck's rate limits apply normally (1000 free calls/month)

## What the app will do with this data

- Replace fake segment-default MSRP with `specs.msrp` from MarketCheck
- Show real dealer comp count in your area
- Compute "asking vs market" delta — is this car priced above or below other dealers?
- Pull trim-specific baseline pricing
- Display 5-10 actual dealer listings with mileage + price + link for side-by-side
