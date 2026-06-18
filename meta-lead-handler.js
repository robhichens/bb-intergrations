# BB Integrations

Internal webhook endpoints for Bright Beginnings automations, hosted on Netlify.

## What's here

- `netlify/functions/meta-lead-handler.js` — receives a **Forest Lakes** lead
  (from Zapier's Facebook Lead Ads trigger, or any JSON POST) and forwards it to
  IntelliKid Systems (IKS) via the v2 "simplified" lead endpoint.

## Setup

1. **Environment variable** (Netlify → Site settings → Environment variables):
   - `IKS_API_TOKEN` = the IKS API v2 access token (Bearer token).
   - Never commit the token to this repo.

2. **Deploy** — connect this repo to the `bb-intergrations` Netlify site
   (Site settings → Build & deploy → link repository). Every push auto-deploys.

3. **Function URL** (once deployed):
   `https://bb-intergrations.netlify.app/.netlify/functions/meta-lead-handler`

## Test it

- **Is it alive?** Open the function URL in a browser (GET). You should see a JSON
  `{ status: "alive", token_configured: true, ... }`. If `token_configured` is
  false, the env var isn't set.
- **Does it forward?** POST a test lead (see below). A success returns
  `{ status: "forwarded", ... }`. Then confirm it appears in IKS, tagged
  Forest Lakes, source "Facebook Ads".

### Sample test POST (e.g. from Postman or VS Code REST Client)

```
POST https://bb-intergrations.netlify.app/.netlify/functions/meta-lead-handler
Content-Type: application/json

{
  "first_name": "Test",
  "last_name": "Lead",
  "email": "test.lead@example.com",
  "phone": "+14345550123",
  "child_age": "2",
  "start_when": "In the next few months"
}
```

## Location IDs (from GET /api/v2/lead/config)

- Forest Lakes: `1095544633769838116`  ← used by this handler
- Mill Creek:   `1095544633073582675`
- Crozet:       `1095544634151518630`

## Adding Mill Creek / Crozet later

Copy `meta-lead-handler.js` to `mill-creek-lead-handler.js` (and
`crozet-lead-handler.js`), change the `FOREST_LAKES_LOCATION_ID` constant and the
`utm_campaign` value at the top of each. Each gets its own function URL. Point
each campus's Zapier zap at the matching URL.
