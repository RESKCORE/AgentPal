"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from "next/image";
import { Home, Plus, Handshake, Receipt, Bell, Settings, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { title: "Dashboard", href: "/", icon: Home },
  { title: "Deals", href: "/#deals", match: "/deals", icon: Handshake },
  { title: "New deal", href: "/deals/new", icon: Plus },
  { title: "Transactions", href: "/transactions", icon: Receipt },
  { title: "Notifications", href: "/notifications", icon: Bell },
  { title: "Settings", href: "/settings", icon: Settings },
];

const HIDDEN_ON = ["/sign-in", "/onboarding"];

export function SideNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(true);
  if (HIDDEN_ON.some((p) => pathname.startsWith(p))) return null;

  const isActive = (href: string, match?: string) => {
    if (match) return pathname.startsWith(match) && pathname !== "/deals/new";
    return pathname === href;
  };

  return (
    <nav
      aria-label="Main Navigation"
      className={cn(
        "sticky top-0 flex h-screen shrink-0 flex-col border-r border-slate-200 bg-white transition-[width] duration-200",
        open ? "w-56" : "w-16"
      )}
    >
      <div className="flex items-center justify-between p-3 border-b border-slate-100">
        <Link href="/" className="flex items-center gap-2.5 overflow-hidden group">
          <Image
            src="/logo.png"
            alt="AgentPal Logo"
            width={32}
            height={32}
            className="h-8 w-8 shrink-0 rounded-lg object-contain bg-slate-900 p-0.5 shadow-xs"
            priority
          />
          {open && (
            <span className="font-extrabold text-slate-900 tracking-tight text-base font-sans group-hover:text-emerald-700 transition-colors">
              AgentPal
            </span>
          )}
        </Link>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? "Collapse navigation" : "Expand navigation"}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-800 transition-colors"
        >
          {open ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
        </button>
      </div>

      <div className="flex flex-col gap-1 px-2">
        {items.map((item) => {
          const active = isActive(item.href, item.match);
          return (
            <Link
              key={item.title}
              href={item.href}
              aria-label={item.title}
              title={item.title}
              className={cn(
                "flex h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors",
                active
                  ? "bg-emerald-50 text-emerald-700"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
                !open && "justify-center px-0"
              )}
            >
              <item.icon className="h-5 w-5 shrink-0" />
              {open && <span className="truncate">{item.title}</span>}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
