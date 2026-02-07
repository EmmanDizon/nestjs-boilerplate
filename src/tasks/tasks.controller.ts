import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
  ParseIntPipe,
  DefaultValuePipe,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiBody,
  ApiQuery,
  ApiConsumes,
} from '@nestjs/swagger';
import { TasksService } from './tasks.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserRole } from '../users/entities/user.entity';
import { ParseUUIDPipe } from '../common/pipes/parse-uuid.pipe';

interface JwtPayload {
  sub: string;
  email: string;
  role: UserRole;
}

@ApiTags('Tasks')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('tasks')
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new task' })
  @ApiBody({
    type: CreateTaskDto,
    examples: {
      task: {
        summary: 'Sample task',
        value: {
          title: 'Complete project documentation',
          description: 'Write comprehensive API documentation',
        },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Task created successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  create(
    @CurrentUser() user: JwtPayload,
    @Body() createTaskDto: CreateTaskDto,
  ) {
    return this.tasksService.create(user.sub, createTaskDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all tasks with pagination' })
  @ApiQuery({
    name: 'page',
    required: false,
    example: 1,
    description: 'Page number',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    example: 10,
    description: 'Items per page',
  })
  @ApiResponse({ status: 200, description: 'Tasks retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  findAll(
    @CurrentUser() user: JwtPayload,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
  ) {
    return this.tasksService.findAll(user.sub, page, limit);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single task by ID' })
  @ApiResponse({ status: 200, description: 'Task retrieved successfully' })
  @ApiResponse({ status: 400, description: 'Invalid UUID format' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Task not found' })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.tasksService.findOne(id, user.sub);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a task' })
  @ApiBody({
    type: UpdateTaskDto,
    examples: {
      task: {
        summary: 'Update task',
        value: {
          title: 'Updated task title',
          status: 'in-progress',
        },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Task updated successfully' })
  @ApiResponse({ status: 400, description: 'Invalid UUID format' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Task not found' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
    @Body() updateTaskDto: UpdateTaskDto,
  ) {
    return this.tasksService.update(id, user.sub, updateTaskDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a task' })
  @ApiResponse({ status: 200, description: 'Task deleted successfully' })
  @ApiResponse({ status: 400, description: 'Invalid UUID format' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Task not found' })
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.tasksService.remove(id, user.sub);
  }

  @Post('bulk-upload')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Bulk upload tasks from CSV file',
    description: `Upload a CSV file to create multiple tasks at once.
    
CSV Format:
- Header row required with columns: title, description, status
- title (required): Task title
- description (optional): Task description
- status (optional): One of: pending, in-progress, done (defaults to pending)

Example CSV:
\`\`\`
title,description,status
"Complete documentation","Write comprehensive API docs",pending
"Code review","Review pull requests",in-progress
"Deploy to production","Deploy v1.0.0",pending
\`\`\`

The file will be stored in S3 and tasks will be created for valid rows.
Invalid rows will be reported with specific errors.`,
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'CSV file containing tasks to create',
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'CSV processed successfully',
    schema: {
      type: 'object',
      properties: {
        fileUrl: {
          type: 'string',
          example:
            'http://localhost:4566/task-uploads/csv-uploads/1234567890-tasks.csv',
        },
        totalRows: { type: 'number', example: 10 },
        successCount: { type: 'number', example: 8 },
        failureCount: { type: 'number', example: 2 },
        createdTasks: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              row: { type: 'number', example: 2 },
              taskId: { type: 'string', example: 'uuid' },
              title: { type: 'string', example: 'Complete documentation' },
            },
          },
        },
        errors: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              row: { type: 'number', example: 5 },
              errors: {
                type: 'array',
                items: { type: 'string' },
                example: ['Title is required'],
              },
              data: {
                type: 'object',
                example: { title: '', description: 'test', status: 'pending' },
              },
            },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid file format or missing file',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  bulkUpload(
    @CurrentUser() user: JwtPayload,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    return this.tasksService.bulkUpload(user.sub, file);
  }
}
