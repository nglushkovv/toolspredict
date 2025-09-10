package com.lctproject.toolspredict.service.impl;

import com.lctproject.toolspredict.model.Order;
import com.lctproject.toolspredict.model.Tool;
import com.lctproject.toolspredict.model.ToolOrderItem;
import com.lctproject.toolspredict.repository.ToolOrderItemRepository;
import com.lctproject.toolspredict.repository.ToolReferenceRepository;
import com.lctproject.toolspredict.repository.ToolRepository;
import com.lctproject.toolspredict.service.ToolService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class ToolServiceImpl implements ToolService {

    private final ToolOrderItemRepository toolOrderItemRepository;
    private final ToolReferenceRepository toolReferenceRepository;
    private final ToolRepository toolRepository;

    @Override
    public void addToolOrderItem(Long toolId, Order order) {
        ToolOrderItem toolOrderItem = new ToolOrderItem()
                .setOrder(order)
                .setTool(toolRepository.findById(toolId).orElseThrow());
        toolOrderItemRepository.save(toolOrderItem);
    }

    @Override
    public void changeToolOrderItems(UUID orderId, List<Long> smallerToolsList) {
        try {
            List<Long> currToolOrderItemList = toolOrderItemRepository.
                    findToolOrderItemsByOrderId(orderId).stream()
                    .map(item -> item.getTool().getId())
                    .toList();
            List<Long> result = new ArrayList<>(currToolOrderItemList);
            for (Long el : smallerToolsList) {
                result.remove(el);
            }
            for (Long el: result) {
                toolOrderItemRepository.deleteOneByOrderIdAndReferenceId(orderId, el);
            }
        } catch (Exception ex) {
            log.error(ex.getMessage());
        }
    }
    @Override
    public Tool getTool(Long id) {
        return toolRepository.findById(id).orElse(null);
    }

    @Override
    public List<Tool> getAllTools() {
        return toolRepository.findAll();
    }

    @Override
    public Page<ToolOrderItem> getToolOrderPage(Order order, int page, int size) {
        int pageSize = Math.min(Math.max(size, 1), 50);
        Pageable pageable = PageRequest.of(page, pageSize, Sort.by("id").descending());
        return toolOrderItemRepository.findAllByOrder(order, pageable);
    }
}
