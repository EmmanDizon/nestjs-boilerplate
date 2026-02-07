import { UserRole } from '../users/entities/user.entity';

declare global {
  namespace Express {
    interface Request {
      user?: {
        sub: string;
        email: string;
        role: UserRole;
      };
    }
  }
}

export {};
