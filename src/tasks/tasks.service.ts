import {
  Injectable,
  NotFoundException,
  Logger,
  InternalServerErrorException,
  HttpException,
  BadRequestException,
} from '@nestjs/common';
import { parse } from 'csv-parse';
import { Readable } from 'stream';
import { Task, TaskStatus } from './entities/task.entity';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { BulkUploadResult, BulkTaskRow } from './dto/bulk-upload.dto';
import { TasksRepository } from './repositories/tasks.repository';
import { S3Service } from '../common/services/s3.service';

@Injectable()
export class TasksService {
  private readonly logger = new Logger(TasksService.name);

  constructor(
    private readonly tasksRepository: TasksRepository,
    private readonly s3Service: S3Service,
  ) {}

  async create(userId: string, createTaskDto: CreateTaskDto): Promise<Task> {
    try {
      this.logger.log(`Creating task for user ${userId}`);
      return await this.tasksRepository.create({
        ...createTaskDto,
        userId,
      });
    } catch (error) {
      this.logger.error(`Failed to create task for user ${userId}`, error);
      throw new InternalServerErrorException('Failed to create task');
    }
  }

  async findAll(
    userId: string,
    page: number = 1,
    limit: number = 10,
  ): Promise<{ data: Task[]; total: number; page: number; lastPage: number }> {
    try {
      this.logger.log(`Fetching tasks for user ${userId} - page ${page}`);
      const skip = (page - 1) * limit;

      const [data, total] = await this.tasksRepository.findAndCount(
        userId,
        skip,
        limit,
      );

      return {
        data,
        total,
        page,
        lastPage: Math.ceil(total / limit),
      };
    } catch (error) {
      this.logger.error(`Failed to fetch tasks for user ${userId}`, error);
      throw new InternalServerErrorException('Failed to fetch tasks');
    }
  }

  async findOne(id: string, userId: string): Promise<Task> {
    try {
      this.logger.log(`Fetching task ${id} for user ${userId}`);
      const task = await this.tasksRepository.findOne(id, userId);

      if (!task) throw new NotFoundException('Task not found');

      return task;
    } catch (error) {
      this.logger.error(`Failed to fetch task ${id} for user ${userId}`, error);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to fetch task');
    }
  }

  async update(
    id: string,
    userId: string,
    updateTaskDto: UpdateTaskDto,
  ): Promise<Task> {
    try {
      this.logger.log(`Updating task ${id} for user ${userId}`);
      const task = await this.findOne(id, userId);

      Object.assign(task, updateTaskDto);

      return await this.tasksRepository.save(task);
    } catch (error) {
      this.logger.error(
        `Failed to update task ${id} for user ${userId}`,
        error,
      );
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to update task');
    }
  }

  async remove(id: string, userId: string): Promise<void> {
    try {
      this.logger.log(`Deleting task ${id} for user ${userId}`);
      const task = await this.findOne(id, userId);

      await this.tasksRepository.remove(task);
    } catch (error) {
      this.logger.error(
        `Failed to delete task ${id} for user ${userId}`,
        error,
      );
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to delete task');
    }
  }

  async bulkUpload(
    userId: string,
    file: Express.Multer.File,
  ): Promise<BulkUploadResult> {
    try {
      this.logger.log(`Processing bulk upload for user ${userId}`);

      // Validate file type
      if (
        !file.mimetype.includes('csv') &&
        !file.originalname.endsWith('.csv')
      ) {
        throw new BadRequestException('Only CSV files are allowed');
      }

      // Upload file to S3
      const fileKey = await this.s3Service.uploadFile(file);
      const fileUrl = this.s3Service.getFileUrl(fileKey);

      // Parse CSV
      const rows = await this.parseCSV(file.buffer);

      // Process each row
      const result: BulkUploadResult = {
        fileUrl,
        totalRows: rows.length,
        successCount: 0,
        failureCount: 0,
        createdTasks: [],
        errors: [],
      };

      for (const row of rows) {
        const validationErrors = this.validateTaskRow(row);

        if (validationErrors.length > 0) {
          result.errors.push({
            row: row.row,
            errors: validationErrors,
            data: {
              title: row.title,
              description: row.description,
              status: row.status,
            },
          });
          result.failureCount++;
        } else {
          try {
            const taskData: Partial<Task> = {
              title: row.title,
              userId,
              status: (row.status as TaskStatus) || TaskStatus.PENDING,
            };

            // Only add description if it exists
            if (row.description && row.description.trim().length > 0) {
              taskData.description = row.description;
            }

            const task = await this.tasksRepository.create(taskData);

            result.createdTasks.push({
              row: row.row,
              taskId: task.id,
              title: task.title,
            });
            result.successCount++;
          } catch (error) {
            this.logger.error(
              `Failed to create task for row ${row.row}`,
              error,
            );
            result.errors.push({
              row: row.row,
              errors: ['Failed to create task in database'],
              data: {
                title: row.title,
                description: row.description,
                status: row.status,
              },
            });
            result.failureCount++;
          }
        }
      }

      this.logger.log(
        `Bulk upload completed for user ${userId}: ${result.successCount} succeeded, ${result.failureCount} failed`,
      );

      return result;
    } catch (error) {
      this.logger.error(
        `Failed to process bulk upload for user ${userId}`,
        error,
      );
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to process bulk upload');
    }
  }

  private async parseCSV(buffer: Buffer): Promise<BulkTaskRow[]> {
    return new Promise((resolve, reject) => {
      const rows: BulkTaskRow[] = [];
      const stream = Readable.from(buffer);

      stream
        .pipe(
          parse({
            columns: true,
            skip_empty_lines: true,
            trim: true,
          }),
        )
        .on('data', (record: Record<string, string>) => {
          rows.push({
            row: rows.length + 2, // +2 because: 1-indexed and header row
            title: record.title || '',
            description: record.description || '',
            status: record.status || '',
          });
        })
        .on('end', () => {
          resolve(rows);
        })
        .on('error', (error) => {
          reject(
            new BadRequestException(`Failed to parse CSV: ${error.message}`),
          );
        });
    });
  }

  private validateTaskRow(row: BulkTaskRow): string[] {
    const errors: string[] = [];

    // Validate title
    if (!row.title || row.title.trim().length === 0) {
      errors.push('Title is required');
    } else if (row.title.length > 255) {
      errors.push('Title must be less than 255 characters');
    }

    // Validate status if provided
    if (row.status && row.status.trim().length > 0) {
      const validStatuses = Object.values(TaskStatus);
      if (!validStatuses.includes(row.status as TaskStatus)) {
        errors.push(
          `Invalid status. Must be one of: ${validStatuses.join(', ')}`,
        );
      }
    }

    return errors;
  }
}
