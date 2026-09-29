# Saved cars and parts

Customers can bookmark individual eBay listings from live results and price picks. Search-level saves remain separate. The homepage links directly to My saved items. No browsing history is silently saved.

## Storage and ownership

Apply `supabase/migrations/202609290200_saved_listings.sql` before deploying the UI. It adds `car_listing` and `part_listing` kinds and a partial unique index on user, kind and canonical listing/variation identity. Existing records are preserved. Existing insert/read/delete RLS remains enabled; the customer account explicitly filters by current user even when that user is the owner. No service-role key or expanded permissions are introduced.

Saved rows contain only the canonical eBay bookmark, identity, safe local search URL and a label derived from the customer's search. They do not retain a permanent copy of marketplace photos/prices. Duplicate inserts in concurrent tabs re-read the winning row. Success requires a confirmed record; failures stay retryable.

Before sign-in, Save stages one chosen listing in browser storage with a random token. Account and confirmation URLs carry only that token. The customer explicitly confirms the pending save after authentication. Browser snapshots lose marketplace details after six hours and the pending intent expires after 24 hours. Blocked storage produces an error instead of pretending the choice was retained. Signing in on another device cannot recover this browser's unsaved item.

## Current listing details

`GET /api/ebay/saved-listing?id=…` validates the caller with Supabase and checks ownership of that listing for every request, including cache hits. It uses the caller's JWT and public key under RLS. Provider URLs cannot be supplied by callers. Authenticated users can refresh only their own saved identities. A bounded five-minute instance cache and shared in-flight lookup reduce repeated provider calls; an instance-local 60-request/minute per-user brake is not a distributed quota guarantee.

The account displays fresh eBay details with a check time, separate postage and a link to the original seller. An ended listing or failed refresh keeps the bookmark and offers a similar search; errors never masquerade as an empty list or a confirmed sale. Displayed details expire within six hours and refresh on visibility after expiry. The new endpoint shares the existing application-token handling with search.

This freshness rule follows [eBay's API licence, section 8.1(c)](https://www.developer.ebay.com/join/api-license-agreement), which limits displayed listing data age to six hours. [Browse API](https://developer.ebay.com/api-docs/buy/api-browse.html) supplies current listing details. No new eBay permission, paid service or customer outreach is involved.

## Measurement

Save actions do not emit extra analytics. Outbound clicks from saved items use the existing exclusion-aware marketplace event policy. Account reads and detail refreshes do not count as searches or listing clicks. Signed-in owners and browsers excluded on `/traffic-settings` remain excluded.

## Release verification

Automated checks cover safe links, ownership boundaries, duplicate saves, interrupted sign-in, storage expiry, account-switch races, loading/error states, provider responses and cache freshness. Live verification must confirm browser analytics exclusion and must not click an affiliate link to manufacture a conversion.

On 29 September 2026, the migration was applied to Mekivo's existing Supabase project. A follow-up catalogue query confirmed both listing kinds, the unique identity index, and row-level security all enabled. No existing saved searches were removed. The first full suite passed 305 tests; four additional account-switch cases passed after final review. Full lint passed without warnings before that final button change, which also received targeted lint and behavior checks.
