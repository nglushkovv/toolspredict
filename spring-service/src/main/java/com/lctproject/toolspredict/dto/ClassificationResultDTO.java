package com.lctproject.toolspredict.dto;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.Accessors;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Accessors(chain = true)
public class ClassificationResultDTO {
    @JsonProperty("object_key")
    private String objectKey;
    private Double confidence;
    @JsonIgnore
    private String marking;
}
