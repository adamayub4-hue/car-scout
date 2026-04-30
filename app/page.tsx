"use client";

import { useState } from "react";

export default function Home() {
  const [mode, setMode] = useState<"cars" | "parts">("cars");
  const [platform, setPlatform] = useState("all");

  const [make, setMake] = useState("");
  const [price, setPrice] = useState("");
  const [postcode, setPostcode] = useState("");

  const [part, setPart] = useState("");
  const [partNumber, setPartNumber] = useState("");

  const [error, setError] = useState("");
  const [showResults, setShowResults] = useState(false);

  const clean = (val: string) => val.trim();

  const cleanMake = clean(make);
  const cleanPostcode = clean(postcode);
  const cleanPrice = clean(price);

  const cleanPart = clean(part);
  const cleanPartNumber = clean(partNumber);

  const carQuery = [
    cleanMake,
    cleanPrice ? `under ${cleanPrice}` : "",
    cleanPostcode ? `near ${cleanPostcode}` : ""
  ]
    .filter(Boolean)
    .join(" ");

  const partsQuery = [
    cleanPart,
    cleanPartNumber,
    cleanMake
  ]
    .filter(Boolean)
    .join(" ");

  const autoTraderLink = `https://www.autotrader.co.uk/car-search?make=${cleanMake}&postcode=${cleanPostcode}&price-to=${cleanPrice}`;
  const ebayCarLink = `https://www.ebay.co.uk/sch/i.html?_nkw=${encodeURIComponent(carQuery + " car")}`;
  const gumtreeLink = `https://www.gumtree.com/search?search_category=cars&q=${encodeURIComponent(carQuery)}`;
  const partsLink = `https://www.ebay.co.uk/sch/i.html?_nkw=${encodeURIComponent(partsQuery)}`;

  const handleSearch = () => {
    if (mode === "cars" && !cleanMake) {
      setError("Enter a car make");
      return;
    }

    if (mode === "parts" && !cleanPart) {
      setError("Enter a part name");
      return;
    }

    setError("");

    if (platform === "all") {
      setShowResults(true);
    } else {
      if (mode === "cars") {
        if (platform === "autotrader") window.open(autoTraderLink, "_blank");
        if (platform === "ebay") window.open(ebayCarLink, "_blank");
        if (platform === "gumtree") window.open(gumtreeLink, "_blank");
      } else {
        window.open(partsLink, "_blank");
      }
    }
  };

  return (
    <main className="min-h-screen bg-gray-950 text-white px-4 py-10">

      <div className="text-center mb-10">
        <h1 className="text-4xl font-semibold">CarScout</h1>
        <p className="text-gray-500 text-sm mt-2">
          Search smarter across platforms
        </p>
      </div>

      {/* MODE */}
      <div className="max-w-md mx-auto mb-6 flex bg-gray-800 rounded-xl p-1">
        <button onClick={() => setMode("cars")} className={`flex-1 py-2 rounded-lg ${mode === "cars" ? "bg-blue-600" : "text-gray-400"}`}>
          Cars
        </button>
        <button onClick={() => setMode("parts")} className={`flex-1 py-2 rounded-lg ${mode === "parts" ? "bg-blue-600" : "text-gray-400"}`}>
          Parts
        </button>
      </div>

      {/* PLATFORM */}
      {mode === "cars" && (
        <div className="max-w-md mx-auto mb-4 grid grid-cols-2 gap-2">
          <button onClick={() => setPlatform("all")} className={`p-2 rounded-lg ${platform === "all" ? "bg-blue-600" : "bg-gray-800"}`}>
            All
          </button>
          <button onClick={() => setPlatform("autotrader")} className={`p-2 rounded-lg ${platform === "autotrader" ? "bg-blue-600" : "bg-gray-800"}`}>
            AutoTrader
          </button>
          <button onClick={() => setPlatform("ebay")} className={`p-2 rounded-lg ${platform === "ebay" ? "bg-blue-600" : "bg-gray-800"}`}>
            eBay
          </button>
          <button onClick={() => setPlatform("gumtree")} className={`p-2 rounded-lg ${platform === "gumtree" ? "bg-blue-600" : "bg-gray-800"}`}>
            Gumtree
          </button>
        </div>
      )}

      {/* INPUTS */}
      <div className="max-w-md mx-auto bg-gray-900 p-5 rounded-xl space-y-3">

        {mode === "cars" ? (
          <>
            <input placeholder="Make" className="w-full p-3 rounded-lg bg-gray-800" value={make} onChange={(e) => setMake(e.target.value)} />
            <input placeholder="Max Price" className="w-full p-3 rounded-lg bg-gray-800" value={price} onChange={(e) => setPrice(e.target.value)} />
            <input placeholder="Postcode" className="w-full p-3 rounded-lg bg-gray-800" value={postcode} onChange={(e) => setPostcode(e.target.value)} />
            <p className="text-xs text-gray-500">Searching: {carQuery || "..."}</p>
          </>
        ) : (
          <>
            <input placeholder="Part" className="w-full p-3 rounded-lg bg-gray-800" value={part} onChange={(e) => setPart(e.target.value)} />
            <input placeholder="Part Number" className="w-full p-3 rounded-lg bg-gray-800" value={partNumber} onChange={(e) => setPartNumber(e.target.value)} />
            <input placeholder="Car Make" className="w-full p-3 rounded-lg bg-gray-800" value={make} onChange={(e) => setMake(e.target.value)} />
            <p className="text-xs text-gray-500">Searching: {partsQuery || "..."}</p>
          </>
        )}

        {error && <p className="text-red-400 text-sm text-center">{error}</p>}

        <button onClick={handleSearch} className="w-full bg-blue-600 p-3 rounded-lg">
          Search
        </button>

      </div>

      {/* RESULTS */}
      {showResults && (
        <div className="max-w-md mx-auto mt-8 space-y-3">

          <p className="text-sm text-gray-400 text-center">
            Choose a platform
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

        </div>
      )}

    </main>
  );
}