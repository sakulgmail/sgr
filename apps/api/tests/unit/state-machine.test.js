import { describe, expect, it } from "vitest";
import { canTransition } from "../../src/services/state-machine.js";

describe("state machine", () => {
  it("allows expected transitions", () => {
    expect(canTransition("submitted", "approved")).toBe(true);
    expect(canTransition("submitted", "rejected")).toBe(true);
    expect(canTransition("approved", "preparing_goods_sampling")).toBe(true);
    expect(canTransition("preparing_goods_sampling", "ready_to_ship")).toBe(true);
    expect(canTransition("ready_to_ship", "shipped")).toBe(true);
  });

  it("rejects invalid transitions", () => {
    expect(canTransition("submitted", "shipped")).toBe(false);
    expect(canTransition("rejected", "approved")).toBe(false);
    expect(canTransition("shipped", "approved")).toBe(false);
  });
});
