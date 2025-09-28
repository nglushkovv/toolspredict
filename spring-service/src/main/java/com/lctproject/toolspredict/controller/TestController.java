package com.lctproject.toolspredict.controller;

import com.lctproject.toolspredict.service.ManageJobsService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.NoSuchElementException;

@CrossOrigin
@RestController
@RequestMapping("/api/v1/test")
@Tag(name="Тест модели", description = "API ToolsPredict")
public class TestController {
    private final ManageJobsService manageJobsService;

    public TestController(ManageJobsService manageJobsService) {
        this.manageJobsService = manageJobsService;
    }

    @PostMapping(value = "/model", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "Загрузка архива фотографий для теста модели")
    public ResponseEntity<?> uploadFile(@Parameter(description = "Загрузка архива")
                                        @RequestParam("file") MultipartFile file) {
        try {
            return manageJobsService.testModels(file);
        } catch (NoSuchElementException ex) {
            ex.printStackTrace();
            return new ResponseEntity<>("Модели не удалось распознать инструменты на фото.", HttpStatus.UNPROCESSABLE_ENTITY);
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }


}
