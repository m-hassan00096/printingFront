import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";
import { cn } from "@/shared/lib/utils";

const badgeVariants = cva(
  "inline-flex w-fit items-center justify-center gap-1 whitespace-nowrap rounded-sm border px-2 py-0.5 text-[11px] font-semibold leading-4 transition-colors",
  {
    variants: {
      variant: {
        default: "border-primary/15 bg-primary/10 text-primary",
        secondary: "border-border bg-secondary text-secondary-foreground",
        outline: "border-border bg-transparent text-foreground",
        success: "border-[#3DD68C]/20 bg-[#e5f7ee] text-[#13805b]",
        warning: "border-[#F0C000]/20 bg-[#fff4dd] text-[#a96b0a]",
        destructive: "border-[#EB5757]/20 bg-[#ffebee] text-[#c83b4b]",
      },
    },
    defaultVariants: { variant: "secondary" },
  },
);

type BadgeProps = ComponentProps<"span"> & VariantProps<typeof badgeVariants>;
export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props} />;
}
