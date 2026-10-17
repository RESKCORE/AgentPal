"use client";

import { use, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useConvexAuth } from "convex/react";
import { useClerk } from "@clerk/nextjs";
import { api } from "@/convex/_generated/api";
import { Link2, ShieldX, Clock, Briefcase, Store } from "lucide-react";
import { MandateForm } from "@/components/deal-room/mandate-form";
import { LoginCard } from "@/components/spectrumui/logincard";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function JoinDealPage({ params }: PageProps) {
  use(params); // dealId is carried inside the invite token lookup
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const invite = useQuery(api.deals.getByInviteToken, { token });
  const joinViaMagicLink = useMutation(api.deals.joinViaMagicLink);
  const { isAuthenticated, isLoading: authLoading } = useConvexAuth();
  const { openSignIn } = useClerk();

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (m: {
    priceMin: number;
    priceMax: number;
    deliveryDaysMin: number;
    deliveryDaysMax: number;
    revisionsMin: number;
    revisionsMax: number;
    depositPctMin: number;
    depositPctMax: number;
  }) => {
    if (!invite) return;
    setError(null);
    setSubmitting(true);
    try {
      const { dealId } = await joinViaMagicLink({
        token,
        mandate: {
          role: invite.inviteeRole as "buyer" | "seller",
          price_min: m.priceMin,
          price_max: m.priceMax,
          delivery_days_min: m.deliveryDaysMin,
          delivery_days_max: m.deliveryDaysMax,
          revisions_min: m.revisionsMin,
          revisions_max: m.revisionsMax,
          deposit_pct_min: m.depositPctMin,
          deposit_pct_max: m.depositPctMax,
        },
      });
      window.localStorage.setItem(`agentpal_role_${dealId}`, invite.inviteeRole);
      router.push(`/deals/${dealId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not join this deal.");
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/70 text-slate-900 flex flex-col font-sans">
      <main className="container mx-auto px-4 sm:px-6 py-8 pb-8 max-w-3xl space-y-6 flex-1">
        {invite !== undefined && invite !== null && !authLoading && !isAuthenticated ? (
          <div className="flex flex-col items-center gap-4 py-8">
            <p className="text-sm text-slate-600 text-center max-w-sm">
              <strong className="text-slate-900">{invite.creatorName}</strong> invited you to negotiate
              &quot;{invite.title}&quot;. Sign in to accept and set your sealed mandate.
            </p>
            <LoginCard
              onClerkSignIn={() => {
                if (openSignIn) {
                  openSignIn({
                    forceRedirectUrl: `/deals/${invite.dealId}/join?token=${token}`,
                  });
                } else {
                  router.push(`/sign-in?redirect_url=${encodeURIComponent(`/deals/${invite.dealId}/join?token=${token}`)}`);
                }
              }}
            />
          </div>
        ) : invite === undefined ? (
          <div className="flex items-center justify-center gap-2 text-slate-500 text-sm py-24">
            <Clock className="h-4 w-4 animate-spin text-emerald-600" />
            <span>Verifying deal link…</span>
          </div>
        ) : invite === null ? (
          <div className="bg-white border border-rose-200 rounded-2xl p-10 text-center space-y-3 shadow-2xs">
            <div className="h-12 w-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto border border-rose-100">
              <ShieldX className="h-6 w-6" />
            </div>
            <h1 className="text-lg font-bold text-slate-900">Invalid deal link</h1>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              This Magic Deal Link does not exist or has already been fully used. Ask the creator to send a fresh one.
            </p>
          </div>
        ) : (
          <>
            {/* Welcome card */}
            <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-2xs space-y-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-emerald-600 text-zinc-900 flex items-center justify-center shrink-0">
                  <Link2 className="h-5 w-5" />
                </div>
                <div>
                  <h1 className="text-lg font-extrabold text-slate-900 tracking-tight">
                    {invite.title}
                  </h1>
                  <p className="text-xs text-slate-500">
                    {invite.creatorName} invited you to negotiate on AgentPal
                  </p>
                </div>
              </div>
              <p className="text-sm text-slate-600">{invite.description}</p>
              <div className="flex items-center gap-2.5 bg-emerald-50/70 border border-emerald-200 rounded-xl px-4 py-3">
                {invite.inviteeRole === "buyer" ? (
                  <Briefcase className="h-4 w-4 text-emerald-700 shrink-0" />
                ) : (
                  <Store className="h-4 w-4 text-emerald-700 shrink-0" />
                )}
                <p className="text-xs font-semibold text-emerald-900">
                  {invite.inviteeRole === "buyer"
                    ? "You are joining as the Buyer (Client) — you pay for the work."
                    : "You are joining as the Seller (Provider) — you do the work."}
                </p>
              </div>
            </div>

            {error && (
              <p className="text-xs font-medium text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <div onClick={(e) => submitting && e.preventDefault()}>
              <MandateForm
                role={invite.inviteeRole as "buyer" | "seller"}
                onSubmit={(m) => void handleSubmit(m)}
              />
            </div>
          </>
        )}
      </main>
    </div>
  );
}
