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
  const [partCategory, setPartCategory] = useState("");

  const [error, setError] = useState("");
  const [showResults, setShowResults] = useState(false);

  const categories = {
    Engine: [
      "Oil Filter",
      "Air Filter",
      "Spark Plugs",
      "Timing Belt",
      "Water Pump",
    ],
    Brakes: [
      "Brake Pads",
      "Brake Discs",
      "Brake Calipers",
      "Brake Lines",
      "ABS Sensors",
    ],
    Suspension: [
      "Shock Absorbers",
      "Coil Springs",
      "Drop Links",
      "Control Arms",
      "Bushes",
    ],
    Body: [
      "Front Bumper",
      "Rear Bumper",
      "Wing Mirror",
      "Headlight",
      "Tail Light",
    ],
    Interior: [
      "Steering Wheel",
      "Dashboard",
      "Seat",
      "Gear Knob",
      "Floor Mat",
    ],
    Electrical: [
      "Battery",
      "Alternator",
      "Starter Motor",
      "Fuse Box",
      "ECU",
    ],
  };

  const clean = (val: string) => val.trim();

  const cleanMake = clean(make);
  const cleanPostcode = clean(postcode);
  const cleanPrice = clean(price);

  const cleanPart = clean(part);
  const cleanPartNumber = clean(partNumber);

  const carQuery = [
    cleanMake,
    cleanPrice ? `under ${cleanPrice}` : "",
    cleanPostcode ? `near ${cleanPostcode}` : "",
  ]
    .filter(Boolean)
    .join(" ");

  const partsQuery = [
    partCategory,
    cleanPart,
    cleanPartNumber,
    cleanMake,
  ]
    .filter(Boolean)
    .join(" ");

  const autoTraderLink = `https://www.autotrader.co.uk/car-search?make=${cleanMake}&postcode=${cleanPostcode}&price-to=${cleanPrice}`;

  const ebayCarLink = `https://www.ebay.co.uk/sch/i.html?_nkw=${encodeURIComponent(
    carQuery + " car"
  )}`;

  const gumtreeLink = `https://www.gumtree.com/search?search_category=cars&q=${encodeURIComponent(
    carQuery
  )}`;

  const partsLink = `https://www.ebay.co.uk/sch/i.html?_nkw=${encodeURIComponent(
    partsQuery
  )}`;

  const handleSearch = () => {
    if (mode === "cars" && !cleanMake) {
      setError("Enter a car make");
      return;
    }

    if (mode === "parts" && !cleanMake) {
      setError("Enter a car make");
      return;
    }

    setError("");
    setShowResults(true);

    if (platform !== "all" && mode === "cars") {
      if (platform === "autotrader") window.open(autoTraderLink, "_blank");
      if (platform === "ebay") window.open(ebayCarLink, "_blank");
      if (platform === "gumtree") window.open(gumtreeLink, "_blank");
    }
  };

  return (
    <main className="min-h-screen bg-gray-950 text-white px-4 py-10">
      <div className="text-center mb-10">
        <h1 className="text-4xl font-semibold">CarScout</h1>
        <p className="text-gray-500 text-sm mt-2">
          Smarter search across platforms
        </p>
      </div>

      {/* MODE */}
      <div className="max-w-md mx-auto mb-6 flex bg-gray-800 rounded-xl p-1">
        <button
          onClick={() => {
            setMode("cars");
            setShowResults(false);
            setError("");
          }}
          className={`flex-1 py-2 rounded-lg ${
            mode === "cars" ? "bg-blue-600" : "text-gray-400"
          }`}
        >
          Cars
        </button>

        <button
          onClick={() => {
            setMode("parts");
            setShowResults(false);
            setError("");
          }}
          className={`flex-1 py-2 rounded-lg ${
            mode === "parts" ? "bg-blue-600" : "text-gray-400"
          }`}
        >
          Parts
        </button>
      </div>

      {/* CAR PLATFORMS */}
      {mode === "cars" && (
        <div className="max-w-md mx-auto mb-4 grid grid-cols-2 gap-2">
          <button
            onClick={() => setPlatform("all")}
            className={`p-2 rounded-lg ${
              platform === "all" ? "bg-blue-600" : "bg-gray-800"
            }`}
          >
            All
          </button>

          <button
            onClick={() => setPlatform("autotrader")}
            className={`p-2 rounded-lg ${
              platform === "autotrader" ? "bg-blue-600" : "bg-gray-800"
            }`}
          >
            AutoTrader
          </button>

          <button
            onClick={() => setPlatform("ebay")}
            className={`p-2 rounded-lg ${
              platform === "ebay" ? "bg-blue-600" : "bg-gray-800"
            }`}
          >
            eBay
          </button>

          <button
            onClick={() => setPlatform("gumtree")}
            className={`p-2 rounded-lg ${
              platform === "gumtree" ? "bg-blue-600" : "bg-gray-800"
            }`}
          >
            Gumtree
          </button>
        </div>
      )}

      {/* SEARCH CARD */}
      <div className="max-w-md mx-auto bg-gray-900 p-5 rounded-xl space-y-3">
        {mode === "cars" ? (
          <>
            <input
              placeholder="Make"
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

            <p className="text-xs text-gray-500">
              Searching: {carQuery || "..."}
            </p>
          </>
        ) : (
          <>
            <input
              placeholder="Car Make (required)"
              className="w-full p-3 rounded-lg bg-gray-800"
              value={make}
              onChange={(e) => setMake(e.target.value)}
            />

            <p className="text-sm text-gray-400">
              Which area is the part from?
            </p>

            <div className="grid grid-cols-2 gap-2">
              {Object.keys(categories).map((category) => (
                <button
                  key={category}
                  onClick={() => {
                    setPartCategory(category);
                    setPart("");
                  }}
                  className={`p-2 rounded-lg text-sm ${
                    partCategory === category
                      ? "bg-blue-600"
                      : "bg-gray-800"
                  }`}
                >
                  {category}
                </button>
              ))}
            </div>

            {/* SUGGESTED PARTS */}
            {partCategory &&
              categories[partCategory as keyof typeof categories] && (
                <div>
                  <p className="text-sm text-gray-400 mt-3 mb-2">
                    Suggested Parts
                  </p>

                  <div className="grid grid-cols-2 gap-2">
                    {categories[
                      partCategory as keyof typeof categories
                    ].map((suggestedPart) => (
                      <button
                        key={suggestedPart}
                        onClick={() => setPart(suggestedPart)}
                        className={`p-2 rounded-lg text-sm ${
                          part === suggestedPart
                            ? "bg-blue-600"
                            : "bg-gray-800"
                        }`}
                      >
                        {suggestedPart}
                      </button>
                    ))}
                  </div>
                </div>
              )}

            <input
              placeholder="Part Name (optional)"
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

            <p className="text-xs text-gray-500">
              Searching: {partsQuery || "..."}
            </p>
          </>
        )}

        {error && (
          <p className="text-red-400 text-sm text-center">{error}</p>
        )}

        <button
          onClick={handleSearch}
          className="w-full bg-blue-600 p-3 rounded-lg"
        >
          Search
        </button>
      </div>

      {/* RESULTS */}
      {showResults && (
        <div className="max-w-md mx-auto mt-8">
          <div className="bg-blue-600/20 border border-blue-600 p-4 rounded-xl text-center">
            <p className="text-sm text-blue-300">Best place to start</p>

            {mode === "cars" ? (
              <>
                <p className="text-lg font-semibold mt-1">
                  AutoTrader
                </p>

                <a
                  href={autoTraderLink}
                  target="_blank"
                  className="block bg-blue-600 p-2 rounded-lg mt-2"
                >
                  View Cars
                </a>
              </>
            ) : (
              <>
                <p className="text-lg font-semibold mt-1">
                  eBay Parts
                </p>

                <a
                  href={partsLink}
                  target="_blank"
                  className="block bg-blue-600 p-2 rounded-lg mt-2"
                >
                  View Parts
                </a>
              </>
            )}
          </div>
        </div>
      )}
    </main>
  );
}