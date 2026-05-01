"use client";

import { Loader2 } from "lucide-react";
import type { ToolInvocation } from "ai";

export function getToolCallLabel(toolName: string, args: Record<string, unknown>): string {
  const path = typeof args?.path === "string" ? args.path : "";
  const filename = path ? path.split("/").filter(Boolean).pop() ?? "" : "";

  if (toolName === "str_replace_editor") {
    switch (args?.command) {
      case "create":     return filename ? `Creating ${filename}` : "Creating file";
      case "str_replace": return filename ? `Editing ${filename}` : "Editing file";
      case "insert":     return filename ? `Editing ${filename}` : "Editing file";
      case "view":       return filename ? `Viewing ${filename}` : "Viewing file";
      default:           return filename ? `Editing ${filename}` : toolName;
    }
  }

  if (toolName === "file_manager") {
    switch (args?.command) {
      case "rename": return filename ? `Renaming ${filename}` : "Renaming file";
      case "delete": return filename ? `Deleting ${filename}` : "Deleting file";
      default:       return toolName;
    }
  }

  return toolName;
}

interface ToolCallBadgeProps {
  toolInvocation: ToolInvocation;
}

export function ToolCallBadge({ toolInvocation }: ToolCallBadgeProps) {
  const { toolName, args, state, result } = toolInvocation as ToolInvocation & { result?: unknown };
  const label = getToolCallLabel(toolName, args as Record<string, unknown>);
  const isDone = state === "result" && result != null;

  return (
    <div className="inline-flex items-center gap-2 mt-2 px-3 py-1.5 bg-neutral-50 rounded-lg text-xs font-mono border border-neutral-200">
      {isDone ? (
        <>
          <div className="w-2 h-2 rounded-full bg-emerald-500" />
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
