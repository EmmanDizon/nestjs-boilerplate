import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { TasksService } from './tasks.service';
import { TasksRepository } from './repositories/tasks.repository';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { Task, TaskStatus } from './entities/task.entity';
import { User, UserRole } from '../users/entities/user.entity';
import { S3Service } from '../common/services/s3.service';

describe('TasksService', () => {
  let service: TasksService;
  let dataSource: DataSource;
  let testUserId: string;

  const mockS3Service = {
    uploadFile: jest.fn(),
    getFileUrl: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'sqlite',
          database: ':memory:',
          entities: [Task, User],
          synchronize: true,
          dropSchema: true,
          logging: false,
        }),
        TypeOrmModule.forFeature([Task, User]),
      ],
      providers: [
        TasksService,
        TasksRepository,
        {
          provide: S3Service,
          useValue: mockS3Service,
        },
      ],
    }).compile();

    service = module.get<TasksService>(TasksService);
    dataSource = module.get<DataSource>(DataSource);

    // Create a test user
    const userRepo = dataSource.getRepository(User);
    const user = userRepo.create({
      email: 'test@example.com',
      password: 'hashedPassword',
      role: UserRole.USER,
    });
    const savedUser = await userRepo.save(user);
    testUserId = savedUser.id;
  });

  afterEach(async () => {
    await dataSource.destroy();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a task successfully', async () => {
      const createTaskDto: CreateTaskDto = {
        title: 'Test Task',
        description: 'Test Description',
      };

      const result = await service.create(testUserId, createTaskDto);

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.title).toBe(createTaskDto.title);
      expect(result.description).toBe(createTaskDto.description);
      expect(result.status).toBe(TaskStatus.PENDING);
      expect(result.userId).toBe(testUserId);
    });

    it('should throw error if user does not exist', async () => {
      const createTaskDto: CreateTaskDto = {
        title: 'Test Task',
        description: 'Test Description',
      };
      const invalidUserId = '00000000-0000-0000-0000-000000000000';

      await expect(
        service.create(invalidUserId, createTaskDto),
      ).rejects.toThrow();
    });
  });

  describe('findAll', () => {
    it('should return paginated tasks', async () => {
      // Create some test tasks
      await service.create(testUserId, {
        title: 'Task 1',
        description: 'Description 1',
      });
      await service.create(testUserId, {
        title: 'Task 2',
        description: 'Description 2',
      });

      const result = await service.findAll(testUserId, 1, 10);

      expect(result.data).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
      expect(result.lastPage).toBe(1);
    });

    it('should calculate correct pagination', async () => {
      // Create 15 tasks
      for (let i = 1; i <= 15; i++) {
        await service.create(testUserId, {
          title: `Task ${i}`,
          description: `Description ${i}`,
        });
      }

      const result = await service.findAll(testUserId, 2, 10);

      expect(result.data).toHaveLength(5);
      expect(result.total).toBe(15);
      expect(result.page).toBe(2);
      expect(result.lastPage).toBe(2);
    });

    it('should only return tasks for the specific user', async () => {
      // Create another user
      const userRepo = dataSource.getRepository(User);
      const user2 = userRepo.create({
        email: 'user2@example.com',
        password: 'hashedPassword',
        role: UserRole.USER,
      });
      const savedUser2 = await userRepo.save(user2);

      // Create tasks for both users
      await service.create(testUserId, {
        title: 'User 1 Task',
        description: 'Description',
      });
      await service.create(savedUser2.id, {
        title: 'User 2 Task',
        description: 'Description',
      });

      const result = await service.findAll(testUserId, 1, 10);

      expect(result.total).toBe(1);
      expect(result.data[0].title).toBe('User 1 Task');
    });
  });

  describe('findOne', () => {
    it('should return a task if found', async () => {
      const task = await service.create(testUserId, {
        title: 'Test Task',
        description: 'Test Description',
      });

      const result = await service.findOne(task.id, testUserId);

      expect(result).toBeDefined();
      expect(result.id).toBe(task.id);
      expect(result.title).toBe('Test Task');
    });

    it('should throw NotFoundException if task not found', async () => {
      const taskId = '00000000-0000-0000-0000-000000000000';

      await expect(service.findOne(taskId, testUserId)).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.findOne(taskId, testUserId)).rejects.toThrow(
        'Task not found',
      );
    });

    it('should throw NotFoundException if task belongs to another user', async () => {
      // Create another user
      const userRepo = dataSource.getRepository(User);
      const user2 = userRepo.create({
        email: 'user2@example.com',
        password: 'hashedPassword',
        role: UserRole.USER,
      });
      const savedUser2 = await userRepo.save(user2);

      // Create task for user2
      const task = await service.create(savedUser2.id, {
        title: 'User 2 Task',
        description: 'Description',
      });

      // Try to access with testUserId
      await expect(service.findOne(task.id, testUserId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('should update a task successfully', async () => {
      const task = await service.create(testUserId, {
        title: 'Test Task',
        description: 'Test Description',
      });

      const updateTaskDto: UpdateTaskDto = {
        title: 'Updated Task',
        status: TaskStatus.IN_PROGRESS,
      };

      const result = await service.update(task.id, testUserId, updateTaskDto);

      expect(result.title).toBe('Updated Task');
      expect(result.status).toBe(TaskStatus.IN_PROGRESS);
      expect(result.description).toBe('Test Description');
    });

    it('should throw NotFoundException if task not found', async () => {
      const taskId = '00000000-0000-0000-0000-000000000000';
      const updateTaskDto: UpdateTaskDto = {
        title: 'Updated Task',
      };

      await expect(
        service.update(taskId, testUserId, updateTaskDto),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException if task belongs to another user', async () => {
      // Create another user
      const userRepo = dataSource.getRepository(User);
      const user2 = userRepo.create({
        email: 'user2@example.com',
        password: 'hashedPassword',
        role: UserRole.USER,
      });
      const savedUser2 = await userRepo.save(user2);

      // Create task for user2
      const task = await service.create(savedUser2.id, {
        title: 'User 2 Task',
        description: 'Description',
      });

      // Try to update with testUserId
      await expect(
        service.update(task.id, testUserId, { title: 'Hacked' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should remove a task successfully', async () => {
      const task = await service.create(testUserId, {
        title: 'Test Task',
        description: 'Test Description',
      });

      await service.remove(task.id, testUserId);

      // Verify task is deleted
      await expect(service.findOne(task.id, testUserId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException if task not found', async () => {
      const taskId = '00000000-0000-0000-0000-000000000000';

      await expect(service.remove(taskId, testUserId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException if task belongs to another user', async () => {
      // Create another user
      const userRepo = dataSource.getRepository(User);
      const user2 = userRepo.create({
        email: 'user2@example.com',
        password: 'hashedPassword',
        role: UserRole.USER,
      });
      const savedUser2 = await userRepo.save(user2);

      // Create task for user2
      const task = await service.create(savedUser2.id, {
        title: 'User 2 Task',
        description: 'Description',
      });

      // Try to delete with testUserId
      await expect(service.remove(task.id, testUserId)).rejects.toThrow(
        NotFoundException,
      );

      // Verify task still exists for user2
      const stillExists = await service.findOne(task.id, savedUser2.id);
      expect(stillExists).toBeDefined();
    });
  });
});
