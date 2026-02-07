import {
  Injectable,
  ConflictException,
  InternalServerErrorException,
  Logger,
  HttpException,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { User } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UsersRepository } from './repositories/users.repository';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(private readonly usersRepository: UsersRepository) {}

  async register(
    createUserDto: CreateUserDto,
  ): Promise<Omit<User, 'password'>> {
    try {
      const { email, password } = createUserDto;

      this.logger.log(`Registering new user with email: ${email}`);

      const existingUser = await this.usersRepository.findByEmail(email);

      if (existingUser) throw new ConflictException('Email already exists');

      const hashedPassword = await bcrypt.hash(password, 10);

      const savedUser = await this.usersRepository.create({
        email,
        password: hashedPassword,
      });

      this.logger.log(`User registered successfully: ${email}`);
      return savedUser;
    } catch (error) {
      this.logger.error('Error creating user', error);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to create user');
    }
  }

  async validateUser(
    email: string,
    password: string,
  ): Promise<Omit<User, 'password'> | null> {
    try {
      this.logger.log(`Validating user: ${email}`);
      const user = await this.usersRepository.findByEmail(email);

      if (!user) return null;

      const isPasswordValid = await bcrypt.compare(password, user.password);

      if (!isPasswordValid) return null;

      return user;
    } catch (error) {
      this.logger.error(`Error validating user: ${email}`, error);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to validate user');
    }
  }

  async findById(id: string): Promise<Omit<User, 'password'>> {
    try {
      this.logger.log(`Fetching user by id: ${id}`);
      const user = await this.usersRepository.findById(id);

      if (!user) throw new NotFoundException('User not found');

      return user;
    } catch (error) {
      this.logger.error(`Error fetching user by id: ${id}`, error);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to fetch user');
    }
  }
}
