"use client";

import { Bot } from "lucide-react";
import { AIChatCard } from "@/components/spectrumui/ai-chat-card";

interface AgentChatStackProps {
  buyerName?: string;
  sellerName?: string;
  onSend: (role: "buyer" | "seller", message: string) => void;
}

export function AgentChatStack({ buyerName, sellerName, onSend }: AgentChatStackProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      <AIChatCard
        title={`Buyer agent${buyerName ? ` · ${buyerName}` : ""}`}
        subtitle="Negotiates inside the sealed buyer mandate"
        greeting="Steer the buyer agent"
        prompt="Guidance is validated by the kernel and applied to the next offer."
        autoType={false}
        placeholder="e.g. Hold price, concede on delivery days…"
        icon={<Bot className="h-5 w-5 text-foreground" />}
        onSend={(message) => message.trim() && onSend("buyer", message)}
      />
      <AIChatCard
        title={`Seller agent${sellerName ? ` · ${sellerName}` : ""}`}
        subtitle="Negotiates inside the sealed seller mandate"
        greeting="Steer the seller agent"
        prompt="Guidance is validated by the kernel and applied to the next offer."
        autoType={false}
        placeholder="e.g. Push deposit up, hold revisions…"
        icon={<Bot className="h-5 w-5 text-foreground" />}
        onSend={(message) => message.trim() && onSend("seller", message)}
      />
    </div>
  );
}
