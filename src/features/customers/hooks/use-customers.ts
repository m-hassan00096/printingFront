import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createCustomer, deleteCustomer, getCustomer, getCustomerBalance, getCustomerLedger, getCustomerTypes,
  listCustomers, updateCustomer,
} from "../api/customers.api";
import type { CustomerFilters, CustomerPayload, LedgerFilters } from "../types/customers.types";

export const customerKeys = {
  lists: ["customers", "list"] as const,
  detail: (id: number) => ["customers", "detail", id] as const,
  types: ["customers", "types"] as const,
  balance: (id: number) => ["customers", "balance", id] as const,
  ledger: (id: number) => ["customers", "ledger", id] as const,
};
export function useCustomers(filters: CustomerFilters) {
  return useQuery({
    queryKey: [...customerKeys.lists, filters],
    queryFn: () => listCustomers(filters),
    placeholderData: (previous) => previous,
  });
}
export function useCustomer(id: number) {
  return useQuery({ queryKey: customerKeys.detail(id), queryFn: () => getCustomer(id), enabled: id > 0 });
}
export function useCustomerTypes(enabled: boolean) {
  return useQuery({ queryKey: customerKeys.types, queryFn: getCustomerTypes, enabled, staleTime: 30_000 });
}
export function useCustomerBalance(id: number, enabled: boolean) {
  return useQuery({ queryKey: customerKeys.balance(id), queryFn: () => getCustomerBalance(id), enabled: id > 0 && enabled });
}
export function useCustomerLedger(id: number, filters: LedgerFilters, enabled: boolean) {
  return useQuery({
    queryKey: [...customerKeys.ledger(id), filters],
    queryFn: () => getCustomerLedger(id, filters),
    enabled: id > 0 && enabled,
    placeholderData: (previous) => previous,
  });
}
export function useCustomerMutations() {
  const q = useQueryClient();
  const invalidate = (id?: number) => {
    void q.invalidateQueries({ queryKey: customerKeys.lists });
    if (id) {
      void q.invalidateQueries({ queryKey: customerKeys.detail(id) });
      void q.invalidateQueries({ queryKey: customerKeys.balance(id) });
      void q.invalidateQueries({ queryKey: customerKeys.ledger(id) });
    }
  };
  const create = useMutation({
    mutationFn: createCustomer,
    onSuccess: (customer) => invalidate(customer.id),
  });
  const update = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: CustomerPayload }) => updateCustomer(id, payload),
    onSuccess: (_, { id }) => invalidate(id),
  });
  const remove = useMutation({ mutationFn: deleteCustomer, onSuccess: () => invalidate() });
  return { create, update, remove };
}
