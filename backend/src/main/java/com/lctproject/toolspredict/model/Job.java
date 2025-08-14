package com.lctproject.toolspredict.model;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import lombok.experimental.Accessors;

import java.time.LocalDateTime;

@Getter
@Setter
@Entity
@Table(name = "processing_jobs", schema = "public")
@Accessors(chain = true)
public class Job {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @JoinColumn(name = "id")
    @ManyToOne(fetch = FetchType.LAZY)
    private Employee employee_id;
    @Column(name = "status")
    private String status;
    @Column(name = "create_date")
    private LocalDateTime create_date;
    @Column(name = "last_modified")
    private LocalDateTime last_modified;

}
