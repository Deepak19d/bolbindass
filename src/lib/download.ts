import { exportAll, exportFileName } from "./db";

/** Save the learner's local history as a JSON file (generated in the browser; nothing is uploaded). */
export async function downloadHistoryExport(): Promise<number> {
  const bundle = await exportAll();
  const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = exportFileName();
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return bundle.sessions.length;
}
