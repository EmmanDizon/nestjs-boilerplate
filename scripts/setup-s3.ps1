# Wait for LocalStack S3 service to be ready
Write-Host "Waiting for LocalStack S3 service to be ready..."
do {
    $result = docker exec exam_localstack awslocal s3 ls 2>$null
    if ($LASTEXITCODE -ne 0) {
        Write-Host "LocalStack not ready yet, waiting..."
        Start-Sleep -Seconds 2
    }
} while ($LASTEXITCODE -ne 0)

# Create S3 bucket
Write-Host "Creating S3 bucket: task-uploads"
docker exec exam_localstack awslocal s3 mb s3://task-uploads

# Verify bucket was created
Write-Host "Bucket created successfully!"
docker exec exam_localstack awslocal s3 ls

Write-Host "LocalStack S3 setup complete!"
