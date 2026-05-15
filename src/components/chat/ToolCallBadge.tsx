"use client";

import { ToolInvocation } from "ai";
import { Loader2 } from "lucide-react";

interface ToolCallBadgeProps {
  toolInvocation: ToolInvocation;
}

function getBasename(filePath: string): string {
  const parts = filePath.split("/").filter(Boolean);
  return parts[parts.length - 1] ?? filePath;
}

function getLabel(toolName: string, args: Record<string, unknown>): string {
  const filename = typeof args.path === "string" ? getBasename(args.path) : "";

  if (toolName === "str_replace_editor") {
    switch (args.command) {
      case "create":      return `Creating ${filename}`;
      case "str_replace": return `Editing ${filename}`;
      case "insert":      return `Editing ${filename}`;
      case "view":        return `Reading ${filename}`;
      case "undo_edit":   return `Undoing edit in ${filename}`;
      default:            return toolName;
    }
  }

  if (toolName === "file_manager") {
    switch (args.command) {
      case "rename": return `Renaming ${filename}`;
      case "delete": return `Deleting ${filename}`;
      default:       return toolName;
    }
  }

  return toolName;
}

export function ToolCallBadge({ toolInvocation: tool }: ToolCallBadgeProps) {
  const label = getLabel(tool.toolName, tool.args as Record<string, unknown>);
  const isDone = tool.state === "result" && tool.result;

  return (
    <div className="inline-flex items-center gap-2 mt-2 px-3 py-1.5 bg-neutral-50 rounded-lg text-xs font-mono border border-neutral-200">
      {isDone ? (
        <>
          <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
          <span className="text-neutral-700">{label}</span>
        </>
      ) : (
        <>
          <Loader2 className="w-3 h-3 animate-spin text-blue-600" />
          <span className="text-neutral-700">{label}</span>
        </>
      )}
    </div>
  );
}
