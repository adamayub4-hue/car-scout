import { NextResponse } from "next/server";

const endpoint =
  "https://driver-vehicle-licensing.api.gov.uk/vehicle-enquiry/v1/vehicles";

function cleanRegistration(value: unknown) {
  return typeof value === "string"
    ? value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8)
    : "";
}

function json(body: object, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store, max-age=0" },
  });
}

export async function POST(request: Request) {
  if (process.env.ENABLE_DVLA_LOOKUP !== "true") {
    return json(
      {
        error:
          "Registration lookup is not available yet. Please use Make & model for now.",
      },
      503,
    );
  }

  const body = await request.json().catch(() => null);
  const registrationNumber = cleanRegistration(body?.registrationNumber);

  if (registrationNumber.length < 5) {
    return json({ error: "Enter a valid UK registration." }, 400);
  }

  const apiKey = process.env.DVLA_API_KEY;
  if (!apiKey) {
    return json(
      {
        error:
          "Live registration lookup is not connected yet. Please use Make & model for now.",
      },
      503,
    );
  }

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
      },
      body: JSON.stringify({ registrationNumber }),
      cache: "no-store",
    });
    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      const detail = payload?.errors?.[0]?.detail;
      return json(
        { error: detail || "We could not identify that vehicle." },
        response.status === 400 || response.status === 404
          ? response.status
          : 502,
      );
    }

    return json({
      vehicle: {
        registrationNumber: payload.registrationNumber,
        make: payload.make,
        yearOfManufacture: payload.yearOfManufacture,
        engineCapacity: payload.engineCapacity,
        fuelType: payload.fuelType,
        colour: payload.colour,
        motStatus: payload.motStatus,
        taxStatus: payload.taxStatus,
      },
    });
  } catch {
    return json(
      { error: "The vehicle lookup service is temporarily unavailable." },
      502,
    );
  }
}
