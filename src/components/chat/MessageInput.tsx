"use client";

import { ChangeEvent, ClipboardEvent, FormEvent, KeyboardEvent, useState } from "react";
import { Send, X } from "lucide-react";

interface ImageAttachment {
  url: string;
  contentType: string;
  name: string;
}

interface MessageInputProps {
  input: string;
  handleInputChange: (e: ChangeEvent<HTMLTextAreaElement>) => void;
  handleSubmit: (e: FormEvent<HTMLFormElement>, options?: { experimental_attachments?: ImageAttachment[] }) => void;
  isLoading: boolean;
}

export function MessageInput({
  input,
  handleInputChange,
  handleSubmit,
  isLoading,
}: MessageInputProps) {
  const [attachments, setAttachments] = useState<ImageAttachment[]>([]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      const form = e.currentTarget.form;
      if (form) {
        form.requestSubmit();
      }
    }
  };

  const handlePaste = (e: ClipboardEvent<HTMLTextAreaElement>) => {
    const items = Array.from(e.clipboardData?.items || []);
    const imageItems = items.filter(item => item.type.startsWith("image/"));

    if (imageItems.length > 0) {
      e.preventDefault();
      imageItems.forEach(item => {
        const file = item.getAsFile();
        if (!file) return;

        const reader = new FileReader();
        reader.onload = ev => {
          const url = ev.target?.result as string;
          setAttachments(prev => [...prev, {
            url,
            contentType: file.type,
            name: `pasted-image-${Date.now()}.png`,
          }]);
        };
        reader.readAsDataURL(file);
      });
      return;
    }

    const files = Array.from(e.clipboardData?.files || []).filter(file => file.type.startsWith("image/"));
    if (files.length > 0) {
      e.preventDefault();
      files.forEach(file => {
        const reader = new FileReader();
        reader.onload = ev => {
          const url = ev.target?.result as string;
          setAttachments(prev => [...prev, {
            url,
            contentType: file.type,
            name: `pasted-image-${Date.now()}.png`,
          }]);
        };
        reader.readAsDataURL(file);
      });
      return;
    }

    const html = e.clipboardData?.getData("text/html");
    if (html) {
      const match = html.match(/<img[^>]+src=["']([^"']+)["']/i);
      if (match?.[1]) {
        const src = match[1];
        if (src.startsWith("data:image")) {
          e.preventDefault();
          setAttachments(prev => [...prev, {
            url: src,
            contentType: src.substring(5, src.indexOf(";base64")),
            name: `pasted-image-${Date.now()}.png`,
          }]);
          return;
        }

        if (src.startsWith("http") || src.startsWith("//")) {
          e.preventDefault();
          const imageUrl = src.startsWith("//") ? `${window.location.protocol}${src}` : src;
          fetch(imageUrl)
            .then(res => res.blob())
            .then(blob => {
              const reader = new FileReader();
              reader.onload = ev => {
                const url = ev.target?.result as string;
                setAttachments(prev => [...prev, {
                  url,
                  contentType: blob.type,
                  name: `pasted-image-${Date.now()}.png`,
                }]);
              };
              reader.readAsDataURL(blob);
            })
            .catch(() => {
              // Could not fetch remote image; fall back to normal paste.
            });
        }
      }
    }
  };

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    handleSubmit(e, attachments.length > 0 ? { experimental_attachments: attachments } : undefined);
    setAttachments([]);
  };

  const canSubmit = !isLoading && ((input ?? "").trim().length > 0 || attachments.length > 0);

  return (
    <form onSubmit={onSubmit} className="relative p-4 bg-white border-t border-neutral-200/60">
      <div className="relative max-w-4xl mx-auto">
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2">
            {attachments.map((attachment, index) => (
              <div key={index} className="relative group">
                <img
                  src={attachment.url}
                  alt="pasted"
                  className="h-16 w-16 object-cover rounded-lg border border-neutral-200 shadow-sm"
                />
                <button
                  type="button"
                  onClick={() => setAttachments(prev => prev.filter((_, i) => i !== index))}
                  className="absolute -top-1.5 -right-1.5 p-0.5 bg-neutral-800 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="h-3 w-3 text-white" />
                </button>
              </div>
            ))}
          </div>
        )}
        <textarea
          value={input ?? ""}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          placeholder="Describe the React component you want to create..."
          disabled={isLoading}
          className="w-full min-h-[80px] max-h-[200px] pl-4 pr-14 py-3.5 rounded-xl border border-neutral-200 bg-neutral-50/50 text-neutral-900 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500/50 focus:bg-white transition-all placeholder:text-neutral-400 text-[15px] font-normal shadow-sm"
          rows={3}
        />
        <button
          type="submit"
          disabled={!canSubmit}
          className="absolute right-3 bottom-3 p-2.5 rounded-lg transition-all hover:bg-blue-50 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent group"
        >
          <Send className={`h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 ${canSubmit ? 'text-blue-600' : 'text-neutral-300'}`} />
        </button>
      </div>
    </form>
  );
}
