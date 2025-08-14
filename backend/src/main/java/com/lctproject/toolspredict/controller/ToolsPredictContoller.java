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
    @PostMapping(value = "/uploadFile", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "Загрузка файла для последующей обработки CV и присвоения категории набору инструментов.")
    public ResponseEntity<String> uploadFile(@Parameter(description = "Фото/Видео для обработки и построения прогноза")
                                             @RequestParam("file") MultipartFile file,
                                             @Parameter(description = "id процесса")
                                             @RequestParam(value = "id", required = false) Long jobId) {
        return ResponseEntity.ok("Ну тут короче можно idшник операции вернуть");
    }

    @CrossOrigin
    @GetMapping(value = "/getJobInfo")
    @Operation(summary = "Получить результат прогноза")
    public ResponseEntity<String> getJobInfo(@Parameter(description = "ID операции")
                                                   @RequestParam("id") Long jobId) {
        return ResponseEntity.ok("Результат / Статус операции");
    }

    @CrossOrigin
    @GetMapping("/getJobPage")
    @Operation(summary = "Получить страницу списка процессов обработки и прогнозов")
    public Page<String> getJobPage(@Parameter(description = "Фильтрация")
                                       @RequestParam("query") String query,
                                       @Parameter(description = "Номер страницы")
                                       @RequestParam("page") int page,
                                       @Parameter(description = "Размер страницы")
                                       @RequestParam("size") int size) {
        return null;
    }

    @CrossOrigin
    @DeleteMapping("/deleteJob")
    @Operation(summary = "Удалить процесс")
    public void deleteJob(@Parameter(description = "Удалить существующий job")
                          @RequestParam Long jobId) {
        return;
    }

    @CrossOrigin
    @DeleteMapping("/deleteFile")
    @Operation(summary = "Удалить файл из MiniO")
    public void deleteFile(@Parameter(description = "id_файла")
                           @RequestParam Long fileId) {
        return;
    }
}
