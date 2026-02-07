#!/bin/bash

# Wait for LocalStack to be ready
echo "Waiting for LocalStack S3 service to be ready..."
until docker exec exam_localstack awslocal s3 ls 2>/dev/null; do
  echo "LocalStack not ready yet, waiting..."
  sleep 2
done

# Create S3 bucket
echo "Creating S3 bucket: task-uploads"
docker exec exam_localstack awslocal s3 mb s3://task-uploads

# Verify bucket was created
echo "Bucket created successfully!"
docker exec exam_localstack awslocal s3 ls

echo "LocalStack S3 setup complete!"
