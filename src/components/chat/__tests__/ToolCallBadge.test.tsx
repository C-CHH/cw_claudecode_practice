import { test, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import type { ToolInvocation } from "ai";
import { ToolCallBadge } from "../ToolCallBadge";

afterEach(() => {
  cleanup();
});

function makeToolInvocation(
  toolName: string,
  args: Record<string, unknown>,
  state: "partial-call" | "call" | "result" = "call",
  result?: unknown
): ToolInvocation {
  if (state === "result") {
    return { toolCallId: "test-id", toolName, args, state, result };
  }
  return { toolCallId: "test-id", toolName, args, state };
}

test("shows 'Creating' label for str_replace_editor create command", () => {
  render(<ToolCallBadge toolInvocation={makeToolInvocation("str_replace_editor", { command: "create", path: "/Card.jsx" })} />);
  expect(screen.getByText("Creating Card.jsx")).toBeDefined();
});

test("shows 'Editing' label for str_replace_editor str_replace command", () => {
  render(<ToolCallBadge toolInvocation={makeToolInvocation("str_replace_editor", { command: "str_replace", path: "/App.jsx" })} />);
  expect(screen.getByText("Editing App.jsx")).toBeDefined();
});

test("shows 'Editing' label for str_replace_editor insert command", () => {
  render(<ToolCallBadge toolInvocation={makeToolInvocation("str_replace_editor", { command: "insert", path: "/App.jsx" })} />);
  expect(screen.getByText("Editing App.jsx")).toBeDefined();
});

test("shows 'Reading' label for str_replace_editor view command", () => {
  render(<ToolCallBadge toolInvocation={makeToolInvocation("str_replace_editor", { command: "view", path: "/App.jsx" })} />);
  expect(screen.getByText("Reading App.jsx")).toBeDefined();
});

test("shows 'Undoing edit in' label for str_replace_editor undo_edit command", () => {
  render(<ToolCallBadge toolInvocation={makeToolInvocation("str_replace_editor", { command: "undo_edit", path: "/App.jsx" })} />);
  expect(screen.getByText("Undoing edit in App.jsx")).toBeDefined();
});

test("shows 'Renaming' label for file_manager rename command", () => {
  render(<ToolCallBadge toolInvocation={makeToolInvocation("file_manager", { command: "rename", path: "/Card.jsx", new_path: "/NewCard.jsx" })} />);
  expect(screen.getByText("Renaming Card.jsx")).toBeDefined();
});

test("shows 'Deleting' label for file_manager delete command", () => {
  render(<ToolCallBadge toolInvocation={makeToolInvocation("file_manager", { command: "delete", path: "/Card.jsx" })} />);
  expect(screen.getByText("Deleting Card.jsx")).toBeDefined();
});

test("extracts basename from nested path", () => {
  render(<ToolCallBadge toolInvocation={makeToolInvocation("str_replace_editor", { command: "view", path: "/components/ui/Button.jsx" })} />);
  expect(screen.getByText("Reading Button.jsx")).toBeDefined();
});

test("shows spinner when state is call", () => {
  const { container } = render(<ToolCallBadge toolInvocation={makeToolInvocation("str_replace_editor", { command: "create", path: "/App.jsx" }, "call")} />);
  expect(container.querySelector("svg")).toBeDefined();
  expect(container.querySelector(".bg-emerald-500")).toBeNull();
});

test("shows spinner when state is partial-call", () => {
  const { container } = render(<ToolCallBadge toolInvocation={makeToolInvocation("str_replace_editor", { command: "create", path: "/App.jsx" }, "partial-call")} />);
  expect(container.querySelector("svg")).toBeDefined();
  expect(container.querySelector(".bg-emerald-500")).toBeNull();
});

test("shows green dot when state is result with result", () => {
  const { container } = render(<ToolCallBadge toolInvocation={makeToolInvocation("str_replace_editor", { command: "create", path: "/App.jsx" }, "result", "Success")} />);
  expect(container.querySelector(".bg-emerald-500")).toBeDefined();
  expect(container.querySelector("svg")).toBeNull();
});

test("falls back to raw tool name for unknown tool", () => {
  render(<ToolCallBadge toolInvocation={makeToolInvocation("unknown_tool", { command: "do_something", path: "/file.js" })} />);
  expect(screen.getByText("unknown_tool")).toBeDefined();
});

test("falls back to raw tool name for unknown command on known tool", () => {
  render(<ToolCallBadge toolInvocation={makeToolInvocation("str_replace_editor", { command: "unknown_cmd", path: "/App.jsx" })} />);
  expect(screen.getByText("str_replace_editor")).toBeDefined();
});
