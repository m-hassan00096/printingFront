import type { Pagination } from "./finance.types";

export type RefundPaymentMethod=0|1|2;
export type RefundRecord={
  id:number;refundNumber:string;customerId:number;customerName:string;
  amount:string;paymentMethod:RefundPaymentMethod;paymentMethodLabel:string;
  paymentDestinationId:number|null;destinationLabel:string|null;
  reason:string;refundedOn:string;createdBy:number;createdAt:string|null;
};
export type RefundList={refunds:RefundRecord[];pagination:Pagination};
export type RefundFilters={
  page:number;search:string;dateFrom:string;dateTo:string;paymentMethod:""|"0"|"1"|"2";customerId?:number;
};
export type RefundCreditPreview={customerId:number;availableCredit:string;canRefund:boolean};
export type RefundPayload={customerId:number;amount:string;paymentMethod:RefundPaymentMethod;
  paymentDestinationId?:number;reason:string};
export type RefundCreated={id:number;refundNumber:string};
