import { test, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { getToolCallLabel, ToolCallBadge } from "../ToolCallBadge";

afterEach(() => {
  cleanup();
});

// --- getToolCallLabel ---

test("str_replace_editor create returns Creating label", () => {
  expect(
    getToolCallLabel("str_replace_editor", { command: "create", path: "components/Button.tsx" })
  ).toBe("Creating Button.tsx");
});

test("str_replace_editor str_replace returns Editing label", () => {
  expect(
    getToolCallLabel("str_replace_editor", { command: "str_replace", path: "components/Card.tsx" })
  ).toBe("Editing Card.tsx");
});

test("str_replace_editor insert returns Editing label", () => {
  expect(
    getToolCallLabel("str_replace_editor", { command: "insert", path: "App.tsx" })
  ).toBe("Editing App.tsx");
});

test("str_replace_editor view returns Reading label", () => {
  expect(
    getToolCallLabel("str_replace_editor", { command: "view", path: "utils/helpers.ts" })
  ).toBe("Reading helpers.ts");
});

test("str_replace_editor unknown command falls back to Editing", () => {
  expect(
    getToolCallLabel("str_replace_editor", { command: "undo_edit", path: "index.tsx" })
  ).toBe("Editing index.tsx");
});

test("file_manager rename returns Renaming label with arrow", () => {
  expect(
    getToolCallLabel("file_manager", {
      command: "rename",
      path: "components/Old.tsx",
      new_path: "components/New.tsx",
    })
  ).toBe("Renaming Old.tsx → New.tsx");
});

test("file_manager delete returns Deleting label", () => {
  expect(
    getToolCallLabel("file_manager", { command: "delete", path: "components/Unused.tsx" })
  ).toBe("Deleting Unused.tsx");
});

test("unknown tool name falls back to tool name", () => {
  expect(getToolCallLabel("some_other_tool", {})).toBe("some_other_tool");
});

test("extracts filename from nested path", () => {
  expect(
    getToolCallLabel("str_replace_editor", {
      command: "create",
      path: "src/components/ui/Badge.tsx",
    })
  ).toBe("Creating Badge.tsx");
});

// --- ToolCallBadge rendering ---

test("renders the label text", () => {
  render(
    <ToolCallBadge
      toolName="str_replace_editor"
      args={{ command: "create", path: "Button.tsx" }}
      state="call"
    />
  );
  expect(screen.getByText("Creating Button.tsx")).toBeDefined();
});

test("shows spinner when state is call", () => {
  render(
    <ToolCallBadge
      toolName="str_replace_editor"
      args={{ command: "create", path: "Button.tsx" }}
      state="call"
    />
  );
  expect(screen.getByTestId("tool-spinner")).toBeDefined();
  expect(screen.queryByTestId("tool-done")).toBeNull();
});

test("shows spinner when state is partial-call", () => {
  render(
    <ToolCallBadge
      toolName="str_replace_editor"
      args={{ command: "create", path: "Button.tsx" }}
      state="partial-call"
    />
  );
  expect(screen.getByTestId("tool-spinner")).toBeDefined();
  expect(screen.queryByTestId("tool-done")).toBeNull();
});

test("shows spinner when state is result but result is undefined", () => {
  render(
    <ToolCallBadge
      toolName="str_replace_editor"
      args={{ command: "create", path: "Button.tsx" }}
      state="result"
      result={undefined}
    />
  );
  expect(screen.getByTestId("tool-spinner")).toBeDefined();
  expect(screen.queryByTestId("tool-done")).toBeNull();
});

test("shows done indicator when state is result with a result", () => {
  render(
    <ToolCallBadge
      toolName="str_replace_editor"
      args={{ command: "create", path: "Button.tsx" }}
      state="result"
      result="ok"
    />
  );
  expect(screen.getByTestId("tool-done")).toBeDefined();
  expect(screen.queryByTestId("tool-spinner")).toBeNull();
});

test("renders file_manager rename label", () => {
  render(
    <ToolCallBadge
      toolName="file_manager"
      args={{ command: "rename", path: "Old.tsx", new_path: "New.tsx" }}
      state="result"
      result={{ success: true }}
    />
  );
  expect(screen.getByText("Renaming Old.tsx → New.tsx")).toBeDefined();
  expect(screen.getByTestId("tool-done")).toBeDefined();
});
