import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Task } from '../entities/task.entity';

@Injectable()
export class TasksRepository {
  constructor(
    @InjectRepository(Task)
    private readonly repository: Repository<Task>,
  ) {}

  async create(taskData: Partial<Task>): Promise<Task> {
    const task = this.repository.create(taskData);
    return this.repository.save(task);
  }

  async findAndCount(
    userId: string,
    skip: number,
    take: number,
  ): Promise<[Task[], number]> {
    return this.repository.findAndCount({
      where: { userId },
      skip,
      take,
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string, userId: string): Promise<Task | null> {
    return this.repository.findOne({
      where: { id, userId },
    });
  }

  async save(task: Task): Promise<Task> {
    return this.repository.save(task);
  }

  async remove(task: Task): Promise<void> {
    await this.repository.remove(task);
  }
}
