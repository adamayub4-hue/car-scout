# API reliability and production readiness

Published on 16 September 2026. Production eBay search and listing images were checked in the browser. Local provider tests use mocks and make no billable requests; live DVLA/DVSA account and quota checks remain separate.

## Deadlines and fallbacks

| Request | Deadline | User-facing behaviour |
| --- | --- | --- |
| eBay token | 8 seconds | HTTP 504 with retry message on timeout |
| eBay search | 8 seconds | HTTP 504 with retry message on timeout; 502 on provider failure |
| DVLA vehicle enquiry | 8 seconds | HTTP 504; manual Make & model remains available |
| Optional DVSA token | 3 seconds | Successful DVLA data is returned without model enrichment |
| Optional DVSA lookup | 3 seconds | Successful DVLA data is returned without model enrichment |
| Wikimedia reference photo | 5 seconds | No photo; the search flow remains usable |

Deadlines include reading response bodies. A cold eBay search can use both token and search deadlines; a DVLA response may wait for the two optional DVSA stages. Concurrent token refreshes in one instance share a pending request. A provider 401 invalidates its cached token so the next request can refresh it. No repeated retries multiply provider calls within a failing request.

## Caching and personal data

- Successful public eBay search results have a 30-second, maximum 100-entry, per-instance memory cache. Least recently used entries are evicted when full; reads do not extend expiry. Empty successful results can be cached, errors cannot.
- Cache keys contain a hash of normalized query/type/maximum price rather than the query text. Searches resembling UK registrations or VINs bypass this cache. This conservative check is not an identity classifier and can also skip some part numbers.
- eBay responses retain `Cache-Control: no-store`: there is no browser/CDN cache of arbitrary search URLs. The memory cache is an optimization, not a global quota control. Listing availability can change during its short lifetime and must be checked on eBay.
- DVLA/DVSA requests and registration responses remain `no-store`; no vehicle-response cache, registration/VIN analytics, or registration logging was added.
- Model-family Commons photos keep their existing one-day provider/image cache. A successful no-match response has a five-minute public cache; failed requests are not cached. Photo query inputs are make/model, never registration/VIN.
- Check provider agreements before changing TTLs or storing additional fields. Public API data is still subject to provider terms.

## Abuse limits and remaining shared quota work

On 16 September 2026, the Vercel project firewall rule **Protect public vehicle and eBay searches** was published and confirmed active in the dashboard. It matches exactly `/api/vehicle` and `/api/ebay/search`, counts 30 requests per IP in a fixed 60-second window across those paths, and responds with HTTP 429 above the limit. Other page paths are unaffected. The existing Hobby entitlement was used; no subscription or paid add-on was purchased.

Vercel's rate-limit counters are regional, so this edge rule is not a globally atomic provider-account quota and does not prevent address rotation. The published configuration was verified; no production load test was performed. See [Vercel rate-limit behaviour](https://vercel.com/docs/vercel-firewall/vercel-waf/rate-limiting) and [plan limits and usage](https://vercel.com/docs/vercel-firewall/vercel-waf/usage-and-pricing). Search and registration clients handle HTTP 429 before attempting JSON parsing, including firewall responses that contain HTML, and show a one-minute retry message.

Registration lookups retain an eight-request/minute throttle with at most 2,000 address buckets. Expired buckets are removed; capacity evicts oldest entries. This is **best-effort, per running instance**. Cold starts, multiple regions/instances, untrusted forwarded headers outside the configured host and address rotation can bypass it. It is not a distributed quota guarantee.

Actual registration request bytes are capped at 1,024, even when `Content-Length` is absent. Query length, search type and numeric maximum price are validated before eBay requests. These controls do not replace upstream account limits.

The repository currently has Supabase account tables and browser anon-key access, but no server-only credential or atomic shared API quota function. No anonymous-write quota RPC or database migration was added. Before larger traffic or provider quota commitments:

1. Review the active edge rule's traffic and blocked-request counts against real visitor behaviour and the current plan's allowance. Do not silently purchase an add-on or raise paid usage limits.
2. If a database quota is chosen, use a server-only credential and a narrowly scoped atomic increment function. Deny direct `anon`/`authenticated` writes and function execution; never accept a caller-selected bucket identity. Use trusted address information hashed with a server secret, short expiry and cleanup. Set a documented failure policy before activation.
3. Verify across two application instances, not just two requests to one process. Confirm `Retry-After`, expiration and provider-account limits under concurrent requests.
4. Check provider logs/usage after deployment without recording full search queries or vehicle identifiers.

A globally atomic provider quota remains outstanding. The live firewall rule above is active; no database or provider-account setting changed in this work.

## Public uptime checks

