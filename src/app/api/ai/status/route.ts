import { connection } from "next/server";
import { getOllamaStatus } from "@/lib/server/ollama";

// Reports whether a LOCAL Ollama server is running and which local models are
// installed. Cloud models are listed separately and are never used.
export async function GET() {
  await connection();
  const status = await getOllamaStatus();
  return Response.json(status, { headers: { "Cache-Control": "no-store" } });
}
