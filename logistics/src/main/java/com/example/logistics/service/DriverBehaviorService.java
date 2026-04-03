package com.example.logistics.service;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import com.example.logistics.entity.DriverBehavior;
import com.example.logistics.repository.DriverBehaviorRepository;

@Service
public class DriverBehaviorService {

    private static final Logger logger = LoggerFactory.getLogger(DriverBehaviorService.class);
    private final DriverBehaviorRepository repository;
    private final RestTemplate restTemplate = new RestTemplate();

    @Value("${ML_PREDICT_URL:http://localhost:5001/predict}")
    private String mlPredictUrl;

    public DriverBehaviorService(DriverBehaviorRepository repository) {
        this.repository = repository;
    }

    // ✅ Get all drivers
    public List<DriverBehavior> getAllDrivers() {
        return repository.findAll();
    }
    
   public Optional<DriverBehavior> getDriverById(int driverId) {
    return repository.findById(driverId);
}

    // ✅ ML-based GPS trajectory processing
  public DriverBehavior processGpsTrajectory(int driverId, String pltFilePath) {

        String mlUrl = mlPredictUrl;

        logger.info("Processing GPS trajectory for driver {} with file: {}", driverId, pltFilePath);

        // ✅ Validate file path exists
        java.nio.file.Path filePath = java.nio.file.Paths.get(pltFilePath);
        if (!java.nio.file.Files.exists(filePath)) {
            logger.error("PLT file not found at: {}", pltFilePath);
            throw new RuntimeException("PLT file not found: " + pltFilePath);
        }
       if (!pltFilePath.toLowerCase().endsWith(".plt")) {
    logger.error("Invalid file format: {}", pltFilePath);
    throw new RuntimeException("Only .plt GPS files are supported");
}
try {
    if (java.nio.file.Files.size(filePath) == 0) {
        logger.error("PLT file is empty: {}", pltFilePath);
        throw new RuntimeException("Uploaded GPS file is empty");
    }
} catch (Exception e) {
    throw new RuntimeException("Unable to read GPS file", e);
}
if (!java.nio.file.Files.isReadable(filePath)) {
    logger.error("PLT file not readable: {}", pltFilePath);
    throw new RuntimeException("GPS file is not readable");
}
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);

        Map<String, String> body = Map.of("file_path", pltFilePath);

        HttpEntity<Map<String, String>> request =
                new HttpEntity<>(body, headers);
        ResponseEntity<?> response;
    try {
        logger.info("Calling ML service at {}", mlUrl);
        response = restTemplate.postForEntity(mlUrl, request, Map.class);
    } catch (Exception e) {
        logger.error("ML service call failed - Make sure Python service is running on port 5001", e);
        throw new RuntimeException("ML service unreachable at " + mlUrl + ". Make sure to start: python ml-service/app.py | Error: " + e.getMessage(), e);
    }

        @SuppressWarnings("unchecked")
        Map<String, Object> result =
                (Map<String, Object>) response.getBody();
         if (result == null) {
        logger.error("ML service returned null response");
        throw new RuntimeException("Empty ML response");
     }
       Number anomalyScoreNum = (Number) result.get("anomaly_score");
    Number anomalyNum = (Number) result.get("anomaly");

    if (anomalyScoreNum == null || anomalyNum == null) {
        logger.error("Invalid ML response keys: {}", result);
        throw new RuntimeException("Invalid ML response keys: " + result);
    }

    double anomalyScore = anomalyScoreNum.doubleValue();
    int anomaly = anomalyNum.intValue();

    DriverBehavior driver =
        repository.findById(driverId)
                .orElseThrow(() ->
                        new RuntimeException("Driver not found: " + driverId));


    driver.setGpsAnomalies(driver.getGpsAnomalies() + anomaly);
    driver.setAnomalyScore(anomalyScore);

        // ===============================
        // HYBRID RISK CALCULATION
        // ===============================
        if (driver.getTotalDeliveries() == 0 &&
    driver.getGpsAnomalies() > 0 &&
    anomalyScore >= 0.4) {

    logger.warn(
        "ESCALATION: Driver {} forced to HIGH risk (GPS anomaly + no deliveries)",
        driverId
    );

    driver.setRiskScore(0.7);   // force HIGH
    driver.setRiskLevel("HIGH");
    driver.setFlagged(true);

    return repository.save(driver); // ⛔ stop further calculation
}

        double mlRisk = anomalyScore;

double cancelRisk = Math.min(
    (double) driver.getCancellations() / (driver.getTotalDeliveries() + 1),
    1.0
);

double gpsFreqRisk = Math.min(driver.getGpsAnomalies() * 0.1, 1.0);

double ruleRisk =
        (0.5 * gpsFreqRisk) +
        (0.5 * cancelRisk);

double finalRiskScore = (0.6 * mlRisk) + (0.4 * ruleRisk);

        if (driver.getTotalDeliveries() == 0 &&
    driver.getGpsAnomalies() > 0 &&
    anomalyScore >= 0.3) {

    logger.warn(
        "ESCALATION: Driver {} forced to HIGH risk (GPS anomaly + no deliveries)",
        driverId
    );

    driver.setRiskScore(0.7);   // minimum HIGH risk
    driver.setRiskLevel("HIGH");
    boolean flagged = false;

if ("HIGH".equals(driver.getRiskLevel())) {
    flagged = true;
} else if ("MEDIUM".equals(driver.getRiskLevel())) {
    flagged = driver.getGpsAnomalies() >= 3 || driver.getCancellations() >= 5;
}
    driver.setFlagged(flagged);

    return repository.save(driver);
}
        driver.setRiskScore(finalRiskScore);

        String riskLevel =
    finalRiskScore >= 0.65 ? "HIGH" :
    finalRiskScore >= 0.35 ? "MEDIUM" : "LOW";


    driver.setRiskLevel(riskLevel);
    driver.setFlagged(riskLevel.equals("HIGH"));

    return repository.save(driver);
    }
    // ✅ Get flagged drivers
    public List<DriverBehavior> getFlaggedDrivers() {
        try {
            logger.info("Fetching flagged drivers from database");
            List<DriverBehavior> flaggedDrivers = repository.findByFlaggedTrue();
            logger.info("Found {} flagged drivers", flaggedDrivers.size());
            return flaggedDrivers;
        } catch (Exception e) {
            logger.error("Error fetching flagged drivers", e);
            throw new RuntimeException("Failed to fetch flagged drivers: " + e.getMessage(), e);
        }
    }
    public DriverBehavior save(DriverBehavior driver) {
    return repository.save(driver);
}

    
}
