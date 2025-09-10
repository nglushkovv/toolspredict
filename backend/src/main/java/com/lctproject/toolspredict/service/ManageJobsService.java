package com.lctproject.toolspredict.service;

import com.lctproject.toolspredict.dto.PreprocessResponse;
import org.springframework.http.ResponseEntity;
import org.springframework.web.multipart.MultipartFile;

public interface ManageJobsService {

    void processFile(MultipartFile file, Long jobId);

    String addRawFile(MultipartFile file, Long jobId);

    PreprocessResponse getProcessedFiles(String minioKey, Long jobId);

    ResponseEntity<?> sendToClassification(Long jobId);
}
