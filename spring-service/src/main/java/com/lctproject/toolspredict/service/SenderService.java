package com.lctproject.toolspredict.service;

import com.lctproject.toolspredict.dto.EnrichmentRequest;
import com.lctproject.toolspredict.dto.EnrichmentResponse;
import com.lctproject.toolspredict.dto.FrameResponse;
import org.springframework.http.ResponseEntity;

public interface SenderService {
    ResponseEntity<?> sendToRecognition(String minioKey);

    ResponseEntity<EnrichmentResponse> sendToEnrichment(EnrichmentRequest request);

    ResponseEntity<FrameResponse> sendVideoToCut(String minioKey);
}