The existing GitHub workflow requests a run every 15 minutes, at minutes 3, 18, 33 and 48 UTC, and can also be run manually. The offset avoids the start-of-hour load described in [GitHub's scheduling guidance](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule); it does not guarantee delivery. GitHub scheduling is best effort: a 21 October 2026 review of the latest 100 scheduled runs found successful checks separated by 99–567 minutes, with a median gap of 262 minutes. This is not demonstrated 15-minute monitoring coverage. It checks only `https://mekivo.uk/api/health` and the public homepage, without query parameters, credentials or browser JavaScript. It does not send searches, registration lookups, email requests or provider-token probes.

Both checks require HTTP 200 at the expected Mekivo path. The health body must be JSON with `status: "ok"` and `service: "mekivo"`; the homepage must contain the Mekivo title and its GET car-search form. Requests are HTTPS-only and follow zero redirects, so an unexpected response cannot turn a check into a search or provider request. Unexpected final domains, paths or query parameters fail validation too. Requests have a 10-second connection timeout, 15-second transfer timeout, at most two retries and a 40-second retry-start window, within the existing three-minute job limit. Response sizes are capped; bodies and unexpected destinations are not printed by the validators. The homepage check still runs if health fails, without masking that failure.

A successful run proves these public responses were served. It does not prove browser interactions, upstream credentials, eBay/DVLA/DVSA/Supabase availability or remaining service allowances. Review current provider dashboards separately. GitHub's owner notification preferences must be checked separately too: a failed Actions run is not evidence that an email or app alert was delivered. No additional alert service or scheduled automation was added.

## Automatic regression checks

The `Mekivo regression` GitHub Actions workflow runs for pushes and pull requests to `main`, and can be started manually. It uses a standard Ubuntu runner in the existing public repository, Node 24 LTS, `npm ci` against the committed lockfile, the existing `node --test tests/*.test.mjs` suite, lint and the production build. Node 24 meets both Next.js's Node 20.9 minimum and the installed Supabase client's Node 22 minimum. Each job has a 15-minute limit; newer changes cancel older runs for the same branch or pull request.

The workflow has read-only repository permission, commit-pinned GitHub actions, no persisted checkout credential, no dependency-cache upload, and no configured production secrets or provider requests. It reports failures through GitHub Actions while the Mac and assistant are off. Existing GitHub notification preferences determine delivery to the owner. It is not a Vercel deployment gate: Vercel's independent deployment integration and branch-protection settings were not changed. A green build does not prove live upstream access or remaining service allowances.

## Provider allowances and expiring access

The following published guidance was checked on 21 October 2026; account-specific limits, current usage and credential expiry still need separate authenticated evidence.

- [eBay Browse](https://developer.ebay.com/develop/api/buy/api_call_limits): the published default is 5,000 calls per day for methods other than `getItems`, which has its own 5,000-call bucket. One uncached Mekivo car or motorbike search can make up to four Browse calls; a parts search makes one. Website search totals therefore cannot be substituted for provider-call totals. The read-only [Developer Analytics rate-limit resource](https://developer.ebay.com/api-docs/developer/analytics/resources/rate_limit/methods/getRateLimits) reports the actual application's `limit`, `remaining`, `count`, `reset` and `timeWindow`. Use the existing application credentials and base OAuth scope; do not create another keyset or submit listings to inspect usage.
- [DVLA VES](https://developer-portal.driver-vehicle-licensing.api.gov.uk/apis/vehicle-enquiry-service/vehicle-enquiry-service-description.html): the assigned usage plan determines each client's request rate, and shared service throttling also applies. Do not invent a numeric allowance from Mekivo's own throttles or apply another DVLA API's limit to VES.
- [DVSA MOT](https://documentation.history.mot.api.gov.uk/mot-history-api/rate-limits/): published limits are 500,000 requests per day, an average of 15 requests per second and a burst of 10 (no burst window is stated). Exceeding the quota can block the key for 24 hours. [Authentication guidance](https://documentation.history.mot.api.gov.uk/mot-history-api/authentication/) describes two-year client secrets, reminder emails 30 and 14 days before expiry, and revocation of API keys unused for 90 days. A credential-email date alone does not prove the current secret's exact expiry or validity.

Do not schedule real searches, vehicle registrations or token probes as quota checks. Review provider usage and notices without retaining keys, tokens, registration numbers or customer queries in reports. Infrastructure spending alerts and a per-IP firewall limit do not impose a shared provider-account allowance.

## Supabase Free availability

Review the actual database, egress, authentication and Storage allowances in the existing project's usage dashboard; rounded usage values are not a count of website visitors. Supabase's [production checklist](https://supabase.com/docs/guides/deployment/going-into-prod#availability) says Free projects with low activity in a seven-day period may be paused. A healthy public Mekivo homepage does not prove that its account database is available. No provider keep-alive, fake customer activity or new scheduler was added.

The existing Free project's dashboard does not include managed project backups. See [backup and recovery](backup-recovery.md) for the verified source/fixture scope and the separate live-data backup prerequisite. Provider notices, actual usage and database availability remain separate from the public uptime workflow.

## Verification

`node --test tests/api-reliability.test.mjs` covers query filters/validation, cache separation/expiry/eviction, identifier-shaped cache bypass, uncached errors and token renewal, concurrent token refresh, provider header/body stalls, private vehicle responses, optional MOT fallback, oversized body rejection, local 429 handling and Commons timeout behaviour. Follow this with the full tests, lint and production build before deployment.
