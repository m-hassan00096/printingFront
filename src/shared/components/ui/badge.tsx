import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";
import { cn } from "@/shared/lib/utils";

const badgeVariants = cva(
  "inline-flex w-fit items-center justify-center gap-1 whitespace-nowrap rounded-sm border px-2 py-0.5 text-[11px] font-semibold leading-4 transition-colors",
  {
    variants: {
      variant: {
        default: "border-primary/25 bg-primary/15 text-[#B5BAFF]",
        secondary: "border-border bg-secondary text-secondary-foreground",
        outline: "border-border bg-transparent text-foreground",
        success: "border-[#3DD68C]/20 bg-[#3DD68C]/10 text-[#3DD68C]",
        warning: "border-[#F0C000]/20 bg-[#F0C000]/10 text-[#F0C000]",
        destructive: "border-[#EB5757]/20 bg-[#EB5757]/10 text-[#EB5757]",
      },
    },
    defaultVariants: { variant: "secondary" },
  },
);

type BadgeProps = ComponentProps<"span"> & VariantProps<typeof badgeVariants>;
export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props} />;
}
