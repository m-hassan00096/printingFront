export type AuthUser = {
  name: string;
  username: string;
  status: number;
  statusLabel: string;
  role: string | null;
  roleAlias: string | null;
  permissions: string[];
};

export type LoginCredentials = {
  username: string;
  password: string;
};
