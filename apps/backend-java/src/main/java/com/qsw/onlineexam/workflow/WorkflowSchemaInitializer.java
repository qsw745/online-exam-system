package com.qsw.onlineexam.workflow;

import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

@Component
public class WorkflowSchemaInitializer implements ApplicationRunner {
  private final WorkflowRepository repository;

  public WorkflowSchemaInitializer(WorkflowRepository repository) {
    this.repository = repository;
  }

  @Override
  public void run(ApplicationArguments args) {
    repository.ensureEngineColumns();
  }
}
