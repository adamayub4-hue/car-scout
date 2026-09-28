# Diagram search illustrations — 28 September 2026

## Delivered assets

- `public/parts-guide/vehicle-overview-v2.png`: generic combustion-vehicle cutaway.
- `public/parts-guide/vehicle-electric-overview-v2.png`: matching generic battery-electric cutaway.

Created with the built-in image-generation tool, then copied into this repository. No external catalogue artwork or provider access was used. Both are original illustrative references, not vehicle-specific fitment or repair diagrams. The existing ten component plates remain in use; their selection markers are calibrated to the actual plates rather than treating each quarter of the image as a clickable part.

Labels, numbering and leader lines are rendered by the interface, so numbering remains consistent when electric-vehicle categories are filtered. The interface retains the generic-reference wording, seller/part-number fitment checks, and electric-drive safety wording. No analytics or advertising settings are changed.

## Final prompts

### Generic combustion overview

Use case: infographic-diagram
Asset type: background illustration for an interactive car-parts location guide on Mekivo's website.
Primary request: a clear, polished generic passenger-car cutaway that makes the major systems easier for a non-mechanic to recognise. This is a naming/location reference, not an engineering or fitment diagram.
Composition: landscape 3:2 canvas. Strict near-side orthographic view of an unbranded modern five-door hatchback, front pointing RIGHT. Entire car within central 80% of canvas width and central 65% of height, with generous empty margins for HTML callouts. Ground baseline around 78% height. No objects cropped.
Subject: selectively transparent light silver-blue body shell, a plainly visible generic compact combustion engine at the RIGHT under the bonnet, small 12V battery beside engine, visible cabin with front and rear seats, visible wheel assemblies with brake discs and suspension springs, simple exhaust pipe running underneath to rear silencer at LEFT, a compact transmission near the engine/front axle. Keep the systems simple, separated and recognisable. Retain roofline, glazing, front headlight and rear tail light to orient the viewer.
Style: refined automotive technical illustration with realistic but simplified 3D forms, crisp contours, soft studio shading and restrained cyan accents. Silver body, graphite tyres and interior, muted metallic mechanical parts. White background, subtle ground shadow only. High contrast at phone size.
Constraints: no text, no labels, no numbers, no logos, no watermark, no arrows or leader lines. No exact brand/model identity. Avoid decorative circuits, exploded/floating parts, duplicate wheels, extra axles, impossible dense mechanism detail. Do not show a repair procedure.

### Electric variant

Use case: precise-object-edit
Asset type: electric-vehicle variant for the same interactive car-parts naming guide.
Input image: existing generic combustion-car overview. Preserve the exact camera angle, front pointing RIGHT, body silhouette, car position, wheels, transparent body presentation, cabin, lighting and background.
Primary request: convert the drivetrain and energy systems into a plausible generic battery-electric hatchback. Remove the combustion engine, fuel tank, all exhaust pipes and all silencers/catalysts. Replace with a simple compact electric motor and reduction gear at the RIGHT/front axle, power electronics above it, and a flat rectangular traction battery pack underneath the cabin between the axles. Keep a clearly separate small 12V battery under the bonnet at the RIGHT. Retain visible mechanical brakes and suspension. Use a few restrained orange cable runs between power electronics and the traction battery.
This is an illustrative location/naming guide, not an exact vehicle or assembly/repair schematic. Avoid excessively intricate details. No text, numbers, labels, arrows, logos or watermark. Match input composition; do not crop or enlarge car.

## Visual review

Both outputs were inspected: front points right; body/cabin, brake assemblies and suspension remain in the same composition. The electric variant removes the combustion engine and exhaust and depicts a floor battery and electric drive. The drawings deliberately remain generic: component shapes, layout and fitment vary between real vehicles. Phone-size hit areas are separated from the dense mechanical detail. See `vehicle-diagram-provider.md` for the requirements for future licensed, vehicle-specific diagrams.
