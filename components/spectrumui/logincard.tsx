'use client';

import Image from 'next/image';
import { motion, easeOut } from 'framer-motion';
import { MoveRight, Loader2 } from 'lucide-react';

export interface LoginCardProps {
  onGoogleSignIn?: () => void;
  onGuestSignIn?: () => void;
  loading?: boolean;
}

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: easeOut },
  },
};

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: 0.8, staggerChildren: 0.1 },
  },
};

export function LoginCard({ onGoogleSignIn, onGuestSignIn, loading = false }: LoginCardProps) {
  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="w-full max-w-md"
    >
      <motion.div
        variants={itemVariants}
        className="bg-white dark:bg-neutral-900 backdrop-blur-xl border border-slate-200 dark:border-white/10 rounded-3xl p-8 shadow-2xl"
      >
        <motion.div variants={itemVariants} className="text-center mb-8">
          <div className="mx-auto mb-4 h-16 w-16 rounded-2xl bg-slate-950 p-2 shadow-lg flex items-center justify-center border border-slate-800">
            <Image
              src="/logo.png"
              alt="AgentPal Logo"
              width={56}
              height={56}
              className="h-12 w-12 object-contain"
              priority
            />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-1.5 tracking-tight">
            Welcome to AgentPal
          </h1>
          <p className="text-gray-600 dark:text-gray-300 text-sm">
            Sign in to start negotiating
          </p>
        </motion.div>

        <motion.div variants={itemVariants} className="space-y-4 mb-6">
          <motion.button
            type="button"
            onClick={onGoogleSignIn}
            disabled={loading}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="w-full bg-gray-100 dark:bg-neutral-800 border border-gray-300 dark:border-white/20 rounded-full px-6 py-4 text-gray-900 dark:text-white flex items-center justify-between hover:bg-gray-200 dark:hover:bg-black/60 transition-colors group disabled:opacity-60 disabled:pointer-events-none"
          >
            <div className="flex items-center">
              <svg viewBox="0 0 24 24" className="w-5 h-5 mr-3" aria-hidden>
                <path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47a5.57 5.57 0 0 1-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z" />
                <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09A11.99 11.99 0 0 0 12 24z" />
                <path fill="#FBBC05" d="M5.27 14.29A7.2 7.2 0 0 1 4.89 12c0-.8.14-1.57.38-2.29V6.62H1.29a12 12 0 0 0 0 10.76l3.98-3.09z" />
                <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42A11.97 11.97 0 0 0 12 0 11.99 11.99 0 0 0 1.29 6.62l3.98 3.09C6.22 6.86 8.87 4.75 12 4.75z" />
              </svg>
              <span>{loading ? 'Redirecting to Google…' : 'Continue with Google'}</span>
            </div>
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <MoveRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            )}
          </motion.button>

          {onGuestSignIn && (
            <motion.button
              type="button"
              onClick={onGuestSignIn}
              disabled={loading}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="w-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-full px-6 py-3.5 text-sm font-medium flex items-center justify-between hover:bg-slate-800 dark:hover:bg-slate-100 transition-colors disabled:opacity-60"
            >
              <span>Continue as Guest</span>
              <MoveRight className="w-4 h-4" />
            </motion.button>
          )}
        </motion.div>

        <motion.p
          variants={itemVariants}
          className="text-center text-xs text-gray-500 dark:text-gray-400"
        >
          One account for buying and selling. Payments run in PayPal Sandbox.
        </motion.p>
      </motion.div>
    </motion.div>
  );
}
