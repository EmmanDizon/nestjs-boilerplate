import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { UsersRepository } from '../users/repositories/users.repository';
import { User, UserRole } from '../users/entities/user.entity';
import { Task } from '../tasks/entities/task.entity';
import { LoginDto } from './dto/login.dto';

describe('AuthService', () => {
  let service: AuthService;
  let usersService: UsersService;
  let jwtService: JwtService;
  let dataSource: DataSource;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'sqlite',
          database: ':memory:',
          entities: [User, Task],
          synchronize: true,
          dropSchema: true,
          logging: false,
        }),
        TypeOrmModule.forFeature([User]),
        JwtModule.register({
          secret: 'test-secret',
          signOptions: { expiresIn: '1h' },
        }),
      ],
      providers: [AuthService, UsersService, UsersRepository],
    }).compile();

    service = module.get<AuthService>(AuthService);
    usersService = module.get<UsersService>(UsersService);
    jwtService = module.get<JwtService>(JwtService);
    dataSource = module.get<DataSource>(DataSource);
  });

  afterEach(async () => {
    await dataSource.destroy();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('login', () => {
    it('should return access token with valid credentials', async () => {
      const email = 'test@example.com';
      const password = 'password123';

      // Register a user first
      const user = await usersService.register({ email, password });

      const loginDto: LoginDto = { email, password };
      const result = await service.login(loginDto);

      expect(result).toBeDefined();
      expect(result.access_token).toBeDefined();
      expect(typeof result.access_token).toBe('string');

      // Verify the token contains correct payload
      const decoded: {
        sub: string;
        email: string;
        role: UserRole;
      } = jwtService.verify(result.access_token);
      expect(decoded.sub).toBe(user.id);
      expect(decoded.email).toBe(user.email);
      expect(decoded.role).toBe(user.role);
    });

    it('should throw UnauthorizedException with invalid email', async () => {
      const loginDto: LoginDto = {
        email: 'nonexistent@example.com',
        password: 'password123',
      };

      await expect(service.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(service.login(loginDto)).rejects.toThrow(
        'Invalid credentials',
      );
    });

    it('should throw UnauthorizedException with invalid password', async () => {
      const email = 'test@example.com';
      const password = 'password123';

      // Register a user
      await usersService.register({ email, password });

      const loginDto: LoginDto = {
        email,
        password: 'wrongpassword',
      };

      await expect(service.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(service.login(loginDto)).rejects.toThrow(
        'Invalid credentials',
      );
    });
  });

  describe('verifyToken', () => {
    it('should verify a valid token', async () => {
      const email = 'test@example.com';
      const password = 'password123';

      // Register and login to get a valid token
      const user = await usersService.register({ email, password });
      const loginResult = await service.login({ email, password });

      const result = service.verifyToken(loginResult.access_token);

      expect(result).toBeDefined();
      expect(result.sub).toBe(user.id);
      expect(result.email).toBe(user.email);
      expect(result.role).toBe(user.role);
    });

    it('should throw error for invalid token', () => {
      const invalidToken = 'invalid.token.here';

      expect(() => service.verifyToken(invalidToken)).toThrow(
        UnauthorizedException,
      );
    });

    it('should throw error for expired token', async () => {
      // Create a token that expires immediately
      const payload = {
        sub: 'user-id',
        email: 'test@example.com',
        role: UserRole.USER,
      };
      const expiredToken = jwtService.sign(payload, { expiresIn: '0s' });

      // Wait a bit to ensure token is expired
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(() => service.verifyToken(expiredToken)).toThrow(
        UnauthorizedException,
      );
    });
  });
});
