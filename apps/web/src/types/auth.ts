export type UserRole = "ADMIN" | "WORKER" | "MANAGER" | "SUPERVISOR";

export interface AuthUser {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: UserRole;
  role_label: string;
}

export interface AuthResponse {
  user: AuthUser;
}
