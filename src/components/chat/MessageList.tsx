"use client";

import { UIMessage } from "ai";
import { cn } from "@/lib/utils";
import { User, Bot } from "lucide-react";
import { MarkdownRenderer } from "./MarkdownRenderer";
import { ToolCallBadge } from "./ToolCallBadge";

interface MessageListProps {
  messages: UIMessage[];
  isLoading?: boolean;
}

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1 py-0.5">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="w-1.5 h-1.5 rounded-full bg-neutral-400 animate-bounce"
          style={{ animationDelay: `${i * 150}ms`, animationDuration: "900ms" }}
        />
      ))}
    </div>
  );
}

export function MessageList({ messages, isLoading }: MessageListProps) {
  return (
    <div className="flex flex-col h-full overflow-y-auto px-4 py-6">
      <div className="space-y-5 max-w-4xl mx-auto w-full">
        {messages.map((message, messageIndex) => {
          const msgAny = message as any;
          return (
            <div
              key={message.id ?? messageIndex}
              className={cn(
                "flex items-end gap-3",
                message.role === "user" ? "justify-end" : "justify-start"
              )}
            >
              {message.role === "assistant" && (
                <div className="flex-shrink-0 mb-0.5">
                  <div className="w-8 h-8 rounded-full bg-neutral-900 flex items-center justify-center">
                    <Bot className="h-4 w-4 text-white" />
                  </div>
                </div>
              )}

              <div className={cn(
                "flex flex-col gap-2 max-w-[80%]",
                message.role === "user" ? "items-end" : "items-start"
              )}>
                {message.role === "user" && msgAny.experimental_attachments && msgAny.experimental_attachments.length > 0 && (
                  <div className="flex flex-wrap gap-2 justify-end">
                    {msgAny.experimental_attachments
                      .filter((a: any) => a.contentType?.startsWith("image/"))
                      .map((attachment: any, i: number) => (
                        <img
                          key={i}
                          src={attachment.url}
                          alt={attachment.name ?? "attached image"}
                          className="max-h-52 max-w-xs rounded-2xl border border-neutral-200 object-cover"
                        />
                      ))}
                  </div>
                )}
                <div className={cn(
                  "rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
                  message.role === "user"
                    ? "bg-blue-600 text-white rounded-br-sm"
                    : "bg-white text-neutral-900 border border-neutral-200 rounded-bl-sm shadow-xs"
                )}>
                  {message.parts && message.parts.length > 0 ? (
                    <>
                      {message.parts.map((part, partIndex) => {
                        if (part.type === "text") {
                          return message.role === "user" ? (
                            <span key={partIndex} className="whitespace-pre-wrap">{part.text}</span>
                          ) : (
                            <MarkdownRenderer
                              key={partIndex}
                              content={part.text}
                              className="prose-sm"
                            />
                          );
                        }

                        if (part.type === "reasoning") {
                          return (
                            <div key={partIndex} className="mt-3 p-3 bg-neutral-50 rounded-lg border border-neutral-200">
                              <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wide block mb-1.5">Reasoning</span>
                              <span className="text-sm text-neutral-600 leading-relaxed">{part.text}</span>
                            </div>
                          );
                        }

                        if (part.type === "dynamic-tool") {
                          const stateMap: Record<string, "partial-call" | "call" | "result"> = {
                            "input-streaming": "partial-call",
                            "input-available": "call",
                            "output-available": "result",
                            "output-error": "result",
                          };
                          return (
                            <ToolCallBadge
                              key={partIndex}
                              toolName={part.toolName}
                              args={(part as any).input ?? {}}
                              state={stateMap[part.state] ?? "call"}
                              result={part.state === "output-available" ? (part as any).output : undefined}
                            />
                          );
                        }

                        if (part.type === "step-start") {
                          return partIndex > 0 ? <hr key={partIndex} className="my-3 border-neutral-100" /> : null;
                        }

                        return null;
                      })}
                      {isLoading &&
                        message.role === "assistant" &&
                        messages.indexOf(message) === messages.length - 1 && (
                          <div className="mt-2">
                            <TypingIndicator />
                          </div>
                        )}
                    </>
                  ) : msgAny.content ? (
                    message.role === "user" ? (
                      <span className="whitespace-pre-wrap">{msgAny.content}</span>
                    ) : (
                      <MarkdownRenderer content={msgAny.content} className="prose-sm" />
                    )
                  ) : isLoading &&
                    message.role === "assistant" &&
                    messages.indexOf(message) === messages.length - 1 ? (
                    <TypingIndicator />
                  ) : null}
                </div>
              </div>

              {message.role === "user" && (
                <div className="flex-shrink-0 mb-0.5">
                  <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center">
                    <User className="h-4 w-4 text-white" />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
