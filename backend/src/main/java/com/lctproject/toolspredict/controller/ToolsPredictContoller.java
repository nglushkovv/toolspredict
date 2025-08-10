package com.lctproject.toolspredict.controller;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.data.domain.Page;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/v1")
@Tag(name="Учёт инструментов при выдаче и приёме", description = "API ToolsPredict")
public class ToolsPredictContoller {

    @CrossOrigin
    @PostMapping(value = "/uploadToolkitFile", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "Загрузка файла для последующей обработки CV и присвоения категории набору инструментов.")
    public ResponseEntity<String> uploadFile(@Parameter(description = "Фото/Видео для обработки и построения прогноза")
                                             @RequestParam("file") MultipartFile file) {
        return ResponseEntity.ok("Ну тут короче можно idшник операции вернуть");
    }

    @CrossOrigin
    @GetMapping(value = "/getToolkitResult")
    @Operation(summary = "Получить результат прогноза")
    public ResponseEntity<String> getPredictResult(@Parameter(description = "ID операции")
                                                   @RequestParam("id") Long id) {
        return ResponseEntity.ok("Результат / Статус операции");
    }

    @CrossOrigin
    @GetMapping("/getToolkitPages")
    @Operation(summary = "Получить страницу списка процессов обработки и прогнозов")
    public Page<String> getToolkitPage(@Parameter(description = "Фильтрация")
                                       @RequestParam("query") String query,
                                       @Parameter(description = "Номер страницы")
                                       @RequestParam("page") int page,
                                       @Parameter(description = "Размер страницы")
                                       @RequestParam("size") int size) {
        return null;
    }
}
