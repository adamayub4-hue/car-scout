# Mekivo campaign and funnel events

## Owner dashboard versus website traffic

The owner dashboard's account cards read retained Supabase records. Registered accounts counts profiles; unresolved reports includes open and in-progress complaints; saved items counts currently retained saves; recorded account actions shows the number of retrieved events, capped at the latest 100. These cards have no date filter and refresh on page load or the Refresh dashboard button. Recorded actions are not unique visitors, and unsigned-in visitors are not included.

The separate Website traffic panel inside `/admin` reads Vercel Web Analytics through the owner-only `/api/admin/traffic` endpoint. It displays visitors, page views, searches, listing clicks and referrer sources for the last 24 hours, 7 days or 30 days, or an inclusive custom period of up to 31 UK calendar days. It includes eligible anonymous visitors; account records remain separate. Compare matching periods. Historical figures include owner/testing traffic collected before the exclusion below; do not subtract a guessed number or present those totals as purely customer results.

### Private reporting connection

Set `MEKIVO_ANALYTICS_VERCEL_TOKEN` as a server-only Production Secret in the existing Vercel project. Never put the token in a `NEXT_PUBLIC_` variable, browser storage, URL, source code or log. `MEKIVO_ANALYTICS_PROJECT_ID` and `MEKIVO_ANALYTICS_TEAM_SLUG` default to `car-scout` and `adamayub4-hues-projects`; override only for an intentional project move. Token access must be approved before creating a new credential. Set an expiry and renew it before expiration; an expired/revoked key makes the panel unavailable and does not affect search or ongoing eligible traffic collection.

Every reporting request verifies the Supabase session and matching `admins` row before accessing cached data or Vercel. No service-role key is required. All responses are private/no-store; only normalized report data is briefly cached on the server. The API accepts the fixed rolling periods or strictly validated `YYYY-MM-DD` custom dates, not arbitrary provider queries. Both custom dates are included; their boundaries use Europe/London, including 23/25-hour DST days, and today ends at the report time. Dates in the future, impossible dates, reversed ranges, duplicate parameters and ranges longer than 31 calendar days are rejected before a provider query. Failed or unconfigured reports show unavailable, never a made-up zero. Optional failed sections remain unavailable while confirmed visitor/page-view totals can still display.

Period totals use one production-environment aggregate, not the sum of daily/source visitor counts. Sources are grouped by referrer hostname and bounded, with the provider’s remaining sources represented as Others. Missing referrers are Direct / unknown, including traffic from apps that hide their referrer; these are not proof of organic traffic. Custom events count `search_submitted` and `marketplace_outbound` actions, not unique people or completed sales. The panel shows its reporting interval and fetch time, and explains the five-minute cache and provider delay. It uses the existing collection and exclusion policy without adding a second tracker.

### Outbound destination breakdown — 29 September 2026

One additional bounded custom-event query groups `marketplace_outbound` by `eventData/context`, using exactly the same timestamps and production filter as the total. The production response was verified on 29 September to use the literal column `eventData/context`. Vercel’s documented example instead uses `eventData`. The parser accepts either verified/documented format and rejects conflicting values when both columns occur; nested objects or unrelated aliases are not guessed. Only a stable failure category and HTTP status may be logged for diagnostics, never provider rows, schema keys, values, counts or credentials. Only the count is used. The query requests up to 100 groups and permits one provider `Others` row.

Complete known context labels are classified as **eBay cars**, **eBay parts**, or **Other marketplaces**. Missing/null, older, unknown and provider `Others` labels remain **Unclassified**. These include individual-listing and search-result-page clicks, and repeated actions count. They are website outbound actions, not EPN-credited referrals, transactions or earnings. No new collection, personal identifiers, or analytics SDK is introduced.

The four groups must sum exactly to the separately confirmed outbound total before the breakdown is shown. A timeout, malformed/duplicate row, unsafe count, or unequal sum leaves the breakdown unavailable with a retry prompt; it never displays invented zeros. A valid empty response with a confirmed zero total is a genuine zero breakdown. A failed optional section is not cached. Owner authentication and membership checks still run on every request, including cache hits.

Before reconciling EPN, select matching dates **and confirm EPN’s report timezone**. The custom selector is explicitly Europe/London. Historic QA, ingestion delays, blockers, repeat-click handling and provider attribution rules can still produce different counts.

