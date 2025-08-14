package com.lctproject.toolspredict.repository;

import com.lctproject.toolspredict.model.minio.MinioFile;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface MinioFileRepository extends JpaRepository<MinioFile,Long> {
}
