package com.lctproject.toolspredict.service;

import com.lctproject.toolspredict.dto.ClassificationResponse;
import com.lctproject.toolspredict.dto.PreprocessResponse;
import com.lctproject.toolspredict.model.Job;

public interface LogService {
    void logPreprocessResult(Long jobId, PreprocessResponse preprocessResponse, String rawFileKey);

    void logClassificationResult(ClassificationResponse response, Job job);
}
