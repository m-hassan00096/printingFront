export type DashboardMetrics={
  activeOrders:number;overdueOrders:number;readyForDelivery:number;dueToday:number;
};
export type DashboardPressure={
  notStarted:number;design:number;printing:number;ready:number;
};
export type DashboardOrder={
  id:number;orderNumber:string|null;customerName:string;
  dueDate:string|null;productionStatus:number|null;
  productionStatusLabel:string|null;isOverdue:boolean;
};
export type DashboardData={
  asOfDate:string;metrics:DashboardMetrics;
  productionPressure:DashboardPressure;
  attentionOrders:DashboardOrder[];latestOrders:DashboardOrder[];
};
