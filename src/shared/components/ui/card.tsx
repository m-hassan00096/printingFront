import type { ComponentProps } from "react";
import { cn } from "@/shared/lib/utils";

export function Card({ className, ...props }: ComponentProps<"div">) {
  return <div data-slot="card" className={cn("rounded-lg border border-border bg-card text-card-foreground", className)} {...props} />;
}
export function CardHeader({ className, ...props }: ComponentProps<"div">) {
  return <div data-slot="card-header" className={cn("flex flex-col gap-1 p-4", className)} {...props} />;
}
export function CardTitle({ className, ...props }: ComponentProps<"h3">) {
  return <h3 data-slot="card-title" className={cn("leading-tight font-semibold tracking-tight", className)} {...props} />;
}
export function CardDescription({ className, ...props }: ComponentProps<"p">) {
  return <p data-slot="card-description" className={cn("text-xs text-muted-foreground", className)} {...props} />;
}
export function CardContent({ className, ...props }: ComponentProps<"div">) {
  return <div data-slot="card-content" className={cn("px-4 pb-4", className)} {...props} />;
}
export function CardFooter({ className, ...props }: ComponentProps<"div">) {
  return <div data-slot="card-footer" className={cn("flex items-center px-4 pb-4", className)} {...props} />;
}
