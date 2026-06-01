"use client";

import { useState } from "react";

export default function Home() {
  const [mode, setMode] = useState<"cars" | "parts">("cars");
  const [platform, setPlatform] = useState("all");

  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [year, setYear] = useState("");

  const [price, setPrice] = useState("");
  const [postcode, setPostcode] = useState("");

  const [part, setPart] = useState("");
  const [partNumber, setPartNumber] = useState("");
  const [partCategory, setPartCategory] = useState("");

  const [error, setError] = useState("");
  const [showResults, setShowResults] = useState(false);

  const makes = {
    Audi: ["A1", "A3", "A4", "A5", "Q3", "Q5"],
    BMW: ["1 Series", "3 Series", "5 Series", "X1", "X3"],
    Mercedes: ["A Class", "C Class", "E Class", "GLA", "GLC"],
    Ford: ["Fiesta", "Focus", "Kuga", "Puma"],
    Volkswagen: ["Polo", "Golf", "Passat", "Tiguan"],
    Toyota: ["Yaris", "Corolla", "CHR", "RAV4"],
  };

  const years = Array.from({ length: 15 }, (_, i) => `${2024 - i}`);

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

  const carQuery = [
    make,
    price ? `under ${price}` : "",
    postcode ? `near ${postcode}` : "",
  ]
    .filter(Boolean)
    .join(" ");

  const partsQuery = [
    make,
    model,
    year,
    partCategory,
    part,
    partNumber,
  ]
    .filter(Boolean)
    .join(" ");

  const autoTraderLink = `https://www.autotrader.co.uk/car-search?make=${make}&postcode=${postcode}&price-to=${price}`;

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
    if (mode === "cars" && !make) {
      setError("Enter a car make");
      return;
    }

    if (mode === "parts" && !make) {
      setError("Select or enter a vehicle make");
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

      {mode === "cars" && (
        <div className="max-w-md mx-auto mb-4 grid grid-cols-2 gap-2">
          <button onClick={() => setPlatform("all")} className={`p-2 rounded-lg ${platform === "all" ? "bg-blue-600" : "bg-gray-800"}`}>All</button>
          <button onClick={() => setPlatform("autotrader")} className={`p-2 rounded-lg ${platform === "autotrader" ? "bg-blue-600" : "bg-gray-800"}`}>AutoTrader</button>
          <button onClick={() => setPlatform("ebay")} className={`p-2 rounded-lg ${platform === "ebay" ? "bg-blue-600" : "bg-gray-800"}`}>eBay</button>
          <button onClick={() => setPlatform("gumtree")} className={`p-2 rounded-lg ${platform === "gumtree" ? "bg-blue-600" : "bg-gray-800"}`}>Gumtree</button>
        </div>
      )}

      <div className="max-w-md mx-auto bg-gray-900 p-5 rounded-xl space-y-3">
        {mode === "cars" ? (
          <>
            <input placeholder="Make" className="w-full p-3 rounded-lg bg-gray-800" value={make} onChange={(e) => setMake(e.target.value)} />
            <input placeholder="Max Price" className="w-full p-3 rounded-lg bg-gray-800" value={price} onChange={(e) => setPrice(e.target.value)} />
            <input placeholder="Postcode" className="w-full p-3 rounded-lg bg-gray-800" value={postcode} onChange={(e) => setPostcode(e.target.value)} />
          </>
        ) : (
          <>
            <input placeholder="Vehicle Make" className="w-full p-3 rounded-lg bg-gray-800" value={make} onChange={(e) => setMake(e.target.value)} />

            <div className="grid grid-cols-3 gap-2">
              {Object.keys(makes).map((carMake) => (
                <button
                  key={carMake}
                  onClick={() => {
                    setMake(carMake);
                    setModel("");
                  }}
                  className={`p-2 rounded-lg text-sm ${
                    make === carMake ? "bg-blue-600" : "bg-gray-800"
                  }`}
                >
                  {carMake}
                </button>
              ))}
            </div>

            {make && makes[make as keyof typeof makes] && (
              <div className="grid grid-cols-2 gap-2">
                {makes[make as keyof typeof makes].map((carModel) => (
                  <button
                    key={carModel}
                    onClick={() => setModel(carModel)}
                    className={`p-2 rounded-lg text-sm ${
                      model === carModel ? "bg-blue-600" : "bg-gray-800"
                    }`}
                  >
                    {carModel}
                  </button>
                ))}
              </div>
            )}

            <select
              value={year}
              onChange={(e) => setYear(e.target.value)}
              className="w-full p-3 rounded-lg bg-gray-800"
            >
              <option value="">Select Year</option>
              {years.map((y) => (
                <option key={y}>{y}</option>
              ))}
            </select>

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

            {partCategory && (
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
            )}

            <input
              placeholder="Part Name"
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

      {showResults && (
        <div className="max-w-md mx-auto mt-8">
          <div className="bg-blue-600/20 border border-blue-600 p-4 rounded-xl text-center">
            <p className="text-sm text-blue-300">
              Best place to start
            </p>

            {mode === "cars" ? (
              <a href={autoTraderLink} target="_blank" className="block bg-blue-600 p-2 rounded-lg mt-2">
                View Cars
              </a>
            ) : (
              <a href={partsLink} target="_blank" className="block bg-blue-600 p-2 rounded-lg mt-2">
                View Parts
              </a>
            )}
          </div>
        </div>
      )}
    </main>
  );
}