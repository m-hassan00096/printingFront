import { useEffect, useState } from "react";

/** Phone lists use compact cards instead of creating a 1000px-wide table.
 * Keep the breakpoint consistent with Tailwind's md (768px).
 */
export function useMobileListLayout(): boolean {
  const [mobile, setMobile] = useState(() => typeof window !== "undefined" && window.innerWidth < 768);
  useEffect(() => {
    const update = () => setMobile(window.innerWidth < 768);
    window.addEventListener("resize", update);
    update();
    return () => window.removeEventListener("resize", update);
  }, []);
  return mobile;
}
