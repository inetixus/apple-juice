import { describe, it, expect, afterEach } from "vitest";
import { isAdmin } from "./admin";

const ORIGINAL = process.env.ADMIN_USER_IDS;

afterEach(() => {
  process.env.ADMIN_USER_IDS = ORIGINAL;
});

describe("isAdmin", () => {
  it("returns false when ADMIN_USER_IDS is empty/unset", () => {
    process.env.ADMIN_USER_IDS = "";
    expect(isAdmin("123")).toBe(false);
    delete process.env.ADMIN_USER_IDS;
    expect(isAdmin("123")).toBe(false);
  });

  it("matches an exact id in a comma list (with spaces)", () => {
    process.env.ADMIN_USER_IDS = "111, 222 , 333";
    expect(isAdmin("222")).toBe(true);
    expect(isAdmin("333")).toBe(true);
    expect(isAdmin("444")).toBe(false);
  });

  it("returns false for empty/undefined/null userId", () => {
    process.env.ADMIN_USER_IDS = "111";
    expect(isAdmin("")).toBe(false);
    expect(isAdmin(undefined)).toBe(false);
    expect(isAdmin(null)).toBe(false);
  });

  it("does not partial-match", () => {
    process.env.ADMIN_USER_IDS = "1234";
    expect(isAdmin("123")).toBe(false);
    expect(isAdmin("12345")).toBe(false);
    expect(isAdmin("1234")).toBe(true);
  });
});
