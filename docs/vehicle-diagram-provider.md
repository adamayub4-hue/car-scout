# Vehicle parts guide and licensed diagram integration

Mekivo includes an original, generic visual parts guide that helps a user learn a likely name for a common component. It is deliberately described as a naming guide rather than a compatibility check. It does not use or reproduce third-party workshop or catalogue artwork.

Vehicle-specific exploded diagrams, provider identifiers, OE references and fitment results remain unavailable until a provider such as TecAlliance grants production access and confirms permitted display and caching terms. Mekivo must not scrape workshop diagrams or republish catalogue artwork without a licence.

## Current readiness — 16 September 2026

The generic guide works now; it does not depend on `NEXT_PUBLIC_VEHICLE_DIAGRAMS_ENABLED`. That old README flag was obsolete. Model-family Commons photographs are visual references, not OEM component catalogues. New original illustrations can improve the naming guide, but cannot establish vehicle-specific fitment.

No provider endpoint, usable production credential, written display licence or verified vehicle-identifier mapping is present in the repository. There is no fake provider route or placeholder response presented as a real integration. The contract below is the implementation boundary once access exists. Keeping it as a contract avoids committing to an invented provider schema.

## Provider adapter contract

The provider adapter should accept the selected vehicle and system:

- registration-derived make, model and year;
- engine capacity and fuel type when available;
- provider vehicle identifier or VIN only when the provider requires it;
- system such as engine, brakes, suspension, body, electrical or interior.

It should return:

- provider vehicle identifier;
- diagram identifier, title and licensed image URL;
- numbered hotspot coordinates;
- component name, provider part identifier and OEM references for each hotspot;
- attribution and licence metadata;
- an expiry time that follows the provider's caching rules.

Responses must distinguish `matched`, `ambiguous`, `unsupported_vehicle` and `temporarily_unavailable`. A matched result must include a provider vehicle ID and its applicability attributes (for example engine/variant/year); an ambiguous result must offer the provider's actual variants for confirmation. Never convert unsupported, ambiguous or timed-out lookups into a claim that the generic diagram matches the selected vehicle. Reject missing attribution/licence metadata rather than display unlicensed artwork.

## Evidence needed from the provider

- Production endpoint documentation, authentication method, account quota and permitted territories.
- Written rights for web display, derived thumbnails/hotspots, required attribution, caching duration, deletion and any restrictions on affiliate destinations.
- Sample responses for a matched vehicle, multiple variants, unsupported vehicle, expired credentials and quota exhaustion.
- A defined vehicle lookup mapping and at least ten permitted test vehicles covering different years, engines and fuel types.

These are external dependencies, not tasks that an API key from an unrelated marketplace can satisfy. Provider access does not automatically license social-ad reuse of its diagrams. No provider enquiry was sent during this implementation.

## Safety requirements

- Never treat a visual match as guaranteed compatibility.
- Keep the registration and VIN out of analytics metadata and public URLs.
- Do not cache provider responses longer than the licence permits.
- Require the user to confirm engine, trim or VIN when the provider reports more than one vehicle variant.
- Send the selected OEM reference into the existing eBay parts query, while retaining the seller-fitment warning.

## Activation checklist

1. Obtain written production and display rights from the provider.
2. Store provider credentials as server-only Vercel secrets.
3. Implement a server route that maps the provider response to the adapter contract above.
4. Test at least ten registrations across different makes, years and engine variants.
5. Verify mobile hotspot accessibility and image attribution.
6. Keep licensed vehicle-specific results visually distinct from the generic naming guide.
7. Enable the provider-backed route only after the production checks pass.
