import { describe, expect, it } from "vitest";
import { formatMoney, parseMoney } from "./money";
import {
  canMove,
  mayChangeOrder,
  normalizePhone,
  refusal,
  restocks,
  slugify,
} from "./pipeline";

describe("order pipeline", () => {
  it("only moves forward", () => {
    expect(canMove("pending", "confirmed")).toBe(true);
    expect(canMove("confirmed", "pending")).toBe(false);
    expect(canMove("pending", "shipped")).toBe(false);
    expect(canMove("delivered", "paid")).toBe(true);
    expect(canMove("paid", "returned")).toBe(false);
  });
  it("cancels from pending or confirmed, returns from shipped or delivered", () => {
    expect(canMove("confirmed", "cancelled")).toBe(true);
    expect(canMove("shipped", "cancelled")).toBe(false);
    expect(canMove("delivered", "returned")).toBe(true);
    expect(canMove("pending", "returned")).toBe(false);
    expect(restocks("cancelled") && restocks("returned")).toBe(true);
  });
  it("lets members change only unassigned or their own orders", () => {
    expect(mayChangeOrder({ id: "a", admin: false }, null)).toBe(true);
    expect(mayChangeOrder({ id: "a", admin: false }, "a")).toBe(true);
    expect(mayChangeOrder({ id: "a", admin: false }, "b")).toBe(false);
    expect(mayChangeOrder({ id: "a", admin: true }, "b")).toBe(true);
    expect(
      refusal(
        { id: "a", admin: false },
        { status: "pending", assigneeId: "b" },
        "confirmed",
      ),
    ).toMatch(/another member/);
  });
});

describe("helpers", () => {
  it("parses and formats money", () => {
    expect(parseMoney("18.5")).toBe(18500);
    expect(parseMoney("-1")).toBeNull();
    expect(formatMoney(97000, "TND")).toBe("97.000 TND");
    expect(formatMoney(1050, "EUR")).toBe("1.05 EUR");
  });
  it("normalizes phones and slugs", () => {
    expect(normalizePhone("+216 22 345 678")).toBe(normalizePhone("22345678"));
    expect(slugify("Ceramic Harissa Bowl")).toBe("ceramic-harissa-bowl");
  });
});
