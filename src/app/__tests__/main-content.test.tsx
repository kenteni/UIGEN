import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MainContent } from "../main-content";

// Mock AI SDK
vi.mock("@ai-sdk/react", () => ({
  useChat: vi.fn(() => ({
    messages: [],
    input: "",
    handleInputChange: vi.fn(),
    handleSubmit: vi.fn(),
    status: "idle",
  })),
}));

// Mock anon work tracker
vi.mock("@/lib/anon-work-tracker", () => ({
  setHasAnonWork: vi.fn(),
  getHasAnonWork: vi.fn(() => false),
}));

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: vi.fn(() => ({ push: vi.fn() })),
}));

// Mock server actions
vi.mock("@/actions", () => ({
  signOut: vi.fn(),
  getUser: vi.fn(),
}));
vi.mock("@/actions/get-projects", () => ({
  getProjects: vi.fn(() => Promise.resolve([])),
}));
vi.mock("@/actions/create-project", () => ({
  createProject: vi.fn(),
}));

// Mock resizable panels with simple pass-through wrappers
vi.mock("@/components/ui/resizable", () => ({
  ResizablePanelGroup: ({ children }: any) => (
    <div data-testid="resizable-group">{children}</div>
  ),
  ResizablePanel: ({ children }: any) => (
    <div data-testid="resizable-panel">{children}</div>
  ),
  ResizableHandle: () => <div data-testid="resizable-handle" />,
}));

// Mock child content components
vi.mock("@/components/chat/ChatInterface", () => ({
  ChatInterface: () => <div data-testid="chat-interface">Chat</div>,
}));
vi.mock("@/components/editor/FileTree", () => ({
  FileTree: () => <div data-testid="file-tree">FileTree</div>,
}));
vi.mock("@/components/editor/CodeEditor", () => ({
  CodeEditor: () => <div data-testid="code-editor">CodeEditor</div>,
}));
vi.mock("@/components/preview/PreviewFrame", () => ({
  PreviewFrame: () => <div data-testid="preview-frame">Preview</div>,
}));
vi.mock("@/components/HeaderActions", () => ({
  HeaderActions: () => <div data-testid="header-actions" />,
}));

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
});

describe("MainContent tab toggle", () => {
  test("renders with Preview tab active by default", () => {
    render(<MainContent />);

    expect(screen.getByRole("tab", { name: "Preview" })).toHaveAttribute(
      "data-state",
      "active"
    );
    expect(screen.getByRole("tab", { name: "Code" })).toHaveAttribute(
      "data-state",
      "inactive"
    );
  });

  test("shows PreviewFrame when Preview tab is active", () => {
    render(<MainContent />);

    expect(screen.getByTestId("preview-frame")).toBeDefined();
    expect(screen.queryByTestId("code-editor")).toBeNull();
  });

  test("switches to Code view when Code tab is clicked", async () => {
    const user = userEvent.setup();
    render(<MainContent />);

    await user.click(screen.getByRole("tab", { name: "Code" }));

    expect(screen.getByRole("tab", { name: "Code" })).toHaveAttribute(
      "data-state",
      "active"
    );
    expect(screen.getByRole("tab", { name: "Preview" })).toHaveAttribute(
      "data-state",
      "inactive"
    );
    expect(screen.getByTestId("code-editor")).toBeDefined();
    expect(screen.queryByTestId("preview-frame")).toBeNull();
  });

  test("switches back to Preview view when Preview tab is clicked after Code", async () => {
    const user = userEvent.setup();
    render(<MainContent />);

    // Switch to Code
    await user.click(screen.getByRole("tab", { name: "Code" }));
    expect(screen.queryByTestId("preview-frame")).toBeNull();

    // Switch back to Preview
    await user.click(screen.getByRole("tab", { name: "Preview" }));

    expect(screen.getByRole("tab", { name: "Preview" })).toHaveAttribute(
      "data-state",
      "active"
    );
    expect(screen.getByTestId("preview-frame")).toBeDefined();
    expect(screen.queryByTestId("code-editor")).toBeNull();
  });

  test("shows FileTree alongside CodeEditor in Code view", async () => {
    const user = userEvent.setup();
    render(<MainContent />);

    await user.click(screen.getByRole("tab", { name: "Code" }));

    expect(screen.getByTestId("file-tree")).toBeDefined();
    expect(screen.getByTestId("code-editor")).toBeDefined();
  });

  test("renders ChatInterface regardless of active tab", async () => {
    const user = userEvent.setup();
    render(<MainContent />);

    expect(screen.getByTestId("chat-interface")).toBeDefined();

    await user.click(screen.getByRole("tab", { name: "Code" }));

    expect(screen.getByTestId("chat-interface")).toBeDefined();
  });

  test("clicking the already-active tab does not change the view", async () => {
    const user = userEvent.setup();
    render(<MainContent />);

    // Preview is already active; click it again
    await user.click(screen.getByRole("tab", { name: "Preview" }));

    expect(screen.getByRole("tab", { name: "Preview" })).toHaveAttribute(
      "data-state",
      "active"
    );
    expect(screen.getByTestId("preview-frame")).toBeDefined();
  });
});
