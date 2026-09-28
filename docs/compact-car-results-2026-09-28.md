# Compact car results — 28 September 2026

Car searches previously stacked up to three price recommendations, nine large marketplace handoff cards and six general eBay listings. The same car could appear in both listing groups, and the other sites separated visitors from the live eBay results.

## Result

- One result area with a submitted-search summary, Edit search and three accessible views: Live cars, Price picks and Other sites. Only the selected view is visible; its controls stay at the top while browsing results.
- Live cars shows three listings at a time, using compact photo/text rows on phones and three columns on larger screens. Previous/Next can reach all twelve returned eBay listings, without new API calls or extra search/outbound analytics events.
- Price picks preserves the existing asking-price and matching safeguards. It is a comparison of returned eBay listings, not a promise of the cheapest car anywhere.
- Other sites uses compact cards and expandable filter notes. Existing individual-marketplace selection and immediate external opening remain available.
- A fresh car search resets the active view and pager. Switching views preserves the current page. Edit search focuses Make; submission focuses the results; tab arrows/Home/End and pagination support keyboard use.
- Car photo size hints now match the smaller phone thumbnails. Parts searches retain their existing six-card preview.
- The new ad content labels `live_cars_v2` and `car_sites_v2` are allowlisted. Owner/local exclusions and all event eligibility rules are unchanged.

## Integration status

The 28 September mailbox audit found no approved additional listing feed. Auto Trader previously declined; AA Cars declined on 22 September. Gumtree was already followed up on 25 September. MOTORS/Cazoo, CarGurus, PistonHeads and Car & Classic have no approved feed recorded. Their cards remain clearly labelled outbound searches. Updated correspondence evidence is in the workspace integration matrix; no new outreach was sent for this change.

## Verification

- New interaction regression coverage exercises tab selection and keyboard focus, submitted criteria, all platform filters, paging/bounds/new responses, loading/error states, affiliate links and analytics exclusions.
- Local browser QA at 320px, 430px and 1280px covers layout, overflow, focus, view switching, paging and search reset.
- QA and advert captures use an unmodified public eBay response for Ford Fiesta up to £5,000, captured at 22:17 UTC on 28 September. The sample is served only by a workspace-local proxy; neither the sample nor proxy is shipped in the app. No production browser searches or analytics events were used.
- Final checks passed: `npm run lint`, all 245 tests from `node --test tests/*.test.mjs`, and `npm run build`.

Two new vertical adverts and their captions/audio provenance live in the workspace directory `outputs/mekivo-ads-september/compact-search-2026-09-28`. They distinguish live eBay cards from other-site searches and use dated examples rather than guaranteed offers.
