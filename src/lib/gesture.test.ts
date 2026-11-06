import { describe, expect, it } from "vitest";
import { formatTime, swipeTarget } from "./gesture";
describe("silent scrubbing math", () => {
  it("supports both directions and customizable seconds per screen", () => {
    expect(swipeTarget(100, 215, 430, 3600, 120)).toBe(160);
    expect(swipeTarget(100, -215, 430, 3600, 120)).toBe(40);
    expect(swipeTarget(100, 430, 430, 3600, 300)).toBe(400);
  });
  it("clamps to seekable media boundaries", () => {
    expect(swipeTarget(5, -430, 430, 3600, 120)).toBe(0);
    expect(swipeTarget(3590, 430, 430, 3600, 120)).toBe(3599.9);
    expect(swipeTarget(0, 100, 0, 0, 120)).toBe(0);
  });
  it("formats long videos without wrapping at one hour", () => {
    expect(formatTime(3661)).toBe("1:01:01");
    expect(formatTime(61)).toBe("1:01");
    expect(formatTime(Infinity)).toBe("0:00");
  });
});
