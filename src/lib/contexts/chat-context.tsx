"use client";

import {
  createContext,
  useContext,
  ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";
import { useChat as useAIChat } from "@ai-sdk/react";
import { DefaultChatTransport, UIMessage } from "ai";
import { useFileSystem } from "./file-system-context";
import { setHasAnonWork } from "@/lib/anon-work-tracker";

interface ChatContextProps {
  projectId?: string;
  initialMessages?: UIMessage[];
}

interface ImageAttachment {
  name?: string;
  contentType?: string;
  url: string;
}

interface ChatContextType {
  messages: UIMessage[];
  input: string;
  handleInputChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  handleSubmit: (e: React.FormEvent<HTMLFormElement>, options?: { experimental_attachments?: ImageAttachment[] }) => void;
  status: string;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export function ChatProvider({
  children,
  projectId,
  initialMessages = [],
}: ChatContextProps & { children: ReactNode }) {
  const { fileSystem, handleToolCall } = useFileSystem();
  const [input, setInput] = useState("");

  const fileSystemRef = useRef(fileSystem);
  const projectIdRef = useRef(projectId);
  useEffect(() => { fileSystemRef.current = fileSystem; });
  useEffect(() => { projectIdRef.current = projectId; });

  const transportRef = useRef<DefaultChatTransport<UIMessage> | null>(null);
  if (!transportRef.current) {
    transportRef.current = new DefaultChatTransport<UIMessage>({
      api: "/api/chat",
      prepareSendMessagesRequest: ({ id, messages, trigger, messageId, body }) => ({
        body: {
          id,
          messages,
          trigger,
          messageId,
          ...body,
          files: fileSystemRef.current.serialize(),
          projectId: projectIdRef.current,
        },
      }),
    });
  }

  const { messages, status, sendMessage } = useAIChat({
    messages: initialMessages,
    transport: transportRef.current,
    onToolCall: ({ toolCall }) => {
      handleToolCall(toolCall as any);
    },
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
  };

  const handleSubmit = (
    e: React.FormEvent<HTMLFormElement>,
    options?: { experimental_attachments?: ImageAttachment[] }
  ) => {
    e.preventDefault();
    if (!input.trim() && !options?.experimental_attachments?.length) return;
    sendMessage({ text: input });
    setInput("");
  };

  useEffect(() => {
    if (!projectId && messages.length > 0) {
      setHasAnonWork(messages, fileSystem.serialize());
    }
  }, [messages, fileSystem, projectId]);

  return (
    <ChatContext.Provider
      value={{
        messages,
        input,
        handleInputChange,
        handleSubmit,
        status,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
}

export function useChat() {
  const context = useContext(ChatContext);
  if (context === undefined) {
    throw new Error("useChat must be used within a ChatProvider");
  }
  return context;
}
