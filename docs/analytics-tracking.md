# Mekivo campaign and funnel events

## Owner dashboard versus website traffic

The owner dashboard's account cards read retained Supabase records. Registered accounts counts profiles; unresolved reports includes open and in-progress complaints; saved items counts currently retained saves; recorded account actions shows the number of retrieved events, capped at the latest 100. These cards have no date filter and refresh on page load or the Refresh dashboard button. Recorded actions are not unique visitors, and unsigned-in visitors are not included.

The separate Website traffic panel inside `/admin` reads Vercel Web Analytics through the owner-only `/api/admin/traffic` endpoint. It displays visitors, page views, searches, listing clicks and referrer sources for the last 24 hours, 7 days or 30 days. It includes eligible anonymous visitors; account records remain separate. Compare matching periods. Historical figures include owner/testing traffic collected before the exclusion below; do not subtract a guessed number or present those totals as purely customer results.

### Private reporting connection

Set `MEKIVO_ANALYTICS_VERCEL_TOKEN` as a server-only Production Secret in the existing Vercel project. Never put the token in a `NEXT_PUBLIC_` variable, browser storage, URL, source code or log. `MEKIVO_ANALYTICS_PROJECT_ID` and `MEKIVO_ANALYTICS_TEAM_SLUG` default to `car-scout` and `adamayub4-hues-projects`; override only for an intentional project move. Token access must be approved before creating a new credential. Set an expiry and renew it before expiration; an expired/revoked key makes the panel unavailable and does not affect search or ongoing eligible traffic collection.

Every reporting request verifies the Supabase session and matching `admins` row before accessing cached data or Vercel. No service-role key is required. All responses are private/no-store; only normalized report data is briefly cached on the server. The API accepts a fixed date-range enum, not arbitrary provider queries. Failed or unconfigured reports show unavailable, never a made-up zero. Optional failed sections remain unavailable while confirmed visitor/page-view totals can still display.

Period totals use one production-environment aggregate, not the sum of daily/source visitor counts. Sources are grouped by referrer hostname and bounded, with the provider’s remaining sources represented as Others. Missing referrers are Direct / unknown, including traffic from apps that hide their referrer; these are not proof of organic traffic. Custom events count `search_submitted` and `marketplace_outbound` actions, not unique people or completed sales. The panel shows its reporting interval and fetch time, and explains the five-minute cache and provider delay. It uses the existing collection and exclusion policy without adding a second tracker.

API reference: [Web Analytics API](https://vercel.com/docs/analytics/web-analytics-api), [page-view aggregates](https://vercel.com/docs/rest-api/web-analytics/aggregates-page-views), [custom-event aggregates](https://vercel.com/docs/rest-api/web-analytics/aggregates-custom-events).

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
