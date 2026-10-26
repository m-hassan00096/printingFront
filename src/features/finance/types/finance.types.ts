import type { CustomerBalance, LedgerEntry, Pagination, CustomerOption } from "@/features/customers/types/customers.types";
export type { CustomerBalance, LedgerEntry, Pagination, CustomerOption };
export type AccountFilters={page:number;dateFrom:string;dateTo:string;type:string};
export type AccountLedger={entries:LedgerEntry[];balance:Omit<CustomerBalance,"customerId">;pagination:Pagination};
export type OpeningBalanceInput={amount:string;type:1|2;note?:string};
