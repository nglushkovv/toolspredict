package com.lctproject.toolspredict.kafka;

import com.lctproject.toolspredict.model.minio.RecordsDto;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

@Component
public class RawListener {
    private static final Logger log = LoggerFactory.getLogger(ProcessedListener.class);

    @KafkaListener(
            topics = "${integration.topics.raw}",
            groupId = "raw-group"
    )
    void listen(RecordsDto recordsDto) {
        log.info(recordsDto.getRecords().get(0).getS3().getKey().getKey());
    }
}
