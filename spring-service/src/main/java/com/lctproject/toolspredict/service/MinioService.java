package com.lctproject.toolspredict.service;

import com.lctproject.toolspredict.dto.minio.MinioFileDto;
import org.springframework.web.multipart.MultipartFile;

public interface MinioService {
    String uploadFile(MultipartFile file, String bucketName, String packageId);

    void deleteFile(String bucketName, String key);

    String rearrangeFile(String key, Long jobId);

    MinioFileDto getFile(String bucketName, String key);
}
