import type { CustomerBalance, LedgerEntry, Pagination, CustomerOption } from "@/features/customers/types/customers.types";
export type { CustomerBalance, LedgerEntry, Pagination, CustomerOption };
export type AccountFilters={page:number;dateFrom:string;dateTo:string;type:string};
export type FinanceBalance=CustomerBalance&{openingBalanceExists:boolean};
export type RunningBalance={amount:string;type:0|1|2;typeLabel:string};
export type AccountLedgerEntry=LedgerEntry&{runningBalance:RunningBalance};
export type AccountLedger={
  entries:AccountLedgerEntry[];
  balance:Omit<CustomerBalance,"customerId">;
  openingBalanceExists:boolean;
  pagination:Pagination;
};
export type OpeningStatus={customerId:number;openingBalanceExists:boolean};
export type OpeningBalanceInput={amount:string;type:1|2;note?:string};
