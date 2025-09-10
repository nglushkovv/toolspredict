package com.lctproject.toolspredict.dto;

import lombok.Data;
import lombok.experimental.Accessors;

import java.util.List;
import java.util.Map;

@Data
@Accessors(chain = true)
public class ClassificationRequest {
    Map<String, List<String>> packages;
}
