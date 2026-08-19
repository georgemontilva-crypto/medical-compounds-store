import { describe, expect, it } from "vitest";
import { computePointsForOrder } from "./rewards";

describe("computePointsForOrder", () => {
  it("awards one point per whole dollar", () => {
    expect(computePointsForOrder("249.50")).toBe(249);
    expect(computePointsForOrder(100)).toBe(100);
  });

  it("floors rather than rounds, so points are never granted for cents", () => {
    expect(computePointsForOrder("0.99")).toBe(0);
    expect(computePointsForOrder("1.99")).toBe(1);
  });

  it("awards nothing for a zero or negative total", () => {
    expect(computePointsForOrder("0.00")).toBe(0);
    expect(computePointsForOrder(-50)).toBe(0);
  });

  it("awards nothing for an unparseable total instead of NaN points", () => {
    expect(computePointsForOrder("")).toBe(0);
    expect(computePointsForOrder("not-a-number")).toBe(0);
  });
});
