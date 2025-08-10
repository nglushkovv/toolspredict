package com.lctproject.toolspredict.model.minio;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.List;

@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
public class RecordsDto {
    @JsonProperty("Records")
    List<MinioEventDto> records;

    public List<MinioEventDto> getRecords() {
        return records;
    }
}
