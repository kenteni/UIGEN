import { test, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { ToolCallBadge, getToolCallLabel } from "../ToolCallBadge";
import type { ToolInvocation } from "ai";

afterEach(() => {
  cleanup();
});

// --- getToolCallLabel ---

test("getToolCallLabel: str_replace_editor create", () => {
  expect(getToolCallLabel("str_replace_editor", { command: "create", path: "/App.jsx" })).toBe("Creating App.jsx");
});

test("getToolCallLabel: str_replace_editor str_replace", () => {
  expect(getToolCallLabel("str_replace_editor", { command: "str_replace", path: "/components/Button.jsx" })).toBe("Editing Button.jsx");
});

test("getToolCallLabel: str_replace_editor insert", () => {
  expect(getToolCallLabel("str_replace_editor", { command: "insert", path: "/lib/utils.ts" })).toBe("Editing utils.ts");
});

test("getToolCallLabel: str_replace_editor view", () => {
  expect(getToolCallLabel("str_replace_editor", { command: "view", path: "/App.jsx" })).toBe("Viewing App.jsx");
});

test("getToolCallLabel: file_manager rename", () => {
  expect(getToolCallLabel("file_manager", { command: "rename", path: "/old.jsx" })).toBe("Renaming old.jsx");
});

test("getToolCallLabel: file_manager delete", () => {
  expect(getToolCallLabel("file_manager", { command: "delete", path: "/temp.jsx" })).toBe("Deleting temp.jsx");
});

test("getToolCallLabel: unknown tool falls back to tool name", () => {
  expect(getToolCallLabel("some_other_tool", { command: "create" })).toBe("some_other_tool");
});

test("getToolCallLabel: missing path omits filename", () => {
  expect(getToolCallLabel("str_replace_editor", { command: "create" })).toBe("Creating file");
});

// --- ToolCallBadge rendering ---

function makeInvocation(overrides: Partial<ToolInvocation>): ToolInvocation {
  return {
    toolCallId: "test-id",
    toolName: "str_replace_editor",
    args: { command: "create", path: "/App.jsx" },
    state: "call",
    ...overrides,
  } as ToolInvocation;
}

test("ToolCallBadge shows label text", () => {
  render(<ToolCallBadge toolInvocation={makeInvocation({})} />);
  expect(screen.getByText("Creating App.jsx")).toBeDefined();
});

test("ToolCallBadge shows spinner when state is call", () => {
  const { container } = render(<ToolCallBadge toolInvocation={makeInvocation({ state: "call" })} />);
  expect(container.querySelector(".animate-spin")).toBeDefined();
  expect(container.querySelector(".bg-emerald-500")).toBeNull();
});

test("ToolCallBadge shows green dot when state is result", () => {
  const { container } = render(
    <ToolCallBadge toolInvocation={makeInvocation({ state: "result", result: "ok" } as Partial<ToolInvocation>)} />
  );
  expect(container.querySelector(".bg-emerald-500")).toBeDefined();
  expect(container.querySelector(".animate-spin")).toBeNull();
});

test("ToolCallBadge shows spinner when result is null", () => {
  const { container } = render(
    <ToolCallBadge toolInvocation={makeInvocation({ state: "result", result: null } as Partial<ToolInvocation>)} />
  );
  expect(container.querySelector(".animate-spin")).toBeDefined();
});
