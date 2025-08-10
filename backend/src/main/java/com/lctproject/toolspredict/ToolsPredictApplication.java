package com.lctproject.toolspredict;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.kafka.annotation.EnableKafka;

@SpringBootApplication
@EnableKafka
public class ToolsPredictApplication {

	public static void main(String[] args) {
		SpringApplication.run(ToolsPredictApplication.class, args);
	}

}
