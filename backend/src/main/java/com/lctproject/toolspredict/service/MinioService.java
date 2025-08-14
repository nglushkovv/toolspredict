package com.lctproject.toolspredict.service;

import org.springframework.web.multipart.MultipartFile;

public interface MinioService {
    String uploadFile(MultipartFile file, String bucketName, String packageId);
}
