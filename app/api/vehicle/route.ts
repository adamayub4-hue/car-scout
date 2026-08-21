import { NextResponse } from "next/server";

const endpoint =
  "https://driver-vehicle-licensing.api.gov.uk/vehicle-enquiry/v1/vehicles";

function cleanRegistration(value: unknown) {
  return typeof value === "string"
    ? value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8)
    : "";
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const registrationNumber = cleanRegistration(body?.registrationNumber);

  if (registrationNumber.length < 5) {
    return NextResponse.json(
      { error: "Enter a valid UK registration." },
      { status: 400 },
    );
  }

  const apiKey = process.env.DVLA_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          "Live registration lookup is not connected yet. Please use Make & model for now.",
      },
      { status: 503 },
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
      return NextResponse.json(
        { error: detail || "We could not identify that vehicle." },
        { status: response.status === 404 ? 404 : 502 },
      );
    }

    return NextResponse.json({
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
    return NextResponse.json(
      { error: "The vehicle lookup service is temporarily unavailable." },
      { status: 502 },
    );
  }
}
