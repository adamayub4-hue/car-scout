# Mekivo

Mekivo is a responsive UK car and parts discovery service. It shows live eBay search results and prepares outbound searches for other marketplaces, with registration/manual vehicle selection and a generic visual parts guide.

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Current MVP

- Multi-marketplace car search and live eBay Browse API results
- Registration-first or manual parts journey
- Original interactive vehicle-system and parts naming guide
- Parts catalogue and direct OEM/manufacturer-number search
- Model-family reference photographs with Wikimedia Commons attribution
- Responsive mobile and desktop interface
- Clear marketplace hand-off and compatibility guidance

The public registration route uses DVLA vehicle data, enriched with the DVSA MOT History API model when available. The visual guide is already available and is a generic naming/location aid, not a diagram of the selected vehicle. Vehicle-specific OEM diagrams, OE references and fitment data are not integrated. They require provider production access and appropriate display/caching rights; there is no feature flag that supplies that data. See [provider readiness](docs/vehicle-diagram-provider.md).

## Service configuration

| Service | Environment variables | Behaviour without it |
| --- | --- | --- |
| Accounts | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Account features unavailable |
| eBay | `EBAY_CLIENT_ID`, `EBAY_CLIENT_SECRET` | Marketplace handoffs remain available; live results return a configuration message |
| Registration | `DVLA_API_KEY`, `ENABLE_DVLA_LOOKUP=true` | Manual make/model entry remains available |
| Optional model enrichment | `DVSA_MOT_API_KEY`, `DVSA_MOT_CLIENT_ID`, `DVSA_MOT_CLIENT_SECRET`, `DVSA_MOT_TOKEN_URL`, `DVSA_MOT_SCOPE` | DVLA details remain usable; the user selects the model |

All provider credentials are server-only. Do not prefix secrets with `NEXT_PUBLIC_`. No new paid provider is required for the current guide. [API operations](docs/api-operations.md) documents timeouts, caching and the remaining production quota work.

## Checks

```bash
npm run lint
node --test tests/*.test.mjs
npm run build
```

The API tests use mocked providers, including stalled headers/bodies and errors; they do not spend provider quota or prove live credentials. Verify production analytics ingestion separately. Vercel custom events require an eligible plan; installed tracking code alone does not verify collected conversions.

## Deployment

The repository is configured for a standard Vercel deployment with `npm run build`.
