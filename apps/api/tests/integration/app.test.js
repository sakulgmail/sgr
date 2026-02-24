import request from "supertest";
import { describe, expect, it } from "vitest";
import { app } from "../../src/app.js";

describe("app integration", () => {
  it("returns health", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it("protects auth-required routes", async () => {
    const res = await request(app).get("/api/work-requests");
    expect(res.status).toBe(401);
  });
});
