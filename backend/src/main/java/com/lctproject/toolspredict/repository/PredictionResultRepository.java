package com.lctproject.toolspredict.repository;

import com.lctproject.toolspredict.model.Job;
import com.lctproject.toolspredict.model.PredictionResult;
import com.lctproject.toolspredict.model.ToolOrderItem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Repository
public interface PredictionResultRepository extends JpaRepository<PredictionResult, Long> {
    List<PredictionResult> findByJob(Job job);

    @Modifying
    @Transactional
    void deleteByJob(Job job);

    @Query(value = """
          SELECT tool_id, MAX(tool_count) AS count_per_tool
                FROM (
            SELECT psr.original_file_id,
                   pr.tool_id,
                   COUNT(*) AS tool_count
            FROM prediction_result pr
                     JOIN preprocess_result psr ON pr.preprocess_result_id = psr.id
            WHERE pr.job_id = :jobId
            GROUP BY psr.original_file_id, pr.tool_id
                ) AS per_file
                GROUP BY tool_id;
       """, nativeQuery = true)
    List<Object[]> findMaxToolCountPerJob(@Param("jobId") Long jobId);
}
