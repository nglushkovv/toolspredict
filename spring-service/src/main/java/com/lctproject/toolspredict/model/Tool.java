package com.lctproject.toolspredict.model;

import jakarta.persistence.*;
import lombok.Data;

@Data
@Entity
@Table(name = "tool", schema = "public")
public class Tool {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(name="tool_name")
    private String name;
    @ManyToOne
    @JoinColumn(name = "tool_reference_id")
    private ToolReference toolReference;
}
