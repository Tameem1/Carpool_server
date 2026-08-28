import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./storage", () => ({
  storage: { getUser: vi.fn() },
}));

import { rejectCrossSiteWrites } from "./session";

describe("CSRF origin checks", () => {
  beforeEach(() => {
    process.env.CARS_PUBLIC_ORIGIN = "https://cars.evally.net";
  });

  it("rejects unsafe methods from a hostile origin", async () => {
    const app = express();
    app.use(rejectCrossSiteWrites);
    app.post("/api/trips", (_req, res) => res.json({ ok: true }));

    const blocked = await request(app)
      .post("/api/trips")
      .set("Origin", "https://evil.example");
    expect(blocked.status).toBe(403);

    const allowed = await request(app)
      .post("/api/trips")
      .set("Origin", "https://cars.evally.net");
    expect(allowed.status).toBe(200);
  });
});
