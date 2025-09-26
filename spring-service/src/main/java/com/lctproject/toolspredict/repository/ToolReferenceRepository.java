package com.lctproject.toolspredict.repository;

import com.lctproject.toolspredict.model.ToolReference;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface ToolReferenceRepository extends JpaRepository<ToolReference, Integer> {

    ToolReference findByToolName(String toolReferenceName);
}
