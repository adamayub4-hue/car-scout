# Licensed vehicle-diagram integration

Mekivo must not scrape workshop diagrams or republish catalogue artwork without a licence. The current visual guide stays unavailable until a provider such as TecDoc, Autodata or an equivalent supplier grants production access and confirms permitted display and caching terms.

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
6. Set `NEXT_PUBLIC_VEHICLE_DIAGRAMS_ENABLED=true` only after the production checks pass.
