package com.lctproject.toolspredict.service;

import com.lctproject.toolspredict.dto.ClassificationResponseDTO;
import org.springframework.http.ResponseEntity;
import org.springframework.web.multipart.MultipartFile;

public interface ManageJobsService {

    String processFile(MultipartFile file, Long jobId);

    String addRawFile(MultipartFile file, Long jobId);

    ClassificationResponseDTO sendToRecognition(String minioKey, Long jobId);

    String sendToEnrichment(Long jobId, String rawFileKey, String processedFileKey);

    ResponseEntity<?> testModels(MultipartFile file, boolean searchMarking);
}
