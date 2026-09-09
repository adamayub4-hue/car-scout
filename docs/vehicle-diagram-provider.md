# Vehicle parts guide and licensed diagram integration

Mekivo includes an original, generic visual parts guide that helps a user learn a likely name for a common component. It is deliberately described as a naming guide rather than a compatibility check. It does not use or reproduce third-party workshop or catalogue artwork.

Vehicle-specific exploded diagrams, provider identifiers, OE references and fitment results remain unavailable until a provider such as TecAlliance grants production access and confirms permitted display and caching terms. Mekivo must not scrape workshop diagrams or republish catalogue artwork without a licence.

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
