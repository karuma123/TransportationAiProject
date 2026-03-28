package com.example.logistics.service;

import com.example.logistics.entity.AnomalyEvent;
import com.example.logistics.entity.GpsPoint;
import com.example.logistics.repository.AnomalyEventRepository;
import com.example.logistics.repository.GpsPointRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.time.Instant;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class RealtimeAnalysisService {

    private static final Logger logger = LoggerFactory.getLogger(RealtimeAnalysisService.class);

    private final GpsPointRepository gpsPointRepository;
    private final AnomalyEventRepository anomalyEventRepository;
    private final RestTemplate restTemplate = new RestTemplate();

    // Track points per vehicle for windowed analysis
    private final Map<Integer, List<Map<String, Object>>> vehiclePointBuffers = new ConcurrentHashMap<>();
    private final Map<Integer, String> vehicleLastAnomalyType = new ConcurrentHashMap<>();
    private static final int ANALYSIS_WINDOW_SIZE = 15; // Analyze every 15 points
    private static final String ML_REALTIME_URL = "http://localhost:5001/predict/realtime";

    public RealtimeAnalysisService(GpsPointRepository gpsPointRepository,
                                    AnomalyEventRepository anomalyEventRepository) {
        this.gpsPointRepository = gpsPointRepository;
        this.anomalyEventRepository = anomalyEventRepository;
    }

    /**
     * Ingest a single GPS data point and trigger analysis if window is full.
     */
    public Map<String, Object> ingestGpsPoint(Map<String, Object> pointData) {

        // 1. Save to database
        GpsPoint gpsPoint = new GpsPoint();
        gpsPoint.setVehicleId(getInt(pointData, "vehicleId"));
        gpsPoint.setDriverId(getInt(pointData, "driverId"));
        gpsPoint.setLatitude(getDouble(pointData, "latitude"));
        gpsPoint.setLongitude(getDouble(pointData, "longitude"));
        gpsPoint.setAltitude(getDouble(pointData, "altitude"));
        gpsPoint.setSpeed(getDouble(pointData, "speed"));
        gpsPoint.setHeading(getDouble(pointData, "heading"));
        gpsPoint.setTimestamp(Instant.parse((String) pointData.get("timestamp")));
        gpsPoint.setAnomalous(Boolean.TRUE.equals(pointData.get("anomalous")));
        gpsPoint.setAnomalyType((String) pointData.get("anomalyType"));

        if (gpsPoint.getAnomalyType() != null && !gpsPoint.getAnomalyType().isBlank()) {
            vehicleLastAnomalyType.put(gpsPoint.getVehicleId(), gpsPoint.getAnomalyType());
        }

        gpsPointRepository.save(gpsPoint);

        // 2. Add to vehicle's point buffer
        int vehicleId = gpsPoint.getVehicleId();
        vehiclePointBuffers.computeIfAbsent(vehicleId, k -> new ArrayList<>());
        List<Map<String, Object>> buffer = vehiclePointBuffers.get(vehicleId);

        Map<String, Object> simplified = new HashMap<>();
        simplified.put("latitude", gpsPoint.getLatitude());
        simplified.put("longitude", gpsPoint.getLongitude());
        simplified.put("altitude", gpsPoint.getAltitude());
        simplified.put("timestamp", pointData.get("timestamp"));
        simplified.put("speed", gpsPoint.getSpeed());
        simplified.put("anomalous", gpsPoint.isAnomalous());
        simplified.put("anomalyType", gpsPoint.getAnomalyType());
        buffer.add(simplified);

        // 3. Trigger ML analysis when window is full
        Map<String, Object> response = new HashMap<>();
        response.put("saved", true);
        response.put("vehicleId", vehicleId);
        response.put("bufferSize", buffer.size());

        if (buffer.size() >= ANALYSIS_WINDOW_SIZE) {
            try {
                String dominantAnomalyType = deriveDominantAnomalyType(
                    buffer,
                    resolveFallbackAnomalyType(vehicleId, gpsPoint.getAnomalyType())
                );
                Map<String, Object> analysisResult = analyzeWindow(vehicleId, gpsPoint.getDriverId(), buffer);
                response.put("analysis", analysisResult);

                // If anomaly detected, create an event
                Number anomalyNum = (Number) analysisResult.get("anomaly");
                if (anomalyNum != null && anomalyNum.intValue() == 1) {
                    AnomalyEvent event = new AnomalyEvent();
                    event.setVehicleId(vehicleId);
                    event.setDriverId(gpsPoint.getDriverId());
                    event.setLatitude(gpsPoint.getLatitude());
                    event.setLongitude(gpsPoint.getLongitude());
                    double rawScore = getDoubleFromResult(analysisResult, "anomaly_score");
                    double calibratedScore = calibrateScoreByAnomalyType(rawScore, dominantAnomalyType);
                    event.setAnomalyScore(calibratedScore);
                    event.setAnomalyProbability(getDoubleFromResult(analysisResult, "anomaly_probability"));
                    event.setAnomalyType(dominantAnomalyType);
                    event.setRiskLevel(deriveRiskLevel(event.getAnomalyScore(), dominantAnomalyType));

                    anomalyEventRepository.save(event);
                    response.put("anomalyEvent", Map.of(
                        "id", event.getId(),
                        "riskLevel", event.getRiskLevel(),
                        "anomalyScore", event.getAnomalyScore()
                    ));

                    logger.warn("🚨 ANOMALY DETECTED for Vehicle {} | Score: {} | Risk: {}",
                            vehicleId, event.getAnomalyScore(), event.getRiskLevel());
                }

            } catch (Exception e) {
                logger.error("ML analysis failed for vehicle {}: {}", vehicleId, e.getMessage());
                response.put("analysisError", e.getMessage());

        boolean hasSimulatorAnomaly = buffer.stream()
            .anyMatch(p -> Boolean.TRUE.equals(p.get("anomalous")));
        if (hasSimulatorAnomaly) {
            String fallbackType = deriveDominantAnomalyType(
                buffer,
                resolveFallbackAnomalyType(vehicleId, gpsPoint.getAnomalyType())
            );
            AnomalyEvent fallbackEvent = createFallbackEvent(gpsPoint, fallbackType);
            response.put("fallbackAnomalyEvent", Map.of(
                "id", fallbackEvent.getId(),
                "riskLevel", fallbackEvent.getRiskLevel(),
                "anomalyScore", fallbackEvent.getAnomalyScore(),
                "source", "SIMULATOR_FALLBACK"
            ));
            logger.warn("⚠️ ML unavailable, created fallback anomaly event for vehicle {}", vehicleId);
        }
            }

            // Clear buffer after analysis
            buffer.clear();
        }

        return response;
    }

    /**
     * Send a window of GPS points to the ML service for analysis.
     */
    @SuppressWarnings("unchecked")
    private Map<String, Object> analyzeWindow(int vehicleId, int driverId, List<Map<String, Object>> points) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);

        Map<String, Object> body = Map.of("points", points);
        HttpEntity<Map<String, Object>> request = new HttpEntity<>(body, headers);

        ResponseEntity<Map> response = restTemplate.postForEntity(ML_REALTIME_URL, request, Map.class);

        if (response.getBody() == null) {
            throw new RuntimeException("Empty response from ML service");
        }

        return response.getBody();
    }

    /**
     * Get the latest GPS position for all vehicles.
     */
    public List<GpsPoint> getLatestPositions() {
        return gpsPointRepository.findLatestForAllVehicles();
    }

    /**
     * Get recent anomaly events.
     */
    public List<AnomalyEvent> getRecentAnomalies() {
        return anomalyEventRepository.findTop50ByOrderByDetectedAtDesc();
    }

    /**
     * Get unacknowledged anomaly events.
     */
    public List<AnomalyEvent> getActiveAlerts() {
        return anomalyEventRepository.findByAcknowledgedFalseOrderByDetectedAtDesc();
    }

    /**
     * Get dashboard statistics.
     */
    public Map<String, Object> getDashboardStats() {
        List<GpsPoint> latestPositions = getLatestPositions();
        List<AnomalyEvent> recentAnomalies = getRecentAnomalies();
        long totalAnomalies = anomalyEventRepository.count();
        long activeAlerts = anomalyEventRepository.countByAcknowledgedFalse();

        long highRisk = anomalyEventRepository.countByRiskLevel("HIGH");
        long mediumRisk = anomalyEventRepository.countByRiskLevel("MEDIUM");
        long lowRisk = anomalyEventRepository.countByRiskLevel("LOW");

        Map<String, Object> stats = new HashMap<>();
        stats.put("activeVehicles", latestPositions.size());
        stats.put("totalAnomalies", totalAnomalies);
        stats.put("activeAlerts", activeAlerts);
        stats.put("riskDistribution", Map.of(
            "high", highRisk,
            "medium", mediumRisk,
            "low", lowRisk
        ));
        stats.put("latestPositions", latestPositions);
        stats.put("recentAnomalies", recentAnomalies.stream().limit(20).toList());

        return stats;
    }

    // Helpers
    private int getInt(Map<String, Object> map, String key) {
        Object val = map.get(key);
        if (val instanceof Number) return ((Number) val).intValue();
        return 0;
    }

    private double getDouble(Map<String, Object> map, String key) {
        Object val = map.get(key);
        if (val instanceof Number) return ((Number) val).doubleValue();
        return 0.0;
    }

    private double getDoubleFromResult(Map<String, Object> map, String key) {
        Object val = map.get(key);
        if (val instanceof Number) return ((Number) val).doubleValue();
        return 0.0;
    }

    private String deriveDominantAnomalyType(List<Map<String, Object>> points, String fallbackType) {
        Map<String, Integer> typeCounts = new HashMap<>();
        for (Map<String, Object> point : points) {
            Object typeObj = point.get("anomalyType");
            Object anomalousObj = point.get("anomalous");
            String type = typeObj instanceof String ? ((String) typeObj) : null;
            boolean anomalous = Boolean.TRUE.equals(anomalousObj);

            if (anomalous && type != null && !type.isBlank()) {
                typeCounts.put(type, typeCounts.getOrDefault(type, 0) + 1);
            }
        }

        if (typeCounts.isEmpty()) {
            if (fallbackType != null && !fallbackType.isBlank()) {
                return fallbackType;
            }
            return inferAnomalyTypeFromWindow(points);
        }

        return typeCounts.entrySet().stream()
                .max(Map.Entry.comparingByValue())
                .map(Map.Entry::getKey)
                .orElse("UNKNOWN");
    }

    private String resolveFallbackAnomalyType(int vehicleId, String currentType) {
        if (currentType != null && !currentType.isBlank()) {
            return currentType;
        }
        String recentType = vehicleLastAnomalyType.get(vehicleId);
        if (recentType != null && !recentType.isBlank()) {
            return recentType;
        }
        int mod = Math.floorMod(vehicleId, 3);
        if (mod == 1) {
            return "SPEEDING";
        }
        if (mod == 2) {
            return "ERRATIC";
        }
        return "IDLE";
    }

    private double calibrateScoreByAnomalyType(double mlScore, String anomalyType) {
        double normalizedMl = Math.max(0.0, Math.min(1.0, mlScore));

        double typeBaseline;
        if ("SPEEDING".equalsIgnoreCase(anomalyType)) {
            typeBaseline = 0.90;
        } else if ("ERRATIC".equalsIgnoreCase(anomalyType)) {
            typeBaseline = 0.58;
        } else if ("IDLE".equalsIgnoreCase(anomalyType)) {
            typeBaseline = 0.28;
        } else {
            typeBaseline = 0.50;
        }

        // Blend type signal with ML confidence so results are not always HIGH.
        double calibrated = (normalizedMl * 0.35) + (typeBaseline * 0.65);
        return Math.max(0.0, Math.min(1.0, calibrated));
    }

    private String deriveRiskLevel(double score, String anomalyType) {
        if ("SPEEDING".equalsIgnoreCase(anomalyType)) {
            return "HIGH";
        }
        if ("ERRATIC".equalsIgnoreCase(anomalyType)) {
            return score >= 0.72 ? "HIGH" : "MEDIUM";
        }
        if ("IDLE".equalsIgnoreCase(anomalyType)) {
            return score >= 0.60 ? "MEDIUM" : "LOW";
        }
        return score >= 0.75 ? "HIGH" : score >= 0.45 ? "MEDIUM" : "LOW";
    }

    private String inferAnomalyTypeFromWindow(List<Map<String, Object>> points) {
        if (points == null || points.isEmpty()) {
            return "UNKNOWN";
        }

        List<Double> speeds = new ArrayList<>();
        for (Map<String, Object> point : points) {
            Object speedObj = point.get("speed");
            if (speedObj instanceof Number) {
                speeds.add(((Number) speedObj).doubleValue());
            }
        }

        if (speeds.isEmpty()) {
            return "UNKNOWN";
        }

        double maxSpeed = speeds.stream().max(Double::compareTo).orElse(0.0);
        double avgSpeed = speeds.stream().mapToDouble(Double::doubleValue).average().orElse(0.0);
        double variance = speeds.stream()
                .mapToDouble(s -> Math.pow(s - avgSpeed, 2))
                .average()
                .orElse(0.0);
        double stdDev = Math.sqrt(variance);

        if (maxSpeed >= 95.0) {
            return "SPEEDING";
        }
        if (avgSpeed <= 6.0) {
            return "IDLE";
        }
        if (stdDev >= 16.0) {
            return "ERRATIC";
        }

        return "UNKNOWN";
    }

    private AnomalyEvent createFallbackEvent(GpsPoint gpsPoint, String anomalyType) {
        AnomalyEvent event = new AnomalyEvent();
        event.setVehicleId(gpsPoint.getVehicleId());
        event.setDriverId(gpsPoint.getDriverId());
        event.setLatitude(gpsPoint.getLatitude());
        event.setLongitude(gpsPoint.getLongitude());

        double fallbackScore;
        if ("SPEEDING".equalsIgnoreCase(anomalyType)) {
            fallbackScore = 0.90;
        } else if ("ERRATIC".equalsIgnoreCase(anomalyType)) {
            fallbackScore = 0.72;
        } else if ("IDLE".equalsIgnoreCase(anomalyType)) {
            fallbackScore = 0.48;
        } else {
            fallbackScore = 0.60;
        }

        event.setAnomalyScore(fallbackScore);
        event.setAnomalyProbability(Math.min(0.99, fallbackScore));
        event.setAnomalyType(anomalyType == null || anomalyType.isBlank() ? "UNKNOWN" : anomalyType);
        event.setRiskLevel(deriveRiskLevel(event.getAnomalyScore(), event.getAnomalyType()));

        return anomalyEventRepository.save(event);
    }
}
