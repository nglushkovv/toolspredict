package com.lctproject.toolspredict.service;

import com.lctproject.toolspredict.model.Job;
import com.lctproject.toolspredict.model.PredictionResult;
import org.springframework.http.ResponseEntity;

import java.util.List;

public interface ComparsionService {
    ResponseEntity<?> compareResults(Job job);

    List<Long> getMergedToolList(Long jobId);

    List<PredictionResult> getMergedResults(Long jobId);
}
