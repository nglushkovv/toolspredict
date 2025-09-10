package com.lctproject.toolspredict.controller;

import com.lctproject.toolspredict.repository.ToolRepository;
import com.lctproject.toolspredict.service.ToolService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/tools")
@Tag(name="Управление инструментами", description = "API ToolsPredict")
public class ToolController {

    private final ToolService toolService;

    public ToolController(ToolService toolService) {
        this.toolService = toolService;
    }

    @CrossOrigin
    @GetMapping("/{toolId}")
    @Operation(summary = "Вывести информацию об инструменте")
    public ResponseEntity<?> get(@PathVariable Long toolId) {
        return ResponseEntity.ok(toolService.getTool(toolId));
    }
    @CrossOrigin
    @GetMapping
    @Operation(summary = "Вывести все инструменты")
    public ResponseEntity<?> getAll() {
        return ResponseEntity.ok(toolService.getAllTools());
    }
}
