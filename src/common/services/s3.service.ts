import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

@Injectable()
export class S3Service {
  private readonly logger = new Logger(S3Service.name);
  private readonly s3Client: S3Client;
  private readonly bucketName: string;

  constructor(private readonly configService: ConfigService) {
    this.bucketName = this.configService.get<string>(
      'S3_BUCKET_NAME',
      'task-uploads',
    );

    this.s3Client = new S3Client({
      region: this.configService.get<string>('AWS_REGION', 'us-east-1'),
      endpoint: this.configService.get<string>(
        'S3_ENDPOINT',
        'http://localhost:4566',
      ),
      credentials: {
        accessKeyId: this.configService.get<string>(
          'AWS_ACCESS_KEY_ID',
          'test',
        ),
        secretAccessKey: this.configService.get<string>(
          'AWS_SECRET_ACCESS_KEY',
          'test',
        ),
      },
      forcePathStyle: true, // Required for LocalStack
    });
  }

  async uploadFile(
    file: Express.Multer.File,
    folder: string = 'csv-uploads',
  ): Promise<string> {
    const timestamp = Date.now();
    const key = `${folder}/${timestamp}-${file.originalname}`;

    try {
      this.logger.log(`Uploading file to S3: ${key}`);

      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
        Metadata: {
          originalName: file.originalname,
          uploadedAt: new Date().toISOString(),
        },
      });

      await this.s3Client.send(command);

      this.logger.log(`File uploaded successfully: ${key}`);
      return key;
    } catch (error) {
      if (error instanceof Error) {
        this.logger.error(
          `Failed to upload file to S3: ${error.message}`,
          error,
        );
      }

      throw new Error(`Failed to upload file`);
    }
  }

  getFileUrl(key: string): string {
    const endpoint = this.configService.get<string>(
      'S3_ENDPOINT',
      'http://localhost:4566',
    );
    return `${endpoint}/${this.bucketName}/${key}`;
  }
}
