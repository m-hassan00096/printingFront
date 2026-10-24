export type ApiResponse<T> = {
  success: boolean;
  message: string;
  data: T;
};

export type PaginatedData<T> = {
  items: T[];
  pagination: {
    currentPage: number;
    perPage: number;
    total: number;
    lastPage: number;
  };
};

export type ApiErrorResponse = {
  success?: false;
  message: string;
  code?: string;
  errors?: Record<string, string[]>;
};
