package com.todo.controller;

import com.todo.model.User;
import com.todo.repository.UserRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;
import java.util.Map;

@RestController
@RequestMapping("/api")
public class AuthController {
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    public AuthController(UserRepository userRepository, PasswordEncoder passwordEncoder) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
    }

    @PostMapping("/register")
    public ResponseEntity<String> register(@RequestBody Map<String, String> payload) {
        String username = payload.get("username");
        String password = payload.get("password");

        if (userRepository.findByUsername(username).isPresent()) {
            return ResponseEntity.badRequest().body("Username sudah terdaftar!");
        }

        User user = new User();
        user.setUsername(username);
        user.setPassword(passwordEncoder.encode(password));
        userRepository.save(user);

        return ResponseEntity.ok("Registrasi Berhasil!");
    }

    @GetMapping("/user/me")
    public ResponseEntity<String> getCurrentUser() {
        String name = SecurityContextHolder.getContext().getAuthentication().getName();
        if (name == null || name.equals("anonymousUser")) {
            return ResponseEntity.status(401).body("Unauthorized");
        }
        return ResponseEntity.ok(name);
    }
}