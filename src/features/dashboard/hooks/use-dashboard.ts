import { useQuery } from "@tanstack/react-query";
import { fetchDashboard } from "../api/dashboard.api";

export const dashboardKey=["dashboard","overview"] as const;
export function useDashboard(enabled:boolean){
  return useQuery({queryKey:dashboardKey,queryFn:fetchDashboard,enabled,staleTime:30_000});
}
