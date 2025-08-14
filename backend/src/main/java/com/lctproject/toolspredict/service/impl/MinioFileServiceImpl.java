package com.lctproject.toolspredict.service.impl;

import com.lctproject.toolspredict.model.Job;
import com.lctproject.toolspredict.model.minio.MinioEventDto;
import com.lctproject.toolspredict.model.minio.MinioFile;
import com.lctproject.toolspredict.repository.MinioFileRepository;
import com.lctproject.toolspredict.service.JobService;
import com.lctproject.toolspredict.service.MinioFileService;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;


import java.time.LocalDateTime;

@Service
@RequiredArgsConstructor
public class MinioFileServiceImpl implements MinioFileService {
    private final MinioFileRepository minioFileRepository;
    private JobService jobService;
    @Value("${integration.topics.raw}")
    private String bucketRaw;

    @Override
    public void create(String key, Job job) {
        String[] parts = key.split("/");
        MinioFile minioFile = new MinioFile()
                .setBucketName(parts[0])
                .setFilePath(parts[1] + "/" + parts[2])
                .setFileName(parts[2])
                .setCreatedAt(LocalDateTime.now())
                .setPackageId(job);
        minioFileRepository.save(minioFile);
    }
}
