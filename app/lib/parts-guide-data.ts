type DiagramSystem = {
  name: string;
  shortName: string;
  description: string;
  parts: readonly string[];
  hotspot: readonly [number, number];
};

export const categories = {
  Engine: ["Oil Filter", "Air Filter", "Spark Plugs", "Timing Belt", "Water Pump"],
  Brakes: ["Brake Pads", "Brake Discs", "Brake Calipers", "Brake Lines", "ABS Sensors"],
  Suspension: ["Shock Absorbers", "Coil Springs", "Drop Links", "Control Arms", "Bushes"],
  Body: ["Front Bumper", "Rear Bumper", "Wing Mirror", "Headlight", "Tail Light"],
  Interior: ["Steering Wheel", "Dashboard", "Seat", "Gear Knob", "Floor Mat"],
  Electrical: ["Battery", "Alternator", "Starter Motor", "Fuse Box", "ECU"],
  Exhaust: ["Exhaust Back Box", "Catalytic Converter", "DPF", "Oxygen Sensor", "Exhaust Pipe"],
  Drivetrain: ["Clutch Kit", "Gearbox", "Driveshaft", "CV Joint", "Differential"],
} as const;

export const diagramSystems: Record<string, DiagramSystem> = {
  Engine: {
    name: "Engine & cooling",
    shortName: "Engine",
    description: "Filters, belts, cooling and service components",
    parts: ["Air Filter", "Oil Filter", "Timing Belt", "Water Pump"],
    hotspot: [446, 166],
  },
  Brakes: {
    name: "Braking system",
    shortName: "Brakes",
    description: "Pads, discs, calipers and sensors",
    parts: ["Brake Disc", "Brake Pads", "Brake Caliper", "ABS Sensor"],
    hotspot: [444, 232],
  },
  Suspension: {
    name: "Suspension & steering",
    shortName: "Suspension",
    description: "Dampers, springs, arms and steering parts",
    parts: ["Shock Absorber", "Coil Spring", "Control Arm", "Drop Link"],
    hotspot: [153, 232],
  },
  Body: {
    name: "Body & lighting",
    shortName: "Body",
    description: "Panels, lamps, mirrors and exterior trim",
    parts: ["Front Bumper", "Headlight", "Wing Mirror", "Tail Light"],
    hotspot: [530, 205],
  },
  Electrical: {
    name: "Electrical system",
    shortName: "Electrical",
    description: "Battery, charging, starting and control units",
    parts: ["Battery", "Alternator", "Starter Motor", "Fuse Box"],
    hotspot: [383, 156],
  },
  Interior: {
    name: "Interior & controls",
    shortName: "Interior",
    description: "Seats, dashboard, controls and cabin trim",
    parts: ["Steering Wheel", "Dashboard", "Front Seat", "Gear Knob"],
    hotspot: [278, 139],
  },
  Exhaust: {
    name: "Exhaust & emissions",
    shortName: "Exhaust",
    description: "Pipes, silencers, filters and exhaust sensors",
    parts: ["Exhaust Back Box", "Catalytic Converter", "DPF", "Oxygen Sensor"],
    hotspot: [245, 267],
  },
  Drivetrain: {
    name: "Transmission & drivetrain",
    shortName: "Drivetrain",
    description: "Clutch, gearbox, shafts and driven-wheel joints",
    parts: ["Clutch Kit", "Gearbox", "Driveshaft", "CV Joint"],
    hotspot: [352, 224],
  },
};

export const electricCategoryOverrides: Partial<Record<keyof typeof categories, readonly string[]>> = {
  Electrical: ["12V Battery", "Drive Motor", "Power Inverter", "Onboard Charger"],
  Drivetrain: ["Reduction Gear", "Driveshaft", "CV Joint", "Differential"],
};

export const electricDiagramOverrides: Partial<Record<string, DiagramSystem>> = {
  Electrical: {
    ...diagramSystems.Electrical,
    name: "Electric drive & electrical",
    shortName: "Electric drive",
    description: "12V battery, drive motor, inverter and onboard charging",
    parts: electricCategoryOverrides.Electrical!,
  },
  Drivetrain: {
    ...diagramSystems.Drivetrain,
    description: "Reduction gear, shafts and driven-wheel joints",
    parts: electricCategoryOverrides.Drivetrain!,
  },
};

