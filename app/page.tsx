"use client";

import { useState, useRef } from "react";

export default function Home() {
  const [mode, setMode] = useState<"cars" | "parts">("cars");

  const [make, setMake] = useState("");
  const [price, setPrice] = useState("");
  const [postcode, setPostcode] = useState("");

  const [part, setPart] = useState("");
  const [partNumber, setPartNumber] = useState("");

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);

  const resultsRef = useRef<HTMLDivElement>(null);

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
      setError("Enter a car make to continue");
      return;
    }

    if (mode === "parts" && !cleanPart) {
      setError("Enter a part name to continue");
      return;
    }

    setError("");
    setLoading(true);

    setTimeout(() => {
      setLoading(false);
      setShowResults(true);

      setTimeout(() => {
        resultsRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    }, 500);
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-950 to-gray-900 text-white px-4 py-10">

      {/* HEADER */}
      <div className="text-center mb-10">
        <h1 className="text-4xl font-semibold tracking-tight">CarScout</h1>
        <p className="text-gray-500 text-sm mt-2">
          Find cars and parts instantly
        </p>
      </div>

      {/* MODE SWITCH */}
      <div className="max-w-md mx-auto mb-8 flex bg-gray-800 rounded-xl p-1 shadow-inner">
        <button
          onClick={() => {
            setMode("cars");
            setError("");
            setShowResults(false);
          }}
          className={`flex-1 py-2 rounded-lg transition ${
            mode === "cars" ? "bg-blue-600" : "text-gray-400"
          }`}
        >
          Cars
        </button>

        <button
          onClick={() => {
            setMode("parts");
            setError("");
            setShowResults(false);
          }}
          className={`flex-1 py-2 rounded-lg transition ${
            mode === "parts" ? "bg-blue-600" : "text-gray-400"
          }`}
        >
          Parts
        </button>
      </div>

      {/* CARD */}
      <div className="max-w-md mx-auto bg-gray-900/80 backdrop-blur border border-gray-800 rounded-2xl p-5 space-y-4 shadow-lg">

        {mode === "cars" ? (
          <>
            <input
              placeholder="Make (e.g Audi)"
              className={`w-full p-3 rounded-xl ${
                error && !cleanMake ? "bg-red-900" : "bg-gray-800"
              }`}
              value={make}
              onChange={(e) => setMake(e.target.value)}
            />

            <input
              placeholder="Max Price"
              className="w-full p-3 rounded-xl bg-gray-800"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />

            <input
              placeholder="Postcode"
              className="w-full p-3 rounded-xl bg-gray-800"
              value={postcode}
              onChange={(e) => setPostcode(e.target.value)}
            />

            <div className="text-xs text-gray-500">
              Try:{" "}
              <button onClick={() => setMake("Audi")} className="underline">
                Audi
              </button>{" "}
              •{" "}
              <button
                onClick={() => {
                  setMake("BMW");
                  setPrice("20000");
                }}
                className="underline"
              >
                BMW under £20k
              </button>
            </div>
          </>
        ) : (
          <>
            <input
              placeholder="Part (e.g brake pads)"
              className={`w-full p-3 rounded-xl ${
                error && !cleanPart ? "bg-red-900" : "bg-gray-800"
              }`}
              value={part}
              onChange={(e) => setPart(e.target.value)}
            />

            <input
              placeholder="Part Number"
              className="w-full p-3 rounded-xl bg-gray-800"
              value={partNumber}
              onChange={(e) => setPartNumber(e.target.value)}
            />

            <input
              placeholder="Car Make"
              className="w-full p-3 rounded-xl bg-gray-800"
              value={make}
              onChange={(e) => setMake(e.target.value)}
            />

            <div className="text-xs text-gray-500">
              Try:{" "}
              <button onClick={() => setPart("brake pads")} className="underline">
                Brake pads
              </button>{" "}
              •{" "}
              <button
                onClick={() => {
                  setPart("oil filter");
                  setMake("Audi A3");
                }}
                className="underline"
              >
                Oil filter A3
              </button>
            </div>
          </>
        )}

        {error && <p className="text-red-400 text-sm text-center">{error}</p>}

        {/* CTA */}
        <button
          onClick={handleSearch}
          className="w-full bg-blue-600 hover:bg-blue-500 transition p-3 rounded-xl font-medium"
        >
          {loading ? "Searching..." : "Find Results"}
        </button>

      </div>

      {/* RESULTS */}
      {showResults && (
        <div ref={resultsRef} className="max-w-md mx-auto mt-8 space-y-3">

          <p className="text-sm text-gray-400 text-center">
            Choose a platform
          </p>

          {mode === "cars" ? (
            <>
              <a href={autoTraderLink} target="_blank" className="block bg-gray-900 hover:bg-gray-800 p-3 rounded-xl text-center border border-gray-800 transition">
                AutoTrader
              </a>

              <a href={ebayCarLink} target="_blank" className="block bg-gray-900 hover:bg-gray-800 p-3 rounded-xl text-center border border-gray-800 transition">
                eBay
              </a>

              <a href={gumtreeLink} target="_blank" className="block bg-gray-900 hover:bg-gray-800 p-3 rounded-xl text-center border border-gray-800 transition">
                Gumtree
              </a>
            </>
          ) : (
            <a href={partsLink} target="_blank" className="block bg-blue-600 hover:bg-blue-500 p-3 rounded-xl text-center transition">
              View Parts on eBay
            </a>
          )}

        </div>
      )}

    </main>
  );
}