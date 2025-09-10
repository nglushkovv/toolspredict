package com.lctproject.toolspredict.service.impl;

import com.lctproject.toolspredict.dto.ClassificationRequest;
import com.lctproject.toolspredict.dto.InferenceRequest;
import com.lctproject.toolspredict.dto.ClassificationResponse;
import com.lctproject.toolspredict.dto.PreprocessResponse;
import com.lctproject.toolspredict.service.SenderService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

import java.util.List;

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
    public ResponseEntity<PreprocessResponse> sendToPreprocess(String minioKey) {
        try {
            log.info("Отправка ключа файла в сервис предобработки...");
            String url = UriComponentsBuilder.fromUriString(preprocessServiceUrl + "/preprocess")
                    .queryParam("key", minioKey)
                    .toUriString();
            ResponseEntity<PreprocessResponse> response = restTemplate.postForEntity(url, null, PreprocessResponse.class);
            if (response.getStatusCode().is2xxSuccessful()) {
                log.info("Файл с ключем {} успешно обработан.", minioKey);
                return ResponseEntity.ok(response.getBody());
            } else {
                log.warn("Предобработка вернула статус {}", response.getStatusCode());
                PreprocessResponse errorBody = new PreprocessResponse();
                errorBody.setStatus("error");
                errorBody.setMessage("Предобработка вернула статус: " + response.getStatusCode());
                return ResponseEntity.status(response.getStatusCode()).body(errorBody);
            }
        } catch (RestClientException e) {
            log.error("Ошибка отправки файла на предобработку: {}", e.getMessage());
            PreprocessResponse errorBody = new PreprocessResponse();
            errorBody.setStatus("error");
            errorBody.setMessage("Ошибка отправки файла на предобработку: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(errorBody);
        }
    }

    @Override
    public ResponseEntity<ClassificationResponse> sendToInference(ClassificationRequest request) {
        try {
            ResponseEntity<ClassificationResponse> response = restTemplate.postForEntity(inferenceServiceUrl + "/classify",
                    request, ClassificationResponse.class);
            if (response.getStatusCode().is2xxSuccessful()) {
                log.info("Успешно получены микроклассы от inference-сервиса");
                return response;
            } else {
                return ResponseEntity.status(response.getStatusCode()).body(response.getBody());
            }
        } catch (RestClientException e) {
            log.error("Ошибка отправки пакета ключей файлов на классификацию: {}", e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    @Override
    public ResponseEntity<PreprocessResponse> sendVideoToCut(String minioKey) {
        try {
            log.info("Отправка ключа видеофайла на разделение по кадрам");
            String url = UriComponentsBuilder.fromUriString(preprocessServiceUrl + "/video/cut")
                    .queryParam("key", minioKey)
                    .toUriString();
            ResponseEntity<PreprocessResponse> response = restTemplate.postForEntity(url, null, PreprocessResponse.class);
            if (response.getStatusCode().is2xxSuccessful()) {
                log.info("Файл с ключем {} успешно разделен по кадрам.", minioKey);
                return ResponseEntity.ok(response.getBody());
            } else {
                log.warn("Предобработка видео вернула статус {}", response.getStatusCode());
                PreprocessResponse errorBody = new PreprocessResponse();
                errorBody.setStatus("error");
                errorBody.setMessage("Предобработка видео вернула статус: " + response.getStatusCode());
                return ResponseEntity.status(response.getStatusCode()).body(errorBody);
            }
        } catch (RestClientException e) {
            log.error("Ошибка отправки видеофайла на разеделение по кадрам: {}", e.getMessage());
            PreprocessResponse errorBody = new PreprocessResponse();
            errorBody.setStatus("error");
            errorBody.setMessage("Ошибка отправки видеофайла на предобработку: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(errorBody);
        }
    }

}
