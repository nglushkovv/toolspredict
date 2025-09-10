package com.lctproject.toolspredict.service;

import com.lctproject.toolspredict.dto.ClassificationRequest;
import com.lctproject.toolspredict.dto.ClassificationResponse;
import com.lctproject.toolspredict.dto.PreprocessResponse;
import org.springframework.http.ResponseEntity;

import java.util.List;

public interface SenderService {
    ResponseEntity<?> sendToPreprocess(String minioKey);

    ResponseEntity<ClassificationResponse> sendToInference(ClassificationRequest request);

    ResponseEntity<PreprocessResponse> sendVideoToCut(String minioKey);
}
