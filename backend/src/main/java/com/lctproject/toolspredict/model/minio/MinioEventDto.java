package com.lctproject.toolspredict.model.minio;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
public class MinioEventDto {
    private String eventName;
    private String eventVersion;
    private String eventTime;
    private UserIdentityDto userIdentity;
    private S3EntityDto s3;




}
