package com.lctproject.toolspredict.service.impl;

import com.lctproject.toolspredict.dto.ClassificationResponse;
import com.lctproject.toolspredict.dto.ClassificationResult;
import com.lctproject.toolspredict.dto.PreprocessResponse;
import com.lctproject.toolspredict.model.Job;
import com.lctproject.toolspredict.model.MinioFile;
import com.lctproject.toolspredict.model.PredictionResult;
import com.lctproject.toolspredict.model.PreprocessResult;
import com.lctproject.toolspredict.repository.*;
import com.lctproject.toolspredict.service.JobService;
import com.lctproject.toolspredict.service.LogService;
import com.lctproject.toolspredict.service.MinioFileService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class LogServiceImpl implements LogService {
    private final PreprocessResultRepository preprocessResultRepository;
    private final PredictionResultRepository predictResultRepository;
    private final ToolReferenceRepository toolReferenceRepository;
    private final ToolRepository toolRepository;
    private final MinioFileRepository minioFileRepository;
    private final MinioFileService minioFileService;
    private final JobService jobService;
    private final PredictionResultRepository predictionResultRepository;
    @Value("${integrations.minio.bucket.raw}")
    private String bucketRaw;
    @Value("${integrations.minio.bucket.processed}")
    private String bucketProcessed;
    @Value("${integrations.minio.bucket.results}")
    private String bucketResults;

    @Override
    public void logPreprocessResult(Long jobId, PreprocessResponse preprocessResponse, String rawFileKey) {
        for (Map.Entry<String, String> entry: preprocessResponse.getPreprocessResults().entrySet()) {
            String toolReferenceName = entry.getKey().substring(0, entry.getKey().lastIndexOf("_"));
            log.info("{} + {}", entry.getValue(), bucketRaw);
            PreprocessResult preprocessResult = new PreprocessResult()
                    .setJob(jobService.getJob(jobId))
                    .setFile(minioFileRepository.findByFilePathAndBucketName(entry.getValue(), bucketProcessed))
                    .setOriginalFile(minioFileRepository.findByFilePathAndBucketName(rawFileKey, bucketRaw))
                    .setCreatedAt(LocalDateTime.now())
                    .setToolReference(toolReferenceRepository.findByToolName(toolReferenceName));
            preprocessResultRepository.save(preprocessResult);
        }
    }

    @Override
    public void logClassificationResult(ClassificationResponse response, Job job) {
        predictionResultRepository.deleteByJob(job);
        for (Map.Entry<String, Map<String, ClassificationResult>> results: response.getResults().entrySet()) {
            String rawFilePath = results.getKey();
            for (Map.Entry<String, ClassificationResult> entry: results.getValue().entrySet()) {
                String processedFilePath = entry.getKey();
                ClassificationResult classificationResult = entry.getValue();
                MinioFile resultFile = minioFileService.get(job.getId() + "/result.json", bucketResults);
                log.info("file {}, original file {}", minioFileRepository.findByFilePathAndBucketName(processedFilePath, bucketProcessed).getId(), minioFileRepository.findByFilePathAndBucketName(rawFilePath, bucketRaw).getId());
                PredictionResult predictionResult = new PredictionResult()
                        .setConfidence(classificationResult.getConfidence())
                        .setJob(job)
                        .setPreprocessResult(preprocessResultRepository.findByFileAndOriginalFile(
                                minioFileRepository.findByFilePathAndBucketName(processedFilePath, bucketProcessed).getId(),
                                minioFileRepository.findByFilePathAndBucketName(rawFilePath, bucketRaw).getId()
                        ))
                        .setTool(toolRepository.findByName(classificationResult.getMicroclass()))
                        .setFile(resultFile == null ? minioFileService.create(bucketResults,
                                job.getId() + "/result.json", job): resultFile)
                        .setCreatedAt(LocalDateTime.now());
                predictionResultRepository.save(predictionResult);
            }
        }
    }
}
