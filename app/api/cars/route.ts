export async function GET() {
  return Response.json([
    {
      id: 1,
      name: "Audi A3",
      price: 18000,
      location: "b27",
      image:
        "https://images.unsplash.com/photo-1606664515524-ed2f786a0bd6?q=80&w=1200",
      link: "https://www.autotrader.co.uk/car-search?make=Audi&model=A3",
    },
    {
      id: 2,
      name: "BMW 1 Series",
      price: 19000,
      location: "b27",
      image:
        "https://images.unsplash.com/photo-1555215695-3004980ad54d?q=80&w=1200",
      link: "https://www.autotrader.co.uk/car-search?make=BMW&model=1-Series",
    },
    {
      id: 3,
      name: "Mercedes A-Class",
      price: 20000,
      location: "b1",
      image:
        "https://images.unsplash.com/photo-1618843479313-40f8afb4b4d8?q=80&w=1200",
      link: "https://www.autotrader.co.uk/car-search?make=Mercedes-Benz&model=A-Class",
    },
  ]);
}