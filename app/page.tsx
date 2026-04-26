"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const [mode, setMode] = useState<"cars" | "parts">("cars");

  const [make, setMake] = useState("");
  const [price, setPrice] = useState("");
  const [postcode, setPostcode] = useState("");

  const [part, setPart] = useState("");
  const [partNumber, setPartNumber] = useState("");

  const [cars, setCars] = useState<any[]>([]);

  const router = useRouter();

  const clean = (val: string) => val.trim();

  const handleSearch = async () => {
    const res = await fetch("/api/cars");
    const data = await res.json();

    const filtered = data.filter((car: any) => {
      const matchMake = make
        ? car.name.toLowerCase().includes(make.toLowerCase())
        : true;

      const matchPrice = price
        ? car.price <= Number(price)
        : true;

      const matchPostcode = postcode
        ? car.location.toLowerCase().includes(postcode.toLowerCase())
        : true;

      return matchMake && matchPrice && matchPostcode;
    });

    setCars(filtered);
  };

  // 🔧 CLEAN VALUES
  const cleanMake = clean(make);
  const cleanPostcode = clean(postcode);
  const cleanPrice = clean(price);

  const cleanPart = clean(part);
  const cleanPartNumber = clean(partNumber);

  // 🚗 CAR LINKS (IMPROVED)
  const autoTraderLink = `https://www.autotrader.co.uk/car-search?make=${cleanMake}&postcode=${cleanPostcode}&price-to=${cleanPrice}`;

  const ebayCarLink = `https://www.ebay.co.uk/sch/i.html?_nkw=${cleanMake}+car`;

  const gumtreeLink = `https://www.gumtree.com/search?search_category=cars&q=${cleanMake}`;

  // 🔧 PARTS LINK (SMART)
  const partsQuery = `${cleanPart} ${cleanPartNumber} ${cleanMake}`.trim();

  const partsLink = `https://www.ebay.co.uk/sch/i.html?_nkw=${encodeURIComponent(
    partsQuery
  )}`;

  return (
    <main className="min-h-screen bg-gray-950 text-white px-4 py-10">

      {/* HEADER */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-semibold">CarScout</h1>
        <p className="text-gray-500 text-sm">
          Search smarter. Find faster.
        </p>
      </div>

      {/* MODE SWITCH */}
      <div className="max-w-md mx-auto mb-8 flex bg-gray-900 rounded-lg p-1">
        <button
          onClick={() => setMode("cars")}
          className={`flex-1 py-2 rounded-md ${
            mode === "cars" ? "bg-blue-600" : "text-gray-400"
          }`}
        >
          Cars
        </button>

        <button
          onClick={() => setMode("parts")}
          className={`flex-1 py-2 rounded-md ${
            mode === "parts" ? "bg-blue-600" : "text-gray-400"
          }`}
        >
          Parts
        </button>
      </div>

      {/* SEARCH BOX */}
      <div className="max-w-md mx-auto bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-3">

        {mode === "cars" ? (
          <>
            <input
              placeholder="Make (Audi, BMW...)"
              className="w-full p-3 rounded-lg bg-gray-800"
              value={make}
              onChange={(e) => setMake(e.target.value)}
            />

            <input
              placeholder="Max Price"
              className="w-full p-3 rounded-lg bg-gray-800"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />

            <input
              placeholder="Postcode"
              className="w-full p-3 rounded-lg bg-gray-800"
              value={postcode}
              onChange={(e) => setPostcode(e.target.value)}
            />

            <button
              onClick={handleSearch}
              className="w-full bg-blue-600 p-3 rounded-lg"
            >
              Search Cars
            </button>
          </>
        ) : (
          <>
            <input
              placeholder="Part (e.g brake pads)"
              className="w-full p-3 rounded-lg bg-gray-800"
              value={part}
              onChange={(e) => setPart(e.target.value)}
            />

            <input
              placeholder="Part Number (optional)"
              className="w-full p-3 rounded-lg bg-gray-800"
              value={partNumber}
              onChange={(e) => setPartNumber(e.target.value)}
            />

            <input
              placeholder="Car Make (optional)"
              className="w-full p-3 rounded-lg bg-gray-800"
              value={make}
              onChange={(e) => setMake(e.target.value)}
            />

            <a
              href={partsLink}
              target="_blank"
              className="block text-center bg-blue-600 p-3 rounded-lg"
            >
              Search Parts
            </a>
          </>
        )}
      </div>

      {/* CAR RESULTS + LINKS */}
      {mode === "cars" && (
        <>
          <div className="max-w-md mx-auto mt-6 space-y-2">
            <a href={autoTraderLink} target="_blank" className="block bg-gray-900 p-3 rounded-lg border border-gray-800 text-center">
              AutoTrader
            </a>

            <a href={ebayCarLink} target="_blank" className="block bg-gray-900 p-3 rounded-lg border border-gray-800 text-center">
              eBay
            </a>

            <a href={gumtreeLink} target="_blank" className="block bg-gray-900 p-3 rounded-lg border border-gray-800 text-center">
              Gumtree
            </a>
          </div>

          <div className="mt-8 max-w-md mx-auto space-y-3">
            {cars.map((car) => (
              <div
                key={car.id}
                onClick={() => router.push(`/cars/${car.id}`)}
                className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden"
              >
                <img src={car.image} className="w-full h-36 object-cover" />
                <div className="p-3">
                  <p>{car.name}</p>
                  <p className="text-blue-400">£{car.price}</p>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

    </main>
  );
}
<div className="mt-16 max-w-md mx-auto bg-gray-900 border border-gray-800 p-4 rounded-xl">
  <h2 className="text-sm mb-2 text-gray-400">Feedback</h2>

  <textarea
    placeholder="What would you improve?"
    className="w-full p-2 rounded bg-gray-800 mb-2"
  />

  <button
    onClick={() => alert("Feedback feature coming soon")}
    className="w-full bg-blue-600 p-2 rounded"
  >
    Send Feedback
  </button>
</div>