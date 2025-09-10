package com.lctproject.toolspredict.service.impl;

import com.lctproject.toolspredict.model.Job;
import com.lctproject.toolspredict.model.Order;
import com.lctproject.toolspredict.model.ToolOrderItem;
import com.lctproject.toolspredict.repository.AccountingRepository;
import com.lctproject.toolspredict.repository.PredictionResultRepository;
import com.lctproject.toolspredict.repository.ToolOrderItemRepository;
import com.lctproject.toolspredict.service.ComparsionService;
import com.lctproject.toolspredict.service.JobService;
import com.lctproject.toolspredict.service.OrderService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;

import java.util.Collections;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class ComparsionServiceImpl implements ComparsionService {
    private final PredictionResultRepository predictionResultRepository;
    private final ToolOrderItemRepository toolOrderItemRepository;
    private final AccountingRepository accountingRepository;
    private final JobService jobService;
    private final OrderService orderService;
    @Value("${model.confidence.threshold}")
    private Double CONFIDENCE_THRESHOLD;

    @Override
    public ResponseEntity<?> compareResults(Job job) {
        Order order = accountingRepository.findByJob(job).getOrder();
        List<ToolOrderItem> orderedItems = toolOrderItemRepository.findByOrder(order);
        List<Long> predictedToolList = getMergedToolList(job.getId()).stream().sorted().toList();
        List<Long> orderedToolList = orderedItems.stream()
                .map(item -> item.getTool().getId()).sorted()
                .toList();

        boolean isEqual = predictedToolList.equals(orderedToolList);

        if (isEqual) {
            jobService.updateStatus(job.getId(), "FINISHED");
            return ResponseEntity.ok("Полное совпадение с заказанным набором.");
        } else {
            jobService.updateStatus(job.getId(), "FAILED. MANUAL MAPPING IS REQUIRED");
            return ResponseEntity.ok("Обнаружены расхождения. Требуется ручная разметка.");
        }
    }

    private List<Long> getMergedToolList(Long jobId) {
        return predictionResultRepository.findMaxToolCountPerJob(jobId).stream()
                .flatMap(row -> {
                    Long toolId = ((Number) row[0]).longValue();
                    int count = ((Number) row[1]).intValue();
                    return Collections.nCopies(count, toolId).stream();
                })
                .toList();
    }

}
