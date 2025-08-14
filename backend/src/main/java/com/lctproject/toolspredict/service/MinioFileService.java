package com.lctproject.toolspredict.service;

import com.lctproject.toolspredict.model.Job;
import com.lctproject.toolspredict.model.minio.MinioEventDto;

public interface MinioFileService {
    void create(String key, Job job);
}
