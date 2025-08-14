package com.lctproject.toolspredict.kafka;

import com.lctproject.toolspredict.model.minio.MinioEventDto;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

@Component
public class ProcessedListener {
    private static final Logger log = LoggerFactory.getLogger(ProcessedListener.class);

    @KafkaListener(
            topics = "${integration.topics.processed}",
            groupId = "processed-group"
    )
    void listen(MinioEventDto eventDto) {
        log.info(eventDto.getKey());
    }


}
