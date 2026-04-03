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
        String role = normalizeRole(request.getRole());

        if (("CUSTOMER".equals(role) || "DRIVER".equals(role))
                && (request.getMobileNumber() == null || request.getMobileNumber().isBlank())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Mobile number is required");
        }
        if (("CUSTOMER".equals(role) || "DRIVER".equals(role))
                && (request.getAddress() == null || request.getAddress().isBlank())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Address is required");
        }
        if (("CUSTOMER".equals(role) || "DRIVER".equals(role))
                && (request.getIdProofImage() == null || request.getIdProofImage().isBlank())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "ID proof image is required");
        }
        if (("CUSTOMER".equals(role) || "DRIVER".equals(role))
                && (request.getProfileImage() == null || request.getProfileImage().isBlank())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Profile image is required");
        }

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
        user.setRole(role);
        user.setMobileNumber(
            request.getMobileNumber() == null || request.getMobileNumber().isBlank()
                ? null
                : request.getMobileNumber().trim()
        );
        user.setAddress(
            request.getAddress() == null || request.getAddress().isBlank()
                ? null
                : request.getAddress().trim()
        );
        user.setIdProofImage(
            request.getIdProofImage() == null || request.getIdProofImage().isBlank()
                ? null
                : request.getIdProofImage().trim()
        );
        user.setProfileImage(
            request.getProfileImage() == null || request.getProfileImage().isBlank()
                ? null
                : request.getProfileImage().trim()
        );
        AppUser saved = appUserRepository.save(user);

        return toAuthResponse(saved, null);
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

        return toAuthResponse(user, token);
    }

    public Map<String, Object> profile(String username) {
        AppUser user = appUserRepository.findByUsername(username)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));
        return toAuthResponse(user, null);
    }

    public Map<String, Object> profileImages(String username) {
        AppUser user = appUserRepository.findByUsername(username)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));

        Map<String, Object> result = new HashMap<>();
        result.put("idProofImage", user.getIdProofImage());
        result.put("profileImage", user.getProfileImage());
        return result;
    }

    private Map<String, Object> toAuthResponse(AppUser user, String token) {
        Map<String, Object> result = new HashMap<>();
        if (token != null && !token.isBlank()) {
            result.put("token", token);
        }
        result.put("userId", user.getId());
        result.put("username", user.getUsername());
        result.put("fullName", user.getFullName());
        result.put("role", user.getRole());
        result.put("mobileNumber", user.getMobileNumber());
        result.put("address", user.getAddress());
        result.put("hasIdProofImage", user.getIdProofImage() != null && !user.getIdProofImage().isBlank());
        result.put("hasProfileImage", user.getProfileImage() != null && !user.getProfileImage().isBlank());
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
