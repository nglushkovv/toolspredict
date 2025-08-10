package com.lctproject.toolspredict.model.minio;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class S3EntityDto {
    BucketDto bucket;
    ObjectDto key;
}