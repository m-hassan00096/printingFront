import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";
import { cn } from "@/shared/lib/utils";

const badgeVariants = cva(
  "inline-flex w-fit items-center justify-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground",
        secondary: "border-transparent bg-secondary text-secondary-foreground",
        outline: "border-border bg-transparent text-foreground",
        success: "border-transparent bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
        warning: "border-transparent bg-amber-50 text-amber-900 dark:bg-amber-950 dark:text-amber-300",
        destructive: "border-transparent bg-red-50 text-red-800 dark:bg-red-950 dark:text-red-300",
      },
    },
    defaultVariants: { variant: "secondary" },
  },
);

type BadgeProps = ComponentProps<"span"> & VariantProps<typeof badgeVariants>;

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props} />;
}
