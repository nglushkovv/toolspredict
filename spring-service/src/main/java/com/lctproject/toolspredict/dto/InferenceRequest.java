package com.lctproject.toolspredict.dto;

import lombok.Data;
import lombok.experimental.Accessors;

import java.util.List;

@Data
@Accessors(chain = true)
public class InferenceRequest {
    List<String> minioKeys;

}
