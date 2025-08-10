package com.lctproject.toolspredict.service.impl;

import com.lctproject.toolspredict.service.MinioService;
import io.minio.BucketExistsArgs;
import io.minio.MakeBucketArgs;
import io.minio.MinioClient;
import io.minio.errors.*;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.security.InvalidKeyException;
import java.security.NoSuchAlgorithmException;

@Slf4j
@Service
public class MinioServiceImpl implements MinioService {
    @Value("${integration.minio.bucket-raw}")
    private String bucketRaw;
    @Value("${integration.minio.bucket-processed}")
    private String bucketProcessed;
    @Value("${integration.minio.bucket-results}")
    private String bucketResult;
    @Value("${minio.endpoint}")
    private String minioEndpoint;
    @Value("${minio.access.key}")
    private String minioAccessKey;
    @Value("${minio.secret.key}")
    private String minioSecretKey;
    private MinioClient client;

    @PostConstruct
    public void init() {
       client = new MinioClient(
               minioEndpoint,
               minioAccessKey,
               minioSecretKey
       );
       try {
           createBucketIfNotExists(bucketRaw);
           createBucketIfNotExists(bucketProcessed);
           createBucketIfNotExists(bucketResult);
       } catch (Exception e) {
           log.error("Ошибка создания бакетов в MinioService: {}", e.getMessage());
       }

    }

    private void createBucketIfNotExists(String bucketName) throws ServerException, InvalidBucketNameException, InsufficientDataException,
            ErrorResponseException, IOException, NoSuchAlgorithmException,
            InvalidKeyException, InvalidResponseException, XmlParserException, InternalException, RegionConflictException {
        if (!client.bucketExists(BucketExistsArgs.builder().bucket(bucketName).build())) {
            client.makeBucket(MakeBucketArgs.builder()
                    .bucket(bucketName)
                    .build());
        }
    }
}
