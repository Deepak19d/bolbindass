import { connection } from "next/server";
import { getSarvamStatus } from "@/lib/server/sarvam";

// Only reports whether a Sarvam key exists. Never calls Sarvam, never returns the key.
export async function GET() {
  await connection();
  return Response.json(getSarvamStatus(), { headers: { "Cache-Control": "no-store" } });
}
