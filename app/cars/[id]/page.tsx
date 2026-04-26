export default async function CarPage({ params }: any) {
  const { id } = await params;

  const res = await fetch("http://localhost:3000/api/cars", {
    cache: "no-store",
  });

  const cars = await res.json();
  const car = cars.find((c: any) => String(c.id) === id);

  if (!car) {
    return <div>Car not found</div>;
  }

  return (
    <main className="min-h-screen bg-black text-white p-10">
      <img
        src={car.image}
        className="w-full max-w-2xl rounded-lg mb-6"
      />

      <h1 className="text-3xl font-bold">{car.name}</h1>
      <p className="text-xl text-green-400 mb-2">£{car.price}</p>
      <p className="mb-6">{car.location}</p>

      <a
        href={car.link}
        target="_blank"
        className="bg-blue-500 px-6 py-3 rounded-lg"
      >
        View on AutoTrader →
      </a>
    </main>
  );
}