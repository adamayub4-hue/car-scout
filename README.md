# Mekivo

Mekivo is a responsive UK car and parts discovery service. It provides a single starting point for searching Auto Trader, eBay Motors and Gumtree, plus a guided parts flow using manual vehicle selection.

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

The public registration route is hidden until DVLA access is approved. Vehicle-specific diagrams are also hidden until a licensed automotive-data provider is connected. The ready-to-use parts catalogue remains a general discovery aid and does not claim exact factory-option or torque-specification compatibility.

When DVLA access is approved, set `DVLA_API_KEY` in the deployment environment and re-enable the server-side registration route only after production testing.

## Deployment

The repository is configured for a standard Vercel deployment with `npm run build`.
