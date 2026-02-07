import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { UsersService } from './users.service';
import { UsersRepository } from './repositories/users.repository';
import { CreateUserDto } from './dto/create-user.dto';
import { User } from './entities/user.entity';
import { Task } from '../tasks/entities/task.entity';

describe('UsersService', () => {
  let service: UsersService;
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
      ],
      providers: [UsersService, UsersRepository],
    }).compile();

    service = module.get<UsersService>(UsersService);
    dataSource = module.get<DataSource>(DataSource);
  });

  afterEach(async () => {
    await dataSource.destroy();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('register', () => {
    it('should register a new user successfully', async () => {
      const createUserDto: CreateUserDto = {
        email: 'test@example.com',
        password: 'password123',
      };

      const result = await service.register(createUserDto);

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.email).toBe(createUserDto.email);
      expect(result.role).toBe('user');
      expect(result.createdAt).toBeDefined();
    });

    it('should throw ConflictException if email already exists', async () => {
      const createUserDto: CreateUserDto = {
        email: 'test@example.com',
        password: 'password123',
      };

      // Create first user
      await service.register(createUserDto);

      // Try to register with same email
      await expect(service.register(createUserDto)).rejects.toThrow(
        ConflictException,
      );
      await expect(service.register(createUserDto)).rejects.toThrow(
        'Email already exists',
      );
    });
  });

  describe('validateUser', () => {
    it('should return user if credentials are valid', async () => {
      const email = 'test@example.com';
      const password = 'password123';

      // Register a user first
      await service.register({ email, password });

      const result = await service.validateUser(email, password);

      expect(result).toBeDefined();
      expect(result!.email).toBe(email);
    });

    it('should return null if user not found', async () => {
      const email = 'nonexistent@example.com';
      const password = 'password123';

      const result = await service.validateUser(email, password);

      expect(result).toBeNull();
    });

    it('should return null if password is invalid', async () => {
      const email = 'test@example.com';
      const password = 'password123';

      // Register a user
      await service.register({ email, password });

      // Try with wrong password
      const result = await service.validateUser(email, 'wrongpassword');

      expect(result).toBeNull();
    });
  });

  describe('findById', () => {
    it('should return a user if found', async () => {
      const user = await service.register({
        email: 'test@example.com',
        password: 'password123',
      });

      const result = await service.findById(user.id);

      expect(result).toBeDefined();
      expect(result.id).toBe(user.id);
      expect(result.email).toBe(user.email);
    });

    it('should throw NotFoundException if user not found', async () => {
      const userId = '00000000-0000-0000-0000-000000000000';

      await expect(service.findById(userId)).rejects.toThrow(NotFoundException);
      await expect(service.findById(userId)).rejects.toThrow('User not found');
    });
  });
});
