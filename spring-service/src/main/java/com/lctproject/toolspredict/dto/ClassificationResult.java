package com.lctproject.toolspredict.dto;

import lombok.Data;

@Data
public class ClassificationResult {
    private String macroclass;
    private Integer macroclassId;
    private String microclass;
    private Double confidence;
}