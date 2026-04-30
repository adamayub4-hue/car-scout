"use client";

import { useState } from "react";

export default function Home() {
  const [mode, setMode] = useState<"cars" | "parts">("cars");

  const [make, setMake] = useState("");
  const [price, setPrice] = useState("");
  const [postcode, setPostcode] = useState("");

  const [part, setPart] = useState("");
  const [partNumber, setPartNumber] = useState("");

  const clean = (val: string) => val.trim();

  const cleanMake = clean(make);
  const cleanPostcode = clean(postcode);
  const cleanPrice = clean(price);

  const cleanPart = clean(part);
  const cleanPartNumber = clean(partNumber);

  // 🚗 LINKS
  const autoTraderLink = `https://www.autotrader.co.uk/car-search?make=${cleanMake}&postcode=${cleanPostcode}&price-to=${cleanPrice}`;
  const ebayCarLink = `https://www.ebay.co.uk/sch/i.html?_nkw=${cleanMake}+car`;
  const gumtreeLink = `https://www.gumtree.com/search?search_category=cars&q=${cleanMake}`;

  // 🔧 PARTS LINK
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
          Search cars and parts in one place
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
          </>
        )}

      </div>

      {/* 🚗 CAR MODE */}
      {mode === "cars" && (
        <div className="max-w-md mx-auto mt-6 space-y-2">

          <p className="text-sm text-gray-500 text-center">
            Choose where to search
          </p>

          <a href={autoTraderLink} target="_blank" className="block bg-gray-900 p-3 rounded-lg text-center border border-gray-800">
            AutoTrader
          </a>

          <a href={ebayCarLink} target="_blank" className="block bg-gray-900 p-3 rounded-lg text-center border border-gray-800">
            eBay
          </a>

          <a href={gumtreeLink} target="_blank" className="block bg-gray-900 p-3 rounded-lg text-center border border-gray-800">
            Gumtree
          </a>

          <p className="text-xs text-gray-600 text-center mt-2">
            Opens in app if installed
          </p>

        </div>
      )}

      {/* 🔧 PARTS MODE */}
      {mode === "parts" && (
        <div className="max-w-md mx-auto mt-6 text-center">

          <a
            href={partsLink}
            target="_blank"
            className="block bg-blue-600 p-3 rounded-lg"
          >
            Search Parts
          </a>

        </div>
      )}

    </main>
  );
}