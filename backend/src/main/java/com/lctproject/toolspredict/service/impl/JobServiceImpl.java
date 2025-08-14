package com.lctproject.toolspredict.service.impl;

import com.lctproject.toolspredict.model.Job;
import com.lctproject.toolspredict.repository.ProcessingJobsRepository;
import com.lctproject.toolspredict.service.JobService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;

@Service
@RequiredArgsConstructor
public class JobServiceImpl implements JobService {
    private final ProcessingJobsRepository processingJobsRepository;

    @Override
    public Job createJob() {
        Job job = new Job()
                .setStatus("Предобработка CV")
                .setCreate_date(LocalDateTime.now())
                .setLast_modified(LocalDateTime.now());
        return job;
    }

    @Override
    public Job getJob(Long jobId) {
        return processingJobsRepository.findById(jobId);
    }
}
