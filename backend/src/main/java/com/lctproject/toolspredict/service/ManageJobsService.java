package com.lctproject.toolspredict.service;

import org.springframework.web.multipart.MultipartFile;

public interface ManageJobsService {
    void addRawFile(MultipartFile file, Long jobId);
}
