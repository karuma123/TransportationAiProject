package com.example.logistics.controller;

import com.example.logistics.entity.AnomalyEvent;
import com.example.logistics.entity.GpsPoint;
import com.example.logistics.service.RealtimeAnalysisService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@CrossOrigin(origins = "*")
@RestController
@RequestMapping("/api/realtime")
public class RealtimeGpsController {

    private static final Logger logger = LoggerFactory.getLogger(RealtimeGpsController.class);

    private final RealtimeAnalysisService analysisService;

    public RealtimeGpsController(RealtimeAnalysisService analysisService) {
        this.analysisService = analysisService;
    }

    /**
     * Receive a real-time GPS data point from a vehicle/simulator.
     */
    @PostMapping("/gps")
    public ResponseEntity<Map<String, Object>> receiveGpsPoint(@RequestBody Map<String, Object> pointData) {
        try {
            Map<String, Object> result = analysisService.ingestGpsPoint(pointData);
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            logger.error("Error processing GPS point: {}", e.getMessage());
            return ResponseEntity.internalServerError()
                    .body(Map.of("error", e.getMessage()));
        }
    }

    /**
     * Get the latest GPS position for all vehicles.
     */
    @GetMapping("/positions")
    public ResponseEntity<List<GpsPoint>> getLatestPositions() {
        return ResponseEntity.ok(analysisService.getLatestPositions());
    }

    /**
     * Get recent anomaly events.
     */
    @GetMapping("/anomalies")
    public ResponseEntity<List<AnomalyEvent>> getRecentAnomalies() {
        return ResponseEntity.ok(analysisService.getRecentAnomalies());
    }

    /**
     * Get active (unacknowledged) alerts.
     */
    @GetMapping("/alerts")
    public ResponseEntity<List<AnomalyEvent>> getActiveAlerts() {
        return ResponseEntity.ok(analysisService.getActiveAlerts());
    }

    /**
     * Get dashboard statistics.
     */
    @GetMapping("/dashboard")
    public ResponseEntity<Map<String, Object>> getDashboard() {
        return ResponseEntity.ok(analysisService.getDashboardStats());
    }

    /**
     * Health check for the real-time system.
     */
    @GetMapping("/health")
    public ResponseEntity<Map<String, Object>> health() {
        return ResponseEntity.ok(Map.of(
            "status", "OK",
            "service", "Real-Time GPS Monitoring",
            "endpoints", List.of(
                "POST /api/realtime/gps",
                "GET /api/realtime/positions",
                "GET /api/realtime/anomalies",
                "GET /api/realtime/alerts",
                "GET /api/realtime/dashboard"
            )
        ));
    }
}
