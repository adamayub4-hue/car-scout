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

Registration lookup uses the DVLA Vehicle Enquiry Service when a key is configured, but that service does not provide licensed parts fitment data. The exploded views are intentionally illustrative rather than OEM technical drawings. A licensed fitment integration should be added before claiming exact factory-option or torque-specification compatibility.

Set `DVLA_API_KEY` in the deployment environment to enable server-side registration lookup. Without it, the interface directs users to the manual make-and-model route and never sends a registration to a marketplace URL.

## Deployment

The repository is configured for a standard Vercel deployment with `npm run build`.
