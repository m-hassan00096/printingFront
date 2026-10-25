export type CustomerStatus = 0 | 1;
export type Pagination = { currentPage: number; lastPage: number; perPage: number; total: number };
export type CustomerType = { id: number; name: string };
export type Customer = {
  id: number;
  name: string;
  phone: string;
  address: string | null;
  customerTypeId: number;
  customerType: CustomerType | null;
  status: CustomerStatus;
  statusLabel: string;
};
export type CustomerPayload = {
  name: string;
  phone: string;
  address: string | null;
  customerTypeId: number;
  status: CustomerStatus;
};
export type CustomerFilters = {
  search: string;
  customerTypeId: string;
  status: string;
  sort: string;
  page: number;
};
export type CustomerOption = { value: number; label: string };
export type CustomerBalance = {
  customerId: number;
  amount: string;
  type: 0 | 1 | 2;
  typeLabel: string;
};
export type LedgerEntry = {
  id: number;
  type: number | string;
  typeLabel: string;
  amount: string;
  signedAmount: string;
  orderId: number | null;
  collectionId: number | null;
  refundId: number | null;
  effectiveDate: string;
  note: string | null;
  createdAt: string | null;
};
export type LedgerPage = {
  entries: LedgerEntry[];
  balance: Omit<CustomerBalance, "customerId">;
  pagination: Pagination;
};
export type LedgerFilters = { page: number; dateFrom: string; dateTo: string };
