import { UserRole } from "@prisma/client";

export type AuthUser = {
  id: string;
  companyId: string | null;
  role: UserRole;
  email: string;
};

export type RequestWithUser = {
  user?: AuthUser;
  headers: Record<string, string | string[] | undefined>;
  body: Record<string, unknown>;
  query: Record<string, unknown>;
};
