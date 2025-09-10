package com.lctproject.toolspredict.repository;

import com.lctproject.toolspredict.model.Tool;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ToolRepository extends JpaRepository<Tool, Long> {
    Tool findByName(String microclass);
}
