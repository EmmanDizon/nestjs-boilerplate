import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import { UserRole } from '../users/entities/user.entity';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  async login(loginDto: LoginDto) {
    try {
      this.logger.log(`Login attempt for email: ${loginDto.email}`);

      const user = await this.usersService.validateUser(
        loginDto.email,
        loginDto.password,
      );

      if (!user) {
        this.logger.warn(`Invalid credentials for email: ${loginDto.email}`);
        throw new UnauthorizedException('Invalid credentials');
      }

      const payload = { sub: user.id, email: user.email, role: user.role };
      const token = this.jwtService.sign(payload);

      this.logger.log(`User logged in successfully: ${loginDto.email}`);

      return {
        access_token: token,
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
        },
      };
    } catch (error) {
      this.logger.error(`Login failed for email: ${loginDto.email}`, error);
      throw error;
    }
  }

  verifyToken(token: string): { sub: string; email: string; role: UserRole } {
    try {
      return this.jwtService.verify(token);
    } catch (error) {
      this.logger.error('Token verification failed', error);
      throw new UnauthorizedException('Invalid token');
    }
  }
}
