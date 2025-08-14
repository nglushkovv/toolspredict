package com.lctproject.toolspredict.service.impl;

import com.lctproject.toolspredict.model.Job;
import com.lctproject.toolspredict.service.JobService;
import com.lctproject.toolspredict.service.ManageJobsService;
import com.lctproject.toolspredict.service.MinioFileService;
import com.lctproject.toolspredict.service.MinioService;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

@Service
@RequiredArgsConstructor
public class ManageJobsServiceImpl implements ManageJobsService {
    private final JobService jobService;
    private final MinioFileService minioFileService;
    private final MinioService minioService;
    @Value("${integration.minio.bucket-raw}")
    private String bucketRaw;
    @Value("${integration.minio.bucket-processed}")
    private String bucketProcessed;

    @Override
    public void addRawFile(MultipartFile file, Long jobId) {
        String fileName = file.getOriginalFilename();
        switch (fileName.substring(fileName.lastIndexOf('.')+1)) {
            case "png", "mp4", "jpg" -> {
                Job job;
                if (jobId == null) {
                    job = jobService.createJob();
                } else {
                    job = jobService.getJob(jobId);
                }

                String key = minioService.uploadFile(file, bucketRaw, String.valueOf(jobId));
                minioFileService.create(key, job);
            }
            default -> throw new IllegalArgumentException("Unsupported file type: " + fileName
                    .substring(fileName.lastIndexOf('.')+1));
        }
    }

}
