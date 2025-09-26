package com.lctproject.toolspredict.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.Map;

@Data
@AllArgsConstructor
@NoArgsConstructor
public class PreprocessResponse {
    private String status;
    private Map<String, String> preprocessResults; //macroClass: minioKey
    private List<String> size;
    private String message;
}
