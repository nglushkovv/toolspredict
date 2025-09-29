package com.lctproject.toolspredict.dto;

import com.fasterxml.jackson.annotation.JsonIgnore;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.Accessors;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Accessors(chain = true)
public class ClassificationResultDTO {
    private String microClass;
    private Double confidence;
    private String bbox;
    @JsonIgnore
    private String rawFileKey;
    @JsonIgnore
    private String marking;
}
