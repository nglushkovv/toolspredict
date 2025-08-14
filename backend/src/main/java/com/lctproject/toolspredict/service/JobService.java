package com.lctproject.toolspredict.service;

import com.lctproject.toolspredict.model.Job;

public interface JobService {

    Job createJob();

    Job getJob(Long jobId);
}
