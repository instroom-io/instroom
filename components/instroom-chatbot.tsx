"use client";

import { useState } from "react";
import { IconMessageCircle, IconX, IconSend } from "@tabler/icons-react";

type Message = {
  role: "user" | "bot";
  text: string;
};

export default function InstroomChatbot() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const [messages, setMessages] = useState<Message[]>([
    {
      role: "bot",
      text: "Hello 👋 I am the Instroom assistant. Ask anything about influencers or discovery.",
    },
  ]);

  async function sendMessage() {
    if (!input.trim()) return;

    const userMessage: Message = { role: "user", text: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    try {
      // Call your secure backend API route instead of Cohere directly
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: [
            ...messages.map((m) => ({
              role: m.role === "user" ? "user" : "assistant",
              content: m.text,
            })),
            {
              role: "user",
              content: input,
            },
          ],
        }),
      });

      const data = await response.json();

      // Handle Cohere v2 API response structure
      let botText = "No response received.";
      
      if (data.message?.content) {
        // For text responses
        if (Array.isArray(data.message.content)) {
          const textContent = data.message.content.find(
            (item: any) => item.type === "text"
          );
          botText = textContent?.text || botText;
        } else if (typeof data.message.content === "string") {
          botText = data.message.content;
        }
      }

      const botReply: Message = {
        role: "bot",
        text: botText,
      };

      setMessages((prev) => [...prev, botReply]);
    } catch (error) {
      console.error("Chat error:", error);
      setMessages((prev) => [
        ...prev,
        { role: "bot", text: "Error contacting AI service. Please try again." },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 bg-[#1FAE5B] text-white p-4 rounded-full shadow-lg hover:scale-105 transition"
          aria-label="Open chat"
        >
          <IconMessageCircle size={24} />
        </button>
      )}

      {open && (
        <div className="fixed bottom-6 right-6 w-[360px] h-[480px] bg-white rounded-xl shadow-2xl flex flex-col border">
          <div className="bg-[#0F6B3E] text-white p-4 flex justify-between items-center rounded-t-xl">
            <span className="font-semibold">Instroom Assistant</span>
            <button 
              onClick={() => setOpen(false)}
              aria-label="Close chat"
            >
              <IconX size={20} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#F7F9F8]">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${
                  msg.role === "user" ? "justify-end" : "justify-start"
                }`}
              >
                <div
                  className={`px-3 py-2 rounded-lg text-sm max-w-[75%] ${
                    msg.role === "user"
                      ? "bg-[#1FAE5B] text-white"
                      : "bg-white border"
                  }`}
                >
                  {msg.text}
                </div>
              </div>
            ))}

            {loading && (
              <div className="text-sm text-gray-500 animate-pulse">
                AI is typing...
              </div>
            )}
          </div>

          <div className="border-t p-3 flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask something..."
              className="flex-1 border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#1FAE5B] focus:border-transparent"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              disabled={loading}
            />
            <button
              onClick={sendMessage}
              disabled={loading || !input.trim()}
              className="bg-[#1FAE5B] text-white p-2 rounded-lg hover:bg-[#0F6B3E] transition disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Send message"
            >
              <IconSend size={18} />
            </button>
          </div>
        </div>
      )}
    </>
  );
}