Verified operational observation (Vercel dashboard, 29 September): the UI selection 14 September 00:00–27 September 23:59 UK time displayed 284 visitors, 329 page views and 115 outbound actions. Its ten context groups summed to 22 eBay car actions, 0 eBay part actions, 93 other-marketplace actions and 0 unclassified. This is a read of that dashboard window, not a generated test. Its end timestamp was minute-precision; the new custom selector includes the remainder of the final minute. Earlier EPN reporting showed 24 credited clicks for the same calendar labels; EPN timezone was not verified, so these are not an exact loss or conversion calculation. The period also includes pre-exclusion QA. Automated tests use separate synthetic fixtures.

API reference: [Web Analytics API](https://vercel.com/docs/analytics/web-analytics-api), [page-view aggregates](https://vercel.com/docs/rest-api/web-analytics/aggregates-page-views), [custom-event aggregates](https://vercel.com/docs/rest-api/web-analytics/aggregates-custom-events).

### Named marketplaces and private dashboard — 30 September 2026

The owner view now replaces the combined “Other marketplaces” display with a named table for eBay, Auto Trader, Facebook Marketplace, MOTORS, Gumtree, CarGurus, PistonHeads, AA Cars and Car & Classic. `marketplaceClicks` uses the existing context aggregate, with separate car, part and total click counts. Repeated actions and all supported listing/search-result destinations are combined per marketplace. No additional analytics query or tracker is introduced. The original `clicksByDestination` summary remains in the API for compatibility.

Named rows appear busiest first; verified zero-click marketplaces are in an expandable section. Missing/legacy/unknown contexts and the provider's `Others` group are “Unidentified destination”; their car/part split is unknown, shown as a dash. Both breakdowns are unavailable on provider/parse failure, count overflow or a mismatch with the confirmed outbound total. An older response missing the new field also shows unavailable, never invented zeroes.

Common referrer hostnames have clearer display labels while preserving the original hostname. Different hostnames are not combined: summing their visitor counts could double-count people. The reporting dates, five-minute cache, historical testing caveat and distinction between clicks, people and credited eBay sales remain visible.

The account dashboard subscribes to authentication changes and clears private rows, counts and pending results after sign-out or an account change. Late loads and report-status responses cannot restore a previous owner's records; a same-account token refresh does not clear valid data. Server-side owner checks and database row permissions remain required. Normal visitors cannot retrieve the traffic report by opening its API URL.

Validation: lint, all 348 Node tests and the production build passed. Local browser review uses fictional sample figures, including named and unidentified destinations and expandable zero-click rows. Production review must retain browser analytics exclusion and must not generate test search/outbound events.

## Owner and testing exclusion — 17 September 2026

`analytics-audience.ts` is shared by both Vercel SDKs, the growth-event wrapper and optional Supabase search/save activity. Collection starts only after the browser session check confirms an anonymous visitor or a signed-in non-owner. A signed-in owner's `admins` membership sets a persistent boolean `mekivo_internal_traffic=1` in local storage, without retaining an ID or email in that preference. Exclusion remains after sign-out. Identity/role errors or timeouts suppress analytics without preventing the website from working.

Before signed-out testing on any browser/device, open [visitor report settings](https://mekivo.uk/traffic-settings?analytics=off) and confirm the exclusion is saved. The query takes effect on the first load; the settings page itself is never tracked. The explicit button works without a query. Other tabs read the preference at send time and receive storage-change notifications. If storage is blocked, exclusion lasts in memory only; the UI explains that the `analytics=off` query must be retained for each full page load. Clearing site data, changing browser/profile/device or using a new private window requires setup again. An unmarked, signed-out owner cannot be distinguished reliably from a visitor.

Only production `mekivo.uk` and `www.mekivo.uk` traffic is eligible. Local development, deployment preview URLs, Vercel preview environment builds, account/auth routes, `/admin` and `/traffic-settings` are excluded. SDK mounting waits for audience resolution; stable `beforeSend` filters on both Web Analytics and Speed Insights recheck the current audience and the event URL, so already-loaded scripts cannot bypass a later exclusion. SDKs stay mounted after first inclusion to avoid duplicate pageviews on token refresh. Pending growth events are bounded and discarded when excluded; they are never replayed as later customer activity.

Existing account records, saved items and support messages are preserved and still work. Exclusion does not delete history, alter Meta/TikTok platform totals or remove server/security logs and hosting usage. Run automated analytics checks locally; never create new production test visits just to see the reporting number increase. Use the first full reporting day after deployment for a cleaner comparison, while allowing for blockers and normal analytics measurement limits.

Implementation uses the documented [Web Analytics beforeSend filter](https://vercel.com/docs/analytics/package) and [Speed Insights beforeSend filter](https://vercel.com/docs/speed-insights/package).

## Funnel events

The growth-event wrapper sends exactly two custom properties so it fits ordinary Vercel Pro:

- `campaign`: `source|medium|campaign|creative`, for example `meta|paid_social|september_demo|budget_car`. A visit with no campaign in the current tab is `direct`.
- `context`: the relevant journey, method, destination, or failure reason from a fixed set of labels.

Existing event names are unchanged:

| Event | Example context |
| --- | --- |
| `campaign_landing` | `cars` or `parts` |
| `vehicle_lookup_success` | `parts:model_found` or `parts:model_missing` |
| `search_submitted` | `cars:all`, `parts:diagram`, `parts:part_number` |
| `results_shown` / `results_empty` | `cars:vehicle`, `parts:catalogue`, `cars:marketplace_links` |
| `results_error` | `parts:search:timeout`, `cars:vehicle:unavailable` |
| `marketplace_outbound` | `parts:ebay:listing`, `cars:autotrader:search_results` |

The event name distinguishes each funnel step. Exact result counts and individual input-presence flags are deliberately omitted to stay within two properties. This allows comparison of campaign-level event totals; it does not identify a visitor or prove that the same visitor completed every step.

## Campaign labels and privacy

`campaignLabels` in `app/lib/growth-events.ts` is the explicit list of accepted marketing labels. Current sources are `meta`, `facebook`, `instagram`, and `tiktok`; media are `paid_social` and `organic_social`; campaigns are `september_demo` and `september_validation`. Current creatives are `budget_car`, `part_number`, `visual_guide`, `wrong_part_v1`, `car_search_v1`, and `part_number_v1`.

Add new non-personal campaign/creative labels to that list before publishing their links. Labels are normalized to lowercase and limited to 48 characters. Missing, unfamiliar, invalid, or overlong segments become `unknown`; arbitrary URL text is neither retained nor sent as a custom property. Event context uses fixed enums and never includes a registration, postcode, account/listing identifier, part number, or free-text search.

Any new UTM parameter replaces the complete tuple. Missing fields never inherit values from a previous campaign. The tuple is stored as one value in session storage for the current tab and validated on reload. Legacy per-field keys are ignored. If storage is blocked, attribution remains available in memory for the current page. Navigating to a new campaign starts a new tuple.

Instagram's observed profile-link tags have one narrow exception: exactly one `utm_source=ig`, `utm_medium=social` and `utm_content=link_in_bio`, with no `utm_campaign`, become `instagram|organic_social|profile|profile_link`. This measures the shared profile route, not a particular reel or a paid advert. Duplicate tags, altered values and an explicitly present campaign do not use this mapping. Only that complete canonical tuple is retained on clean navigation/reload; the general campaign-label allowlist is unchanged. Other query parameters, including `fbclid`, are never copied into growth-event properties or campaign session storage. Owner/testing exclusion is unchanged.

The SDK can initialize after the landing effect. Up to 20 sanitized events can wait at most 11 seconds for the bounded identity/role checks, then at most two seconds for the SDK queue; undelivered events are discarded. Exclusion drops them immediately on the next check. Searches and outbound clicks never wait for analytics. A successful wrapper call is not proof of ingestion; blockers, plan eligibility, network failures, and the service can still prevent collection.

## Vercel plan and verification

On 16 September 2026, Web Analytics was initially enabled using the included Hobby option. A controlled homepage visit then appeared as **1 visitor / 1 pageview** in the project dashboard. This confirms basic pageview collection; it is a test visit, not evidence of an advertising conversion. The same dashboard required Pro to access custom events at that point. By 17 September, the owner-approved Pro plan was active and custom-event reports were readable. This embedded report uses that existing setup; it does not add an Analytics Plus purchase.

As checked on 16 September 2026, Hobby includes pageviews but does not include custom events. Ordinary Pro supports custom events with two properties. Native UTM filtering requires Web Analytics Plus or Enterprise; the composite `campaign` above is a custom event property, not the native UTM dashboard. [Vercel plan limits](https://vercel.com/docs/analytics/limits-and-pricing), [custom event documentation](https://vercel.com/docs/analytics/custom-events).

This code does not upgrade a plan or enable billing. Earlier production ingestion was verified on 16 September; those visits are historical QA, not ad conversions. Future payload and policy checks run locally, and production browser checks use the exclusion above. Standard pageview collection uses the Next.js Analytics component behind the shared audience gate.