export const partHints: Record<string, string> = {
  "Air Filter": "Usually a flat, pleated panel inside a plastic air box.",
  "Oil Filter": "Usually a small metal can or cartridge housing.",
  "Timing Belt": "A toothed rubber belt hidden behind an engine cover.",
  "Water Pump": "A compact metal housing with a pulley or hose outlets.",
  "Brake Disc": "A large, flat metal circle mounted behind the wheel.",
  "Brake Pads": "Small curved blocks that sit on each side of the disc.",
  "Brake Caliper": "A heavy clamp-shaped housing fitted over the disc.",
  "ABS Sensor": "A small wired sensor mounted close to the wheel hub.",
  "Shock Absorber": "A long metal cylinder fitted vertically near a wheel.",
  "Coil Spring": "A thick metal coil positioned above or around the damper.",
  "Control Arm": "A solid A-shaped or curved arm under the vehicle.",
  "Drop Link": "A short thin rod with a joint at both ends.",
  "Front Bumper": "The large moulded panel across the front of the car.",
  Headlight: "The complete clear lamp unit at a front corner.",
  "Wing Mirror": "The mirror assembly attached to a front door.",
  "Tail Light": "The red lamp unit fitted at a rear corner.",
  Battery: "A rectangular box with positive and negative terminals.",
  Alternator: "A vented metal unit with a belt pulley on the front.",
  "Starter Motor": "A compact cylindrical motor with a smaller cylinder attached.",
  "Fuse Box": "A plastic box containing rows of coloured fuses and relays.",
  "Steering Wheel": "The round driver control mounted in front of the dashboard.",
  Dashboard: "The wide moulded panel containing instruments and air vents.",
  "Front Seat": "The complete seat frame, cushion and backrest assembly.",
  "Gear Knob": "The hand grip fitted to the top of the gear lever.",
  "Exhaust Back Box": "The large silencer box near the rear of the vehicle.",
  "Catalytic Converter": "A metal chamber in the exhaust, usually closer to the engine.",
  DPF: "A diesel particulate filter fitted in the exhaust on many diesel vehicles.",
  "Oxygen Sensor": "A small wired sensor screwed into the exhaust pipe.",
  "Clutch Kit": "The clutch disc, pressure plate and bearing fitted between engine and gearbox.",
  Gearbox: "The large casing that transfers engine or motor power to the wheels.",
  Driveshaft: "A solid shaft running from the gearbox or differential to a wheel.",
  "CV Joint": "A flexible joint covered by a ribbed rubber boot near a driven wheel.",
  "12V Battery": "The smaller low-voltage battery that powers vehicle controls and accessories.",
  "Drive Motor": "The electric motor that turns electrical energy into movement.",
  "Power Inverter": "An electronic unit that manages power between the traction battery and motor.",
  "Onboard Charger": "The unit that converts incoming charge power for the traction battery.",
  "Reduction Gear": "A compact gear unit that reduces motor speed before power reaches the wheels.",
  Differential: "The geared unit that lets driven wheels rotate at different speeds when turning.",
};

export const systemIllustrations: Record<string, string> = {
  Engine: "engine-cooling-v1", Brakes: "braking-system-v1", Suspension: "suspension-v1",
  Body: "body-lighting-v1", Electrical: "electrical-v1", Interior: "interior-controls-v1",
  Exhaust: "exhaust-emissions-v1", Drivetrain: "drivetrain-v1",
  ElectricElectrical: "ev-electrical-v1", ElectricDrivetrain: "ev-drivetrain-v1",
};

// Marker centres as [x%, y%] of the complete 3:2 artwork, without cropping.
// Each array follows the corresponding system.parts order, including EV overrides.
// These belong to the asset version: review them whenever an illustration changes.
// Markers sit near a component edge so identifying details remain visible; they
// are selection aids, not vehicle-specific fitting or installation coordinates.
export const illustrationHotspots: Record<string, readonly (readonly [number, number])[]> = {
  "engine-cooling-v1": [
    [12, 14], // Air Filter
    [59, 18], // Oil Filter
    [12, 61], // Timing Belt
    [60, 58], // Water Pump
  ],
  "braking-system-v1": [
    [11, 14], // Brake Disc
    [56, 14], // Brake Pads
    [11, 58], // Brake Caliper
    [56, 62], // ABS Sensor
  ],
  "suspension-v1": [
    [20, 25], // Shock Absorber
    [63, 14], // Coil Spring
    [13, 62], // Control Arm
    [67, 59], // Drop Link
  ],
  "body-lighting-v1": [
    [12, 14], // Front Bumper
    [61, 14], // Headlight
    [12, 58], // Wing Mirror
    [59, 59], // Tail Light
  ],
  "electrical-v1": [
    [11, 16], // Battery
    [57, 15], // Alternator
    [11, 59], // Starter Motor
    [55, 58], // Fuse Box
  ],
  "interior-controls-v1": [
    [11, 15], // Steering Wheel
    [37, 45], // Dashboard: beside its lower-left edge, away from the instruments
    [12, 58], // Front Seat
    [61, 57], // Gear Knob
  ],
  "exhaust-emissions-v1": [
    [11, 14], // Exhaust Back Box
    [55, 17], // Catalytic Converter
    [11, 59], // DPF
    [58, 61], // Oxygen Sensor
  ],
  "drivetrain-v1": [
    [12, 14], // Clutch Kit
    [56, 14], // Gearbox
    [13, 67], // Driveshaft
    [60, 63], // CV Joint
  ],
  "ev-electrical-v1": [
    [11, 15], // 12V Battery
    [53, 15], // Drive Motor
    [11, 58], // Power Inverter
    [56, 58], // Onboard Charger
  ],
  "ev-drivetrain-v1": [
    [11, 14], // Reduction Gear
    [71, 14], // Driveshaft
    [12, 63], // CV Joint
    [57, 58], // Differential
  ],
};
