import Image from "next/image";
import { notFound } from "next/navigation";
import { cars } from "@/app/lib/cars";

type CarPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function CarPage({ params }: CarPageProps) {
  const { id } = await params;
  const car = cars.find((candidate) => String(candidate.id) === id);

  if (!car) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-black text-white p-10">
      <Image
        src={car.image}
        alt={car.name}
        width={1200}
        height={800}
        className="w-full max-w-2xl rounded-lg mb-6"
      />

      <h1 className="text-3xl font-bold">{car.name}</h1>
      <p className="text-xl text-green-400 mb-2">£{car.price}</p>
      <p className="mb-6">{car.location}</p>

      <a
        href={car.link}
        target="_blank"
        rel="noreferrer"
        className="bg-blue-500 px-6 py-3 rounded-lg"
      >
        View on AutoTrader
      </a>
    </main>
  );
}
