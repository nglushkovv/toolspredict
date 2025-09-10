package com.lctproject.toolspredict.service.impl;

import com.lctproject.toolspredict.dto.ClassificationResponse;
import com.lctproject.toolspredict.dto.PreprocessResponse;
import com.lctproject.toolspredict.dto.ClassificationRequest;
import com.lctproject.toolspredict.model.Job;
import com.lctproject.toolspredict.service.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.util.Map;
import java.util.Objects;

@Service
@RequiredArgsConstructor
@Slf4j
public class ManageJobsServiceImpl implements ManageJobsService {
    private final JobService jobService;
    private final MinioFileService minioFileService;
    private final ComparsionService comparsionService;
    private final MinioService minioService;
    private final SenderService senderService;
    private final LogService logService;
    @Value("${integrations.minio.bucket.raw}")
    private String bucketRaw;
    @Value("${integrations.minio.bucket.processed}")
    private String bucketProcessed;

    @Override
    public void processFile(MultipartFile file, Long jobId) {
        String result;
        String rawFileKey = addRawFile(file, jobId);
        if (rawFileKey.substring(rawFileKey.lastIndexOf('.')+1).equals("mp4")) {
            PreprocessResponse response = getFrames(rawFileKey, jobId);
            for (Map.Entry<String, String> entry: response.getPreprocessResults().entrySet()) {
                try {
                    PreprocessResponse frameResponse = getProcessedFiles(entry.getValue(), jobId);
                    logService.logPreprocessResult(jobId, frameResponse, entry.getValue());
                } catch (Exception ex) {
                    log.error("Ошибка отправки кадра на предобработку: {}", ex.getMessage());
                }
            }
        } else {
            PreprocessResponse response = getProcessedFiles(rawFileKey, jobId);
            logService.logPreprocessResult(jobId, response, rawFileKey);
        }
    }


    @Override
    public String addRawFile(MultipartFile file, Long jobId) {
        String fileName = file.getOriginalFilename();
        log.info(String.valueOf(jobId));
        log.info(fileName);
        switch (Objects.requireNonNull(fileName).substring(fileName.lastIndexOf('.')+1)) {
            case "png", "mp4", "jpg" -> {
                Job job = jobService.getJob(jobId);
                return minioFileService.create(bucketRaw, file, job).getFilePath();
            }
            default -> throw new IllegalArgumentException("Unsupported file type: " + fileName
                    .substring(fileName.lastIndexOf('.')+1));
        }

    }

    @Override
    public PreprocessResponse getProcessedFiles(String minioKey, Long jobId) {
        try {
            ResponseEntity<?> response = senderService.sendToPreprocess(minioKey);
            PreprocessResponse preprocessResponse = (PreprocessResponse) response.getBody();
            if (preprocessResponse == null) throw new NullPointerException("PreprocessResponse is null");
            Job job = jobService.getJob(jobId);
            for (Map.Entry<String, String> entry : preprocessResponse.getPreprocessResults().entrySet()){
                log.info(entry.getValue());
                minioFileService.create(bucketProcessed, entry.getValue(), job);
            }
            log.info("Успех {}", String.valueOf(jobId));
            return preprocessResponse;
        } catch (Exception ex) {
            log.error("Ошибка {}", ex.getMessage());
        }
        return null;
    }

    public PreprocessResponse getFrames(String minioKey, Long jobId) {
        try {
            ResponseEntity<?> response = senderService.sendVideoToCut(minioKey);
            PreprocessResponse preprocessResponse = (PreprocessResponse) response.getBody();
            if (preprocessResponse == null) throw new NullPointerException("PreprocessResponse is null");
            Job job = jobService.getJob(jobId);
            for (Map.Entry<String, String> entry : preprocessResponse.getPreprocessResults().entrySet()){
                minioFileService.create(bucketRaw, entry.getValue(), job);
            }
            return preprocessResponse;
        } catch (Exception ex) {
            log.error("Ошибка получения кадров {}", ex.getMessage());
        }
        return null;
    }

    @Override
    public ResponseEntity<?> sendToClassification(Long jobId) {
        Job job = jobService.getJob(jobId);
        ClassificationRequest classificationRequest = new ClassificationRequest()
                .setPackages(minioFileService.getPackages(job));
        try {
            ClassificationResponse response = (ClassificationResponse) senderService.sendToInference(classificationRequest).getBody();
            logService.logClassificationResult(response, job);
            return comparsionService.compareResults(job);
        } catch (Exception ex) {
            log.error("Ошибка классификации: {}", ex.getMessage());
        }
        return ResponseEntity.ok(classificationRequest);
    }




}
