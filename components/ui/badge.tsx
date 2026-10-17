import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold tracking-wide transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/40",
  {
    variants: {
      variant: {
        default:
          "border-zinc-200 bg-zinc-100 text-zinc-900 shadow-xs hover:bg-zinc-200",
        primary:
          "border-blue-200/80 bg-blue-50 text-blue-700 shadow-2xs font-bold",
        secondary:
          "border-slate-200/80 bg-slate-100 text-slate-700 hover:bg-slate-200/80",
        destructive:
          "border-rose-200/80 bg-rose-50 text-rose-700 font-bold",
        outline: "border-slate-200 text-slate-700 bg-white/80 backdrop-blur-sm",
        success:
          "border-emerald-200/80 bg-emerald-50 text-emerald-700 font-bold",
        warning:
          "border-amber-200/80 bg-amber-50 text-amber-800 font-bold",
        glass:
          "glass-pill text-zinc-900 font-semibold",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
