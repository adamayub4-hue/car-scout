# Mekivo campaign and funnel events

## Owner dashboard versus website traffic

The owner dashboard's account cards read retained Supabase records. Registered accounts counts profiles; unresolved reports includes open and in-progress complaints; saved items counts currently retained saves; recorded account actions shows the number of retrieved events, capped at the latest 100. These cards have no date filter and refresh on page load or the Refresh dashboard button. Recorded actions are not unique visitors, and unsigned-in visitors are not included.

The separate Website traffic panel links to the private Vercel report for automatic visitor/pageview counts and custom funnel events. It does not copy a snapshot into a live-looking counter or grant additional access. Compare matching periods and remember that owner/testing traffic can appear in the website analytics.

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

The SDK can initialize after the landing effect. Up to 20 sanitized events wait for at most two seconds for its queue to become available; undelivered events are then discarded. Searches and outbound clicks never wait for analytics. A successful wrapper call is not proof of ingestion; blockers, plan eligibility, network failures, and the service can still prevent collection.

## Vercel plan and verification

On 16 September 2026, Web Analytics was enabled using the included Hobby option. A controlled homepage visit then appeared as **1 visitor / 1 pageview** in the project dashboard. This confirms basic pageview collection; it is a test visit, not evidence of an advertising conversion. The same dashboard explicitly requires Pro to access custom events. No paid plan or Analytics Plus add-on was purchased.

As checked on 16 September 2026, Hobby includes pageviews but does not include custom events. Ordinary Pro supports custom events with two properties. Native UTM filtering requires Web Analytics Plus or Enterprise; the composite `campaign` above is a custom event property, not the native UTM dashboard. [Vercel plan limits](https://vercel.com/docs/analytics/limits-and-pricing), [custom event documentation](https://vercel.com/docs/analytics/custom-events).

This code does not upgrade a plan or enable billing. After any approved plan change and deployment, open a known campaign URL, submit a search, and open a result. Verify those event names and the two properties in the project's Web Analytics dashboard. Confirm dashboard ingestion before using the counts to judge advertising performance. Standard pageview collection remains handled by the existing Next.js Analytics component.
