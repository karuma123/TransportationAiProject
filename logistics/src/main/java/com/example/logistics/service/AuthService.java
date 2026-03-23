package com.example.logistics.service;

import java.util.HashMap;
import java.util.Locale;
import java.util.Map;

import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;

import com.example.logistics.config.JwtService;
import com.example.logistics.dto.LoginRequest;
import com.example.logistics.dto.RegisterRequest;
import com.example.logistics.entity.AppUser;
import com.example.logistics.repository.AppUserRepository;

@Service
public class AuthService {

    private final AppUserRepository appUserRepository;
    private final JwtService jwtService;
    private final BCryptPasswordEncoder encoder = new BCryptPasswordEncoder();

    public AuthService(AppUserRepository appUserRepository, JwtService jwtService) {
        this.appUserRepository = appUserRepository;
        this.jwtService = jwtService;
    }

    public Map<String, Object> register(RegisterRequest request) {
        if (request.getUsername() == null || request.getUsername().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Username is required");
        }
        if (request.getPassword() == null || request.getPassword().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Password is required");
        }

        String username = request.getUsername().trim();

        appUserRepository.findByUsername(username)
                .ifPresent(u -> {
                    throw new ResponseStatusException(HttpStatus.CONFLICT, "Username already exists");
                });

        AppUser user = new AppUser();
        user.setUsername(username);
        user.setPasswordHash(encoder.encode(request.getPassword()));
        user.setFullName(
                request.getFullName() == null || request.getFullName().isBlank()
                        ? request.getUsername().trim()
                        : request.getFullName().trim()
        );
        user.setRole(normalizeRole(request.getRole()));
        AppUser saved = appUserRepository.save(user);

        Map<String, Object> result = new HashMap<>();
        result.put("userId", saved.getId());
        result.put("username", saved.getUsername());
        result.put("fullName", saved.getFullName());
        result.put("role", saved.getRole());
        return result;
    }

    public Map<String, Object> login(LoginRequest request) {
        if (request.getUsername() == null || request.getUsername().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Username is required");
        }
        if (request.getPassword() == null || request.getPassword().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Password is required");
        }

        String username = request.getUsername().trim();

        AppUser user = appUserRepository.findByUsername(username)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid username or password"));

        if (!encoder.matches(request.getPassword(), user.getPasswordHash())) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid username or password");
        }

        String token = jwtService.generateToken(user.getId(), user.getUsername(), user.getRole());

        Map<String, Object> result = new HashMap<>();
        result.put("token", token);
        result.put("userId", user.getId());
        result.put("username", user.getUsername());
        result.put("fullName", user.getFullName());
        result.put("role", user.getRole());
        return result;
    }

    private String normalizeRole(String role) {
        if (role == null || role.isBlank()) {
            return "CUSTOMER";
        }
        String normalized = role.trim().toUpperCase(Locale.ROOT);
        if (!normalized.equals("CUSTOMER")
                && !normalized.equals("DRIVER")
                && !normalized.equals("ADMIN")) {
            return "CUSTOMER";
        }
        return normalized;
    }
}
