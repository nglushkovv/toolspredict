package com.lctproject.toolspredict.model;

import jakarta.persistence.*;
import lombok.Data;

@Data
@Entity
@Table(name = "tool_reference", schema = "public")
public class ToolReference {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;
    @Column(name="tool_reference_name")
    private String toolName;
}
