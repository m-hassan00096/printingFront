export type AccountStatus = 0 | 1;
export type Pagination = {
  currentPage: number;
  lastPage: number;
  perPage: number;
  total: number;
};
export type UserRole = { id: number; name: string; alias: string };
export type IdentityUser = {
  id: number;
  name: string;
  username: string;
  phone: string | null;
  address: string | null;
  avatar: string | null;
  status: AccountStatus;
  statusLabel: string;
  role: UserRole | null;
};
export type IdentityRole = {
  id: number;
  name: string;
  nameAr: string | null;
  key: string;
  status: AccountStatus;
  statusLabel: string;
  usersCount: number;
  permissionIds?: number[];
};
export type UserFilters = {
  search?: string;
  status?: string;
  role?: string;
  page?: number;
  perPage?: number;
};
export type RoleFilters = {
  search?: string;
  status?: string;
  page?: number;
  perPage?: number;
};
export type UserPayload = {
  name?: string;
  username?: string;
  phone?: string | null;
  address?: string | null;
  roleId?: number;
  status?: AccountStatus;
  password?: string;
  passwordConfirmation?: string;
  avatar?: File;
};
export type RolePayload = {
  nameAr?: string;
  status?: AccountStatus;
  permissionIds?: number[];
};
