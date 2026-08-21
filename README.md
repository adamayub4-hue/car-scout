# CarScout

CarScout is a responsive UK car and parts discovery MVP. It provides a single starting point for searching Auto Trader, eBay Motors and Gumtree, plus a guided parts flow using a registration or manual vehicle selection.

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Current MVP

- Multi-marketplace car search
- Registration-first or manual parts journey
- Interactive vehicle-system and exploded-parts finder
- Parts catalogue and direct search
- Responsive mobile and desktop interface
- Clear marketplace hand-off and compatibility guidance

Registration lookup currently structures the search but does not call a DVLA or licensed fitment API. The exploded views are intentionally illustrative rather than OEM technical drawings. A licensed vehicle-data and fitment integration should be added before claiming exact vehicle, factory-option or torque-specification compatibility.

## Deployment

The repository is configured for a standard Vercel deployment with `npm run build`.
