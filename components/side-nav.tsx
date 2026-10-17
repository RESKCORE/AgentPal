"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from "next/image";
import { UserButton, useUser } from "@clerk/nextjs";
import { Home, Receipt, Bell, Settings, PanelLeftClose, PanelLeftOpen, Compass } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { title: "Dashboard", href: "/", icon: Home },
  { title: "Overview", href: "/overview", icon: Compass },
  { title: "Transactions", href: "/transactions", icon: Receipt },
  { title: "Notifications", href: "/notifications", icon: Bell },
  { title: "Settings", href: "/settings", icon: Settings },
];

const HIDDEN_ON = ["/sign-in", "/onboarding", "/overview"];

export function SideNav() {
  const pathname = usePathname();
  const { isSignedIn } = useUser();
  const [open, setOpen] = useState(true);
  const [isGuest, setIsGuest] = useState(() => {
    if (typeof window !== "undefined") {
      return (
        window.localStorage.getItem("agentpal_guest_mode") === "true" ||
        new URLSearchParams(window.location.search).get("guest") === "true"
      );
    }
    return false;
  });

  useEffect(() => {
    if (typeof window !== "undefined") {
      const isGuestQuery = new URLSearchParams(window.location.search).get("guest") === "true";
      const stored = window.localStorage.getItem("agentpal_guest_mode") === "true";
      if (isGuestQuery || stored) setIsGuest(true);
    }
  }, [pathname]);

  if (HIDDEN_ON.some((p) => pathname.startsWith(p))) return null;
  if (pathname === "/" && !isSignedIn && !isGuest) return null;

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  return (
    <nav
      aria-label="Main Navigation"
      className={cn(
        "sticky top-0 flex h-screen shrink-0 flex-col border-r border-zinc-200 bg-white/90 backdrop-blur-2xl transition-[width] duration-300 z-30 text-zinc-700 shadow-[2px_0_8px_rgba(0,0,0,0.05)]",
        open ? "w-60" : "w-18"
      )}
    >
      {/* Brand Header */}
      <div className="flex items-center justify-between p-3.5 border-b border-zinc-200">
        <Link href="/" className="flex items-center gap-3 overflow-hidden group">
          {/* Pure PNG logo without any border or background wrapper */}
          <Image
            src="/logo.png"
            alt="AgentPal Logo"
            width={36}
            height={36}
            className="h-8 w-auto object-contain shrink-0 transition-transform duration-200 group-hover:scale-105"
            priority
          />
          {open && (
            <div className="flex flex-col min-w-0">
              <span className="font-extrabold text-zinc-900 tracking-tight text-base font-outfit leading-tight">
                AgentPal
              </span>
              <span className="text-[8px] font-mono uppercase tracking-[0.22em] text-zinc-500 font-semibold">
                AI Negotiation
              </span>
            </div>
          )}
        </Link>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? "Collapse navigation" : "Expand navigation"}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-zinc-600 hover:bg-zinc-200 hover:text-zinc-900 transition-colors"
        >
          {open ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
        </button>
      </div>

      {/* Nav Items */}
      <div className="flex flex-col gap-1.5 p-3 flex-1">
        {items.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.title}
              href={item.href}
              aria-label={item.title}
              title={item.title}
              className={cn(
                "relative flex h-10 items-center gap-3 rounded-xl px-3 text-xs font-semibold tracking-wide transition-all duration-200",
                active
                  ? "bg-zinc-200 text-zinc-900 shadow-[0_2px_12px_rgba(0,0,0,0.4)] border border-zinc-300"
                  : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900",
                !open && "justify-center px-0"
              )}
            >
              <item.icon className={cn("h-4 w-4 shrink-0", active ? "text-blue-600" : "text-zinc-500")} />
              {open && <span className="truncate">{item.title}</span>}
              {active && open && (
                <span className="ml-auto flex h-1.5 w-1.5 rounded-full bg-blue-400 shadow-[0_0_8px_#38bdf8]" />
              )}
            </Link>
          );
        })}
      </div>

      {/* User Session */}
      {open ? (
        <div className="px-3 pb-2 pt-2 border-t border-zinc-200">
          <div className="flex items-center gap-2.5 py-1.5 px-2 rounded-xl bg-zinc-50 border border-zinc-200">
            <UserButton />
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-bold text-zinc-900 truncate">Account</span>
              <span className="text-[10px] text-zinc-500 font-mono truncate">Clerk Session</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="p-2 border-t border-zinc-200 flex justify-center">
          <UserButton />
        </div>
      )}

      {/* Bottom Status Capsule */}
      {open ? (
        <div className="p-3 border-t border-zinc-200">
          <div className="glass-panel-dark rounded-xl p-2.5 flex items-center gap-2.5 text-[11px] font-mono text-zinc-600 border border-zinc-200">
            <span className="relative flex h-2 w-2 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500 shadow-[0_0_8px_#34d399]" />
            </span>
            <div className="flex flex-col leading-tight overflow-hidden">
              <span className="font-bold text-zinc-900 truncate">Kernel Protected</span>
              <span className="text-[9px] text-zinc-500 truncate">PayPal Sandbox</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="p-2 border-t border-zinc-200 flex justify-center">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500 shadow-[0_0_8px_#34d399]" />
          </span>
        </div>
      )}
    </nav>
  );
}
