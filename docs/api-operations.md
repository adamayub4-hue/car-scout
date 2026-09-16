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

## Verification

`node --test tests/api-reliability.test.mjs` covers query filters/validation, cache separation/expiry/eviction, identifier-shaped cache bypass, uncached errors and token renewal, concurrent token refresh, provider header/body stalls, private vehicle responses, optional MOT fallback, oversized body rejection, local 429 handling and Commons timeout behaviour. Follow this with the full tests, lint and production build before deployment.
