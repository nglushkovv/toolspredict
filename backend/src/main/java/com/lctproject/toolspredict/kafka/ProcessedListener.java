package com.lctproject.toolspredict.kafka;

import com.lctproject.toolspredict.model.minio.RecordsDto;
import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.annotation.KafkaHandler;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.kafka.support.KafkaHeaders;
import org.springframework.messaging.handler.annotation.Header;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.stereotype.Component;

@Component
public class ProcessedListener {
    private static final Logger log = LoggerFactory.getLogger(ProcessedListener.class);

    @KafkaListener(
            topics = "${integration.topics.processed}",
            groupId = "processed-group"
    )
    void listen(RecordsDto recordsDto) {
        log.info(recordsDto.getRecords().get(0).getEventName());
    }


}
