package com.lctproject.toolspredict.service.impl;

import com.lctproject.toolspredict.dto.JobStatus;
import com.lctproject.toolspredict.model.*;
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

import java.util.*;
import java.util.stream.Collectors;

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
        List<PredictionResult> results = getMergedResults(job.getId());
        List<Long> predictedToolList = results.stream()
                .map(pr -> pr.getTool().getId())
                .toList();

        List<Long> orderedToolList = orderedItems.stream()
                .map(item -> item.getTool().getId()).sorted()
                .toList();

        boolean isEqual = predictedToolList.equals(orderedToolList);

        if (isEqual) {
            return ResponseEntity.ok("Полное совпадение с заказанным набором.");
        } else {
            jobService.updateStatus(job.getId(), JobStatus.MANUAL_MAPPING_IS_REQUIRED);
            return ResponseEntity.ok("Обнаружены расхождения. Требуется ручная разметка.");
        }
    }

    @Override
    @Deprecated
    public List<Long> getMergedToolList(Long jobId) {
        return predictionResultRepository.findMaxToolCountPerJob(jobId).stream()
                .flatMap(row -> {
                    Long toolId = ((Number) row[0]).longValue();
                    int count = ((Number) row[1]).intValue();
                    return Collections.nCopies(count, toolId).stream();
                })
                .toList();
    }


    public Map<Long, List<PredictionResult>> getPredictionResultsGroupedByOriginalFile(Job job) {
        return predictionResultRepository.findAllByJobIdOrderByToolId(job.getId()).stream()
                .collect(Collectors.groupingBy(
                        pr -> pr.getPreprocessResult().getOriginalFile().getId(),
                        LinkedHashMap::new,
                        Collectors.collectingAndThen(
                                Collectors.<PredictionResult>toList(),
                                list -> list.stream()
                                        .sorted(Comparator.comparing(pr -> pr.getTool().getId()))
                                        .toList()
                        )
                ));
    }

    public List<PredictionResult> mergeByMaxOccurrences(Map<Long, List<PredictionResult>> groupedByOriginalFile) {
        Map<Long, List<PredictionResult>> resultMap = new HashMap<>();

        for (List<PredictionResult> list : groupedByOriginalFile.values()) {
            log.info(String.valueOf(list));
            Map<Long, List<PredictionResult>> groupedByTool = list.stream()
                    .collect(Collectors.groupingBy(pr -> pr.getTool().getId()));

            for (Map.Entry<Long, List<PredictionResult>> entry : groupedByTool.entrySet()) {
                long toolId = entry.getKey();
                List<PredictionResult> items = entry.getValue();

                if (!resultMap.containsKey(toolId) || items.size() > resultMap.get(toolId).size()) {
                    resultMap.put(toolId, items);
                }
            }
        }
        List<PredictionResult> finalResult = resultMap.values().stream()
                .flatMap(List::stream)
                .sorted(Comparator.comparing(pr -> pr.getTool().getId()))
                .collect(Collectors.toList());

        return finalResult;
    }

    @Override
    public List<PredictionResult> getMergedResults(Long jobId) {
        Map<Long, List<PredictionResult>> groupedByOriginalFile = getPredictionResultsGroupedByOriginalFile(jobService.getJob(jobId));
        return mergeByMaxOccurrences(groupedByOriginalFile);
    }


}
