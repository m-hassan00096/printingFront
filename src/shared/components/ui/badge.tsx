import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";
import { cn } from "@/shared/lib/utils";

const badgeVariants = cva(
  "inline-flex w-fit items-center justify-center gap-1 whitespace-nowrap rounded-md border px-2 py-0.5 text-xs font-semibold leading-5 transition-colors",
  {
    variants: {
      variant: {
        default: "border-primary/15 bg-primary/10 text-primary",
        secondary: "border-border bg-secondary text-secondary-foreground",
        outline: "border-border bg-transparent text-foreground",
        success: "border-[#bce6d3] bg-[#e8f7f0] text-[#147b5a]",
        warning: "border-[#f0d8a5] bg-[#fff7e8] text-[#996414]",
        destructive: "border-[#f0c8d1] bg-[#fff0f2] text-[#bb3d50]",
      },
    },
    defaultVariants: { variant: "secondary" },
  },
);

type BadgeProps = ComponentProps<"span"> & VariantProps<typeof badgeVariants>;
export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props} />;
}
