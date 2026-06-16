import { describe, it, expect } from "vitest";
import {
  officialToolsToLlmTools,
  mcpResultToText,
  boundResult,
} from "./agent-loop.ts";

describe("officialToolsToLlmTools", () => {
  it("maps MCP tools/list into OpenAI function schemas", () => {
    const out = officialToolsToLlmTools({
      tools: [
        { name: "script_read", description: "read", inputSchema: { type: "object", properties: { path: { type: "string" } } } },
        { name: "execute_luau" },
      ],
    });
    expect(out).toHaveLength(2);
    expect(out[0].type).toBe("function");
    expect(out[0].function.name).toBe("script_read");
    expect(out[0].function.parameters).toEqual({ type: "object", properties: { path: { type: "string" } } });
    // Missing schema falls back to an empty object schema.
    expect(out[1].function.parameters).toEqual({ type: "object", properties: {} });
  });

  it("handles an empty/invalid list", () => {
    expect(officialToolsToLlmTools({})).toEqual([]);
    expect(officialToolsToLlmTools(null)).toEqual([]);
  });
});

describe("mcpResultToText", () => {
  it("joins text content blocks", () => {
    const text = mcpResultToText({ content: [{ type: "text", text: "line1" }, { type: "text", text: "line2" }] });
    expect(text).toBe("line1\nline2");
  });
  it("marks non-text blocks by type", () => {
    expect(mcpResultToText({ content: [{ type: "image" }] })).toBe("[image]");
  });
  it("passes through plain strings and stringifies objects", () => {
    expect(mcpResultToText("hi")).toBe("hi");
    expect(mcpResultToText({ a: 1 })).toBe('{"a":1}');
  });
});

describe("boundResult", () => {
  it("leaves short output untouched", () => {
    expect(boundResult("short")).toBe("short");
  });
  it("truncates with a notice when over the limit", () => {
    const out = boundResult("y".repeat(300), 100);
    expect(out.startsWith("y".repeat(100))).toBe(true);
    expect(out).toMatch(/TRUNCATED at 100 chars/);
    expect(out).toMatch(/300 total/);
  });
});
