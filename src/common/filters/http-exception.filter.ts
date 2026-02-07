import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { QueryFailedError } from 'typeorm';

interface HttpExceptionResponse {
  message?: string | string[];
  error?: string;
}

interface PostgresError {
  code?: string;
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Internal server error';
    let error = 'Internal Server Error';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'object') {
        const httpResponse = exceptionResponse as HttpExceptionResponse;
        message = httpResponse.message || exception.message;
        error = httpResponse.error || exception.name;
      } else {
        message = exceptionResponse;
        error = exception.name;
      }
    } else if (exception instanceof QueryFailedError) {
      status = HttpStatus.BAD_REQUEST;

      const pgError = exception.driverError as PostgresError;

      // PostgreSQL error codes
      if (pgError.code === '22P02') {
        // Invalid input syntax (e.g., invalid UUID)
        message = 'Invalid ID format';
        error = 'Bad Request';
      } else if (pgError.code === '23505') {
        // Unique violation
        message = 'Duplicate entry';
        error = 'Conflict';
        status = HttpStatus.CONFLICT;
      } else if (pgError.code === '23503') {
        // Foreign key violation
        message = 'Related record not found';
        error = 'Bad Request';
      } else {
        message = 'Database error';
        error = 'Bad Request';
      }
    } else if (exception instanceof Error) {
      message = exception.message;
      error = exception.name;
    }

    // Log the error
    this.logger.error(
      `${request.method} ${request.url}`,
      exception instanceof Error ? exception.stack : exception,
    );

    response.status(status).json({
      statusCode: status,
      message,
      error,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}
