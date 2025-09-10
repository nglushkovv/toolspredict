package com.lctproject.toolspredict.service;

import com.lctproject.toolspredict.model.Job;
import org.springframework.http.ResponseEntity;

public interface ComparsionService {
    ResponseEntity<?> compareResults(Job job);
}
