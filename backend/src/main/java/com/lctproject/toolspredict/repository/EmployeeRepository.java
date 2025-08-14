package com.lctproject.toolspredict.repository;

import com.lctproject.toolspredict.model.Employee;
import org.springframework.data.jpa.repository.JpaRepository;

public interface EmployeeRepository extends JpaRepository<Employee, Long> {
}
