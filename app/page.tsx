"use client";

import { useState } from "react";

export default function Home() {
  const [mode, setMode] = useState<"cars" | "parts">("cars");

  const [make, setMake] = useState("");
  const [price, setPrice] = useState("");
  const [postcode, setPostcode] = useState("");

  const [part, setPart] = useState("");
  const [partNumber, setPartNumber] = useState("");

  const [error, setError] = useState("");

  const clean = (val: string) => val.trim();

  const cleanMake = clean(make);
  const cleanPostcode = clean(postcode);
  const cleanPrice = clean(price);

  const cleanPart = clean(part);
  const cleanPartNumber = clean(partNumber);

  const autoTraderLink = `https://www.autotrader.co.uk/car-search?make=${cleanMake}&postcode=${cleanPostcode}&price-to=${cleanPrice}`;
  const ebayCarLink = `https://www.ebay.co.uk/sch/i.html?_nkw=${cleanMake}+car`;
  const gumtreeLink = `https://www.gumtree.com/search?search_category=cars&q=${cleanMake}`;

  const partsQuery = `${cleanPart} ${cleanPartNumber} ${cleanMake}`.trim();
  const partsLink = `https://www.ebay.co.uk/sch/i.html?_nkw=${encodeURIComponent(partsQuery)}`;

  const handleSearch = () => {
    if (mode === "cars" && !cleanMake) {
      setError("Please enter a car make");
      return;
    }

    if (mode === "parts" && !cleanPart) {
      setError("Please enter a part name");
      return;
    }

    setError("");

    if (mode === "cars") {
      window.open(autoTraderLink, "_blank");
    } else {
      window.open(partsLink, "_blank");
    }
  };

  return (
    <main className="min-h-screen bg-gray-950 text-white px-4 py-10">

      <div className="text-center mb-8">
        <h1 className="text-3xl font-semibold">CarScout</h1>
        <p className="text-gray-500 text-sm">
          Search cars and parts in one place
        </p>
      </div>

      <div className="max-w-md mx-auto mb-8 flex bg-gray-900 rounded-lg p-1">
        <button onClick={() => { setMode("cars"); setError(""); }} className={`flex-1 py-2 rounded-md ${mode === "cars" ? "bg-blue-600" : "text-gray-400"}`}>
          Cars
        </button>
        <button onClick={() => { setMode("parts"); setError(""); }} className={`flex-1 py-2 rounded-md ${mode === "parts" ? "bg-blue-600" : "text-gray-400"}`}>
          Parts
        </button>
      </div>

      <div className="max-w-md mx-auto bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-3">

        {mode === "cars" ? (
          <>
            <input
              placeholder="Make (required)"
              className={`w-full p-3 rounded-lg ${error && !cleanMake ? "bg-red-900" : "bg-gray-800"}`}
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

            {/* EXAMPLES */}
            <div className="text-sm text-gray-500 space-y-1">
              <p>Try:</p>
              <button onClick={() => { setMake("Audi"); setPrice(""); }} className="block underline">Audi</button>
              <button onClick={() => { setMake("BMW"); setPrice("20000"); }} className="block underline">BMW under £20k</button>
            </div>
          </>
        ) : (
          <>
            <input
              placeholder="Part (required)"
              className={`w-full p-3 rounded-lg ${error && !cleanPart ? "bg-red-900" : "bg-gray-800"}`}
              value={part}
              onChange={(e) => setPart(e.target.value)}
            />

            <input
              placeholder="Part Number"
              className="w-full p-3 rounded-lg bg-gray-800"
              value={partNumber}
              onChange={(e) => setPartNumber(e.target.value)}
            />

            <input
              placeholder="Car Make"
              className="w-full p-3 rounded-lg bg-gray-800"
              value={make}
              onChange={(e) => setMake(e.target.value)}
            />

            {/* EXAMPLES */}
            <div className="text-sm text-gray-500 space-y-1">
              <p>Try:</p>
              <button onClick={() => setPart("brake pads")} className="block underline">Brake pads</button>
              <button onClick={() => { setPart("oil filter"); setMake("Audi A3"); }} className="block underline">Oil filter Audi A3</button>
            </div>
          </>
        )}

        {error && <p className="text-red-400 text-sm text-center">{error}</p>}

        <button onClick={handleSearch} className="w-full bg-blue-600 p-3 rounded-lg">
          Search
        </button>

      </div>

    </main>
  );
}