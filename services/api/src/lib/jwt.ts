import type { Role } from '@prisma/client';

export interface JwtPayload {
  id: string;
  email: string | null;
  roles: Role[];
}

export interface AuthedRequest {
  user: JwtPayload;
}
