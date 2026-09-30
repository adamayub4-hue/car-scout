# Google search appearance correction — 28 September 2026

## Confirmed issue

The supplied Google screenshot showed the stock Vercel triangle beside the Mekivo result. `app/favicon.ico` still contained that stock asset, despite `app/icon.svg` already containing the proper Mekivo mark. Being indexed and ranking for the brand did not mean the search-result branding had been fixed.

## Changes

- Replace `/favicon.ico` with Mekivo's existing SVG mark at 16, 32, 48, 64, 128 and 256px. Keep its established URL.
- Explicitly advertise a stable 192px PNG favicon; provide a 180px Apple touch icon and 192/512px manifest icons of the same mark. The files are generated deterministically by `node scripts/generate-brand-icons.mjs` from `app/icon.svg`; there is no new logo design.
- Use `Mekivo | Search UK Used Cars & Car Parts` as the homepage title, with a description that explains marketplace search and part-number/picture discovery.
- Maintain one `WebSite` identity node, prefer the name Mekivo with the domain as an alternate, and connect it to an `Organization` node with the official logo.
- Link only the previously verified Instagram `mekivo.uk` and TikTok `mekivo0` profiles. Do not attribute the separate same-name YouTube/Facebook results to this business without ownership evidence.
- Preserve the existing canonical URLs, indexability, analytics exclusions and application functionality.

## Google evidence and limits

Search Console accepted the exact `https://mekivo.uk/` property using existing domain-provider verification; no DNS records or credentials were changed. Its existing sitemap record showed success, submitted 25 August and last read 26 September, with eight discovered pages. URL Inspection reported the homepage indexed, successfully fetched by Googlebot smartphone on 25 September at 23:54:32 (time as displayed by Google), with crawling/indexing allowed and the Google-selected canonical matching the homepage.

The published site and the cached Google result are separate states. Google chooses site names, snippets and favicons; the new appearance is not guaranteed or immediate. A successful crawl request is not proof that a search result has already changed. Changes on Mekivo cannot remove other websites' independent search results.

## Validation

- Regression tests compare all favicon frame pixels and app icons with the existing branded SVG, check the manifest, validate one linked website/organization graph, and restrict social identity to recorded owned profiles.
- Verify production build output actually links both the stable 192px PNG and Apple icon, rather than relying on source metadata alone.
- Run lint, the full Node test suite and a production build before deployment.
- Check deployed static icon bytes and metadata without loading production analytics; then request homepage indexing once in Search Console.

## Official references

- [Google favicon requirements and recrawl timing](https://developers.google.com/search/docs/appearance/favicon-in-search)
- [Google site-name guidance](https://developers.google.com/search/docs/appearance/site-names)
- [Organization identity and logo guidance](https://developers.google.com/search/docs/appearance/structured-data/organization)
- [Requesting a fresh crawl](https://developers.google.com/search/docs/crawling-indexing/ask-google-to-recrawl)

## Follow-up verification — 30 September 2026

The user's new Google screenshot shows the updated title and description, but still shows the previous triangle favicon and the domain as the site name. The separate miniature-model YouTube/Facebook results are independent websites, not profiles linked by Mekivo's structured data.

Direct HTTP checks found the production homepage and icon files returning HTTP 200. `/favicon.ico`, `/icons/mekivo-192.png` and `/icon.svg` exactly match the branded repository assets. The homepage advertises the stable PNG and declares `Mekivo` in its single linked WebSite/Organization graph. Robots rules allow crawling these files. These checks did not run browser analytics.

Search Console's URL Inspection reports the homepage indexed, fetched successfully by Googlebot smartphone on **28 September 2026 at 19:55:51** (time shown by the interface), with crawling and indexing allowed and the inspected URL selected as canonical. Its **View crawled page** panel already includes the updated title, `og:site_name` set to `Mekivo`, the branded favicon hash and `/icons/mekivo-192.png`. Therefore a successful crawl has occurred, but the search-result icon/site name have not visibly converged with the supplied branding. Do not describe the Google appearance as fully corrected, replace the icon again, or promise an immediate result.

The remaining website identity correction is TikTok's current owned handle: `https://www.tiktok.com/@mekivo.uk`, replacing `@mekivo0` in `sameAs`. The authenticated publishing records from 28 and 29 September identify this account and record Mekivo's published/scheduled video URLs under it. The existing verified-profile regression expectation is updated accordingly. This does not grant control over Google's favicon choice or other sites' search results.

Validation for that correction: lint passed, all 334 Node tests passed, and the production build passed. Built homepage HTML includes the current TikTok URL, the `Mekivo` site name and the existing stable PNG favicon.
