package com.lctproject.toolspredict.model;

import jakarta.persistence.*;
import lombok.Data;
import lombok.experimental.Accessors;

import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "prediction_result", schema = "public")
@Accessors(chain = true)
public class PredictionResult {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @ManyToOne
    @JoinColumn(name = "job_id")
    private Job job;
    @ManyToOne
    @JoinColumn(name = "tool_id")
    private Tool tool;
    @ManyToOne
    @JoinColumn(name = "file_id")
    private MinioFile file;
    @OneToOne
    @JoinColumn(name = "preprocess_result_id")
    private PreprocessResult preprocessResult;
    @Column(name = "confidence")
    private Double confidence;
    @Column(name = "created_at")
    private LocalDateTime createdAt;
    @Column(name = "marking")
    private String marking;
}
