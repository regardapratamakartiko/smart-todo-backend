package com.todo.controller;

import com.todo.model.Task;
import com.todo.repository.TaskRepository;
import jakarta.servlet.http.HttpServletResponse;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import java.io.IOException;
import java.util.List;

@RestController
@RequestMapping("/api/tasks")
public class TaskController {
    private final TaskRepository taskRepository;

    public TaskController(TaskRepository taskRepository) {
        this.taskRepository = taskRepository;
    }

    private String getUsername() {
        return SecurityContextHolder.getContext().getAuthentication().getName();
    }

    @GetMapping
    public List<Task> getAll() {
        return taskRepository.findByUsername(getUsername());
    }

    @PostMapping
    public Task create(@RequestBody Task task) {
        task.setUsername(getUsername());
        task.setCompleted(false);
        return taskRepository.save(task);
    }

    @PutMapping("/{id}")
    public ResponseEntity<Task> update(@PathVariable String id, @RequestBody Task taskDetails) {
        return taskRepository.findById(id)
                .map(task -> {
                    task.setTitle(taskDetails.getTitle());
                    task.setDurationMinutes(taskDetails.getDurationMinutes());
                    task.setCategory(taskDetails.getCategory());
                    task.setMatrix(taskDetails.getMatrix());
                    task.setDueDate(taskDetails.getDueDate());
                    return ResponseEntity.ok(taskRepository.save(task));
                }).orElse(ResponseEntity.notFound().build());
    }

    @PutMapping("/{id}/toggle")
    public ResponseEntity<Void> toggle(@PathVariable String id) {
        return taskRepository.findById(id)
                .map(task -> {
                    task.setCompleted(!task.isCompleted());
                    taskRepository.save(task);
                    return ResponseEntity.ok().<Void>build();
                }).orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable String id) {
        if (taskRepository.existsById(id)) {
            taskRepository.deleteById(id);
            return ResponseEntity.ok().build();
        }
        return ResponseEntity.notFound().build();
    }

    @DeleteMapping("/reset")
    @Transactional
    public ResponseEntity<String> resetAll() {
        taskRepository.deleteByUsername(getUsername());
        return ResponseEntity.ok("Database cleared!");
    }

    @GetMapping("/export-excel")
    public void exportToExcel(HttpServletResponse response) throws IOException {
        List<Task> tasks = taskRepository.findByUsername(getUsername());

        Workbook workbook = new XSSFWorkbook();
        Sheet sheet = workbook.createSheet("Task OS - Quest Logs");

        String[] headers = {"ID", "Judul Tugas", "Durasi (Menit)", "Kategori", "Matriks Prioritas", "Batas Waktu", "Status"};
        Row headerRow = sheet.createRow(0);
        for (int i = 0; i < headers.length; i++) {
            Cell cell = headerRow.createCell(i);
            cell.setCellValue(headers[i]);
        }

        int rowIdx = 1;
        for (Task task : tasks) {
            Row row = sheet.createRow(rowIdx++);
            row.createCell(0).setCellValue(task.getId());
            row.createCell(1).setCellValue(task.getTitle());
            row.createCell(2).setCellValue(task.getDurationMinutes());
            row.createCell(3).setCellValue(task.getCategory());
            row.createCell(4).setCellValue(task.getMatrix());
            row.createCell(5).setCellValue(task.getDueDate() != null ? task.getDueDate().toString() : "");
            row.createCell(6).setCellValue(task.isCompleted() ? "SELESAI" : "PENDING");
        }

        response.setContentType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        response.setHeader("Content-Disposition", "attachment; filename=tasks_report.xlsx");
        workbook.write(response.getOutputStream());
        workbook.close();
    }
}