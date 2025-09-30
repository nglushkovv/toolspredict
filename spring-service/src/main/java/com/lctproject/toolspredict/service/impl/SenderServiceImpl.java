package com.lctproject.toolspredict.service.impl;

import com.lctproject.toolspredict.dto.*;
import com.lctproject.toolspredict.service.SenderService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.*;
import org.springframework.web.util.UriComponentsBuilder;

import java.util.NoSuchElementException;

@Slf4j
@Service
public class SenderServiceImpl implements SenderService {
    private final RestTemplate restTemplate;
    @Value("${integrations.services.url.preprocess}")
    private String preprocessServiceUrl;
    @Value("${integrations.services.url.inference}")
    private String inferenceServiceUrl;

    public SenderServiceImpl() {
        this.restTemplate = new RestTemplate();
    }

    @Override
    public ResponseEntity<ClassificationResponseDTO> sendToRecognition(String minioKey) {
        try {
            log.info("Отправка ключа файла в сервис предобработки...");
            String url = UriComponentsBuilder.fromUriString(preprocessServiceUrl + "/recognize")
                    .queryParam("key", minioKey)
                    .toUriString();
            ResponseEntity<ClassificationResponseDTO> response = restTemplate.postForEntity(url, null, ClassificationResponseDTO.class);
            if (response.getStatusCode().is2xxSuccessful()) {
                log.info("Файл с ключем {} успешно обработан.", minioKey);
                return ResponseEntity.ok(response.getBody());
            } else {
                log.warn("Предобработка вернула статус {}", response.getStatusCode());
                ClassificationResponseDTO errorBody = new ClassificationResponseDTO();
                errorBody.setStatus("error");
                return ResponseEntity.status(response.getStatusCode()).body(errorBody);
            }
        } catch (HttpClientErrorException.UnprocessableEntity e) {
            throw new NoSuchElementException("Модели не удалось распознать инструменты на фото.");
        } catch (ResourceAccessException e) {
            throw new RuntimeException("Ошибка: не удалось установить соединение с сервисом предобработки.");
        } catch (RestClientException e) {
            log.error("Ошибка отправки файла на предобработку: {}", e.getMessage());
            throw new RuntimeException("Неизвестная ошибка: " + e.getMessage());
        }
    }

    @Override
    public ResponseEntity<EnrichmentResponse> sendToEnrichment(EnrichmentRequest request) {
        try {
            ResponseEntity<EnrichmentResponse> response = restTemplate.postForEntity(inferenceServiceUrl + "/enrich",
                    request, EnrichmentResponse.class);
            if (response.getStatusCode().is2xxSuccessful()) {
                log.info("Успешно получены микроклассы от inference-сервиса");
                return response;
            } else {
                return ResponseEntity.status(response.getStatusCode()).body(response.getBody());
            }
        } catch (ResourceAccessException e) {
            throw new RuntimeException("Ошибка: не удалось установить соединение с сервисом классификации");
        } catch (RestClientException e) {
            log.error("Ошибка отправки пакета ключей файлов на классификацию: {}", e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    @Override
    public ResponseEntity<FrameResponse> sendVideoToCut(String minioKey) {
        try {
            log.info("Отправка ключа видеофайла на разделение по кадрам");
            String url = UriComponentsBuilder.fromUriString(preprocessServiceUrl + "/video/cut")
                    .queryParam("key", minioKey)
                    .toUriString();
            ResponseEntity<FrameResponse> response = restTemplate.postForEntity(url, null, FrameResponse.class);
            if (response.getStatusCode().is2xxSuccessful()) {
                log.info("Файл с ключем {} успешно разделен по кадрам.", minioKey);
                return ResponseEntity.ok(response.getBody());
            } else {
                log.warn("Предобработка видео вернула статус {}", response.getStatusCode());
                FrameResponse errorBody = new FrameResponse();
                errorBody.setStatus("error");
                errorBody.setMessage("Предобработка видео вернула статус: " + response.getStatusCode());
                return ResponseEntity.status(response.getStatusCode()).body(errorBody);
            }
        } catch (ResourceAccessException  e) {
            throw new RuntimeException("Ошибка: не удалось установить соединение с сервисом предобработки");
        } catch (RestClientException e) {
            log.error("Ошибка отправки видеофайла на разеделение по кадрам: {}", e.getMessage());
            throw new RuntimeException("Неизвестная ошибка: " + e.getMessage());
        }
    }

}
