import { writeFile } from "node:fs/promises";
import { db } from "../server/db";
import { trips } from "../shared/schema";
import { checksumTrips } from "./legacy-trips";

async function main() {
  const rows = await db.select().from(trips);
  const payload = {
    exportedAt: new Date().toISOString(),
    count: rows.length,
    checksum: checksumTrips(rows),
    trips: rows,
  };
  const out = process.argv[2] || `legacy-trips-${Date.now()}.json`;
  await writeFile(out, JSON.stringify(payload, null, 2), "utf8");
  console.log(`Exported ${payload.count} trips to ${out}`);
  console.log(`checksum ${payload.checksum}`);
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
