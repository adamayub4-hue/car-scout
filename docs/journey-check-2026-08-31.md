# Customer journey check — 31 August 2026

## Direct production checks

- eBay car search, `Audi A3`: HTTP 200, 12 listings.
- eBay parts search, `Bosch oil filter`: HTTP 200, 12 listings.
- Direct part-number search, `06J115403Q`: HTTP 200, 12 listings. Results are not a compatibility guarantee.
- Invalid one-character search: HTTP 400 with a useful validation message.
- Registration supplied previously by owner, `KU21 OTC`: HTTP 200, make Mercedes-Benz, model A-Class, year 2021.
- Vercel analytics script: HTTP 200 JavaScript. This does not verify ingestion or visitor totals.

## Reliability fix

Searches and completed saves previously awaited optional account-activity telemetry. A stalled telemetry request could delay results, prevent a marketplace window opening within the user click, or leave a successful save looking unfinished. Search handlers now start telemetry without waiting; telemetry rejections are contained. A confirmed save now displays success independently of telemetry.

Ten regression tests exercise actual source handlers/components with stalled or rejected tracking, plus the existing 15 dashboard tests.

## Still unverified

- Vercel visitor totals, ingestion and production error logs.
- Full signed-in browser journey, including a fresh save and support submission reaching the dashboard.
- Mobile visual QA and a fresh sign-in/sign-out cycle.

Chrome page inspection and tab creation repeatedly timed out, despite extension/native-host diagnostics passing. No new live account, saved item or support report was created in this check. Browser reconnection is needed to finish the interactive checks.

## Further code-review follow-ups

- Account saved-list loading currently converts request errors to an empty list, and account export does not check individual query errors.
- Support submissions lack an in-flight duplicate-submit guard and rejected-request handling.
- Save authentication/write failures that reject rather than return an error still need explicit recovery.

These follow-ups are not fixed by the telemetry change and should not be described as tested or complete.
