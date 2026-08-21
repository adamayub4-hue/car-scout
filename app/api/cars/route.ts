import { cars } from "@/app/lib/cars";

export async function GET() {
  return Response.json(cars);
}
