import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import { Toaster } from "sonner";
import { AuthSessionBoundary } from "@/features/auth/components/auth-session-boundary";

type AppProvidersProps = {
  children: ReactNode;
};

/**
 * Match the toast position to the current UI language.
 * The app currently starts in Arabic; observing <html lang> also supports future
 * client-side language changes without reloading the application.
 */
function getToastDirection(): "rtl" | "ltr" {
  const lang = document.documentElement.lang.trim().toLowerCase();
  return /^(ar|fa|he|ur)(-|$)/.test(lang) || (!lang && document.documentElement.dir === "rtl")
    ? "rtl"
    : "ltr";
}

function useToastDirection(): "rtl" | "ltr" {
  const [direction, setDirection] = useState(getToastDirection);

  useEffect(() => {
    const observer = new MutationObserver(() => setDirection(getToastDirection()));
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["lang", "dir"],
    });
    return () => observer.disconnect();
  }, []);

  return direction;
}

export function AppProviders({ children }: AppProvidersProps) {
  const toastDirection = useToastDirection();
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            gcTime: 5 * 60_000,
            retry: 1,
            refetchOnWindowFocus: false,
          },
          mutations: {
            retry: false,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <AuthSessionBoundary>{children}</AuthSessionBoundary>
      <Toaster key={toastDirection} dir={toastDirection} position={toastDirection === "rtl" ? "bottom-left" : "bottom-right"} richColors closeButton />
    </QueryClientProvider>
  );
}
