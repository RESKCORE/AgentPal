'use client';

import Image from 'next/image';
import { motion, easeOut } from 'framer-motion';
import { MoveRight, Loader2, ShieldCheck } from 'lucide-react';
import { useClerk } from '@clerk/nextjs';

export interface LoginCardProps {
  onClerkSignIn?: () => void;
  loading?: boolean;
}

const itemVariants = {
  hidden: { opacity: 0, y: 15 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: easeOut },
  },
};

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: 0.6, staggerChildren: 0.08 },
  },
};

export function LoginCard({ onClerkSignIn, loading = false }: LoginCardProps) {
  const { openSignIn } = useClerk();

  const handleSignIn = () => {
    if (onClerkSignIn) {
      onClerkSignIn();
    } else if (openSignIn) {
      openSignIn({ forceRedirectUrl: "/" });
    } else {
      window.location.href = "/sign-in";
    }
  };
  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="w-full max-w-md relative"
    >
      {/* Decorative ambient aura behind card */}
      <div 
        className="pointer-events-none absolute -inset-4 rounded-3xl opacity-30 blur-2xl -z-10"
        style={{
          background: "radial-gradient(circle, rgba(14, 165, 233, 0.4) 0%, rgba(59, 130, 246, 0.2) 50%, transparent 80%)"
        }}
      />

      <motion.div
        variants={itemVariants}
        className="glass-panel-dark-elevated border border-zinc-200 rounded-3xl p-8 sm:p-9 shadow-[0_4px_16px_rgba(0,0,0,0.06)] relative overflow-hidden backdrop-blur-2xl"
      >
        {/* Specular sheen beam across top of card */}
        <div className="pointer-events-none absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />

        <motion.div variants={itemVariants} className="text-center mb-8">
          {/* Logo rendered directly as raw PNG without borders or background */}
          <div className="mx-auto mb-4 flex justify-center">
            <Image
              src="/logo.png"
              alt="AgentPal Logo"
              width={72}
              height={72}
              className="h-14 w-auto object-contain"
              priority
            />
          </div>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-zinc-100 border border-zinc-200 text-[11px] font-mono text-zinc-600 mb-2.5">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shadow-[0_0_8px_#38bdf8]" />
            AI NEGOTIATION · SAFE SETTLEMENT
          </div>

          <h1 className="text-2xl sm:text-3xl font-black text-zinc-900 mb-2 tracking-tight font-outfit">
            Welcome to AgentPal
          </h1>
          <p className="text-zinc-600 text-xs max-w-xs mx-auto leading-relaxed">
            Autonomous agent deal orchestration governed by zero-LLM deterministic settlement kernels.
          </p>
        </motion.div>

        <motion.div variants={itemVariants} className="space-y-3 mb-6">
          <motion.button
            type="button"
            onClick={handleSignIn}
            disabled={loading}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              className="w-full bg-zinc-100 hover:bg-zinc-200 border border-zinc-300 rounded-2xl px-5 py-3.5 text-zinc-900 flex items-center justify-between transition-all group disabled:opacity-60 disabled:pointer-events-none shadow-sm"
            >
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 rounded-lg bg-white flex items-center justify-center shadow-xs">
                  <svg viewBox="0 0 24 24" className="w-4 h-4 text-blue-600" aria-hidden>
                    <path d="M12 2c-4.962 0-9 4.037-9 9s4.038 9 9 9 9-4.037 9-9c0-4.963-4.038-9-9-9m0 18c-3.86 0-7-3.141-7-7s3.14-7 7-7 7 3.141 7 7-3.14 7-7 7zm0-14c-2.206 0-4 1.794-4 4s1.794 4 4 4 4-1.794 4-4c0-2.206-1.794-4-4-4z" />
                  </svg>
                </div>
                <span className="text-xs font-bold tracking-wide">
                  {loading ? 'Signing in with Clerk…' : 'Sign in with Clerk'}
                </span>
              </div>
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin text-zinc-600" />
              ) : (
                <MoveRight className="w-4 h-4 text-zinc-600 group-hover:text-zinc-900 group-hover:translate-x-1 transition-all" />
              )}
            </motion.button>
        </motion.div>

        {/* Invariant guarantee footer */}
        <motion.div 
          variants={itemVariants}
          className="pt-4 border-t border-zinc-200 flex items-center justify-center gap-4 text-[11px] text-zinc-500 font-mono"
        >
          <span className="flex items-center gap-1">
            <ShieldCheck className="w-3 h-3 text-emerald-600" />
            Zero-LLM Kernel
          </span>
          <span>·</span>
          <span>PayPal Sandbox</span>
        </motion.div>
      </motion.div>
    </motion.div>
  );
}
