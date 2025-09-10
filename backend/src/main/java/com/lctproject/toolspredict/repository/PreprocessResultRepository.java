package com.lctproject.toolspredict.repository;

import com.lctproject.toolspredict.model.Job;
import com.lctproject.toolspredict.model.MinioFile;
import com.lctproject.toolspredict.model.PreprocessResult;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface PreprocessResultRepository extends JpaRepository<PreprocessResult, Long> {
    List<PreprocessResult> findByJob(Job job);

    @Query(nativeQuery = true,
    value = "select * from public.preprocess_result where file_id = :raw_file_id and original_file_id = :original_file_id")
    PreprocessResult findByFileAndOriginalFile(@Param("raw_file_id") Long processedFileId, @Param("original_file_id") Long rawFileId);
}
