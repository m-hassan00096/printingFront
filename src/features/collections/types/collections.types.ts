export type Pagination={currentPage:number;lastPage:number;perPage:number;total:number};
export type PaymentMethod=0|1|2;
export type CollectionStatus=1|2;
export type CollectionSource=0|1|2;
export type Collection={
  id:number;receiptNumber:string;customerId:number;customerName:string;customerPhone:string;
  orderId:number|null;amount:string;paymentMethod:PaymentMethod;paymentMethodLabel:string;
  paymentDestinationId:number|null;destinationLabel:string|null;
  source:CollectionSource;sourceLabel:string;status:CollectionStatus;statusLabel:string;
  collectedOn:string;note:string|null;createdBy:number|null;createdAt:string|null;
  reversedAt:string|null;reversalReason:string|null;
};
export type CollectionPage={collections:Collection[];pagination:Pagination};
export type CollectionSummary={
  totalCollected:string;collectionsCount:number;cashTotal:string;bankTotal:string;walletTotal:string;
};
export type CollectionFilters={
  search:string;dateFrom:string;dateTo:string;paymentMethod:string;source:string;status:string;
  sort:"-id"|"id"|"collectedOn"|"-collectedOn";
};
export type CreateCollectionPayload={
  customerId:number;amount:string;paymentMethod:PaymentMethod;paymentDestinationId?:number;
  collectedOn?:string;note?:string|null;orderId?:number;
};
export type CollectionCreated={id:number;receiptNumber:string};
export type SelectOption={value:number;label:string;isDefault?:number};
