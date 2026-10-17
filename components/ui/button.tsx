import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"
import { Slot } from "radix-ui"

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98] [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "glossy-btn-dark",
        primary:
          "glossy-btn-blue",
        destructive:
          "bg-gradient-to-b from-rose-500 to-rose-700 text-zinc-900 shadow-sm hover:from-rose-600 hover:to-rose-800 border border-rose-400/30",
        outline:
          "border border-slate-200/90 bg-white/80 backdrop-blur-md shadow-2xs hover:bg-slate-50 hover:text-zinc-950 text-slate-700",
        secondary:
          "bg-slate-100 hover:bg-slate-200/80 text-zinc-900 border border-slate-200/60",
        ghost:
          "hover:bg-slate-100 hover:text-zinc-950 text-slate-600",
        link: "text-blue-600 underline-offset-4 hover:underline",
        success:
          "bg-gradient-to-b from-emerald-500 to-emerald-700 text-zinc-900 shadow-sm hover:from-emerald-600 hover:to-emerald-800 border border-emerald-400/30",
        glass:
          "glass-panel text-zinc-900 hover:bg-white/95 hover:border-slate-300",
        blue:
          "glossy-btn-blue",
      },
      size: {
        default: "h-9 px-4 py-2 has-[>svg]:px-3",
        xs: "h-6 gap-1 rounded-lg px-2 text-[11px] has-[>svg]:px-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-8 gap-1.5 rounded-lg px-3 has-[>svg]:px-2.5",
        lg: "h-11 rounded-xl px-6 text-sm has-[>svg]:px-4 font-bold",
        icon: "size-9 rounded-xl",
        "icon-xs": "size-6 rounded-lg [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-8 rounded-lg",
        "icon-lg": "size-10 rounded-xl",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
