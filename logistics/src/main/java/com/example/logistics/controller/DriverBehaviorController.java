package com.example.logistics.controller;

import java.io.File;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.List;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import com.example.logistics.entity.DriverBehavior;
import com.example.logistics.service.DriverBehaviorService;

@CrossOrigin(origins = "http://localhost:3000")
@RestController
@RequestMapping("/api/drivers")
public class DriverBehaviorController {

    private static final Logger logger =
            LoggerFactory.getLogger(DriverBehaviorController.class);

    private final DriverBehaviorService service;

    public DriverBehaviorController(DriverBehaviorService service) {
        this.service = service;
    }

    // ✅ Get all drivers
    @GetMapping
    public ResponseEntity<List<DriverBehavior>> getAllDrivers() {
        try {
            return ResponseEntity.ok(service.getAllDrivers());
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.ok(List.of());
        }
    }

    // ✅ Process GPS using ML service
    @PostMapping("/gps")
    public ResponseEntity<DriverBehavior> processGps(
            @RequestParam int driverId,
            @RequestParam String pltPath) {

        try {
            logger.info(
                "POST /api/drivers/gps - Processing GPS for driver: {}, file: {}",
                driverId,
                pltPath
            );

            return ResponseEntity.ok(
                    service.processGpsTrajectory(driverId, pltPath)
            );

        } catch (Exception e) {
            logger.error(
                "Error processing GPS trajectory for driver {}",
                driverId,
                e
            );
            throw e;
        }
    }
  @PostMapping("/gps/upload")
public ResponseEntity<DriverBehavior> uploadGpsFile(
        @RequestParam("driverId") int driverId,
        @RequestParam("totalDeliveries") int totalDeliveries,
        @RequestParam("cancellations") int cancellations,
        @RequestParam("file") MultipartFile file) {

    try {
        String uploadDir = "uploads/gps/";
        File dir = new File(uploadDir);
        if (!dir.exists()) dir.mkdirs();

        String fileName =
                "driver_" + driverId + "_" + System.currentTimeMillis() + ".plt";

        Path filePath = Paths.get(uploadDir + fileName);
        Files.write(filePath, file.getBytes());

        // ---------- EXISTING VALIDATIONS (UNCHANGED) ----------
        if (!Files.exists(filePath)) {
            throw new RuntimeException("Uploaded file not saved");
        }

        if (Files.size(filePath) == 0) {
            throw new RuntimeException("Uploaded file is empty");
        }

        if (!fileName.toLowerCase().endsWith(".plt")) {
            throw new RuntimeException("Invalid file type. Only .plt allowed");
        }
        // ------------------------------------------------------

        // ✅ ADD ONLY THIS PART
        DriverBehavior driver =
        service.getDriverById(driverId)
                .orElse(new DriverBehavior(driverId));

driver.setTotalDeliveries(totalDeliveries);
driver.setCancellations(cancellations);

// ✅ THIS WAS MISSING
service.save(driver);

        // ✅ END ADDITION

       // AFTER saving file + validations + DB save

// ✅ FIX STARTS HERE
String absolutePath = filePath.toFile().getAbsolutePath();

System.out.println("File saved at: " + absolutePath);

if (!new File(absolutePath).exists()) {
    throw new RuntimeException("File not found at: " + absolutePath);
}

DriverBehavior result =
        service.processGpsTrajectory(driverId, absolutePath);
// ✅ FIX ENDS HERE

return ResponseEntity.ok(result);

    } catch (Exception e) {
        e.printStackTrace();
        return ResponseEntity.internalServerError().build();
    }
}


    // ✅ Get flagged drivers
    @GetMapping("/flagged")
    public List<DriverBehavior> getFlaggedDrivers() {
        try {
            logger.info(
                "GET /api/drivers/flagged - Fetching flagged drivers"
            );

            List<DriverBehavior> flagged =
                    service.getFlaggedDrivers();

            logger.info(
                "Successfully fetched {} flagged drivers",
                flagged.size()
            );

            return flagged;

        } catch (Exception e) {
            logger.error("Error fetching flagged drivers", e);
            throw e;
        }
    }

    // ✅ Health check endpoint
    @GetMapping("/health")
    public String health() {
        try {
            logger.info("Health check requested");

            int driverCount = service.getAllDrivers().size();

            logger.info(
                "Database connection OK - Found {} drivers",
                driverCount
            );

            return "OK - Database connected, "
                    + driverCount
                    + " drivers found";

        } catch (Exception e) {
            logger.error(
                "Health check failed - Database connection issue",
                e
            );
            throw new RuntimeException(
                "Database connection failed: " + e.getMessage(),
                e
            );
        }
    }

    // ✅ Debug endpoint to check flagged drivers count
    @GetMapping("/flagged/debug")
    public String flaggedDebug() {
        try {
            logger.info("Debug: Checking flagged drivers...");

            List<DriverBehavior> allDrivers =
                    service.getAllDrivers();

            logger.info(
                "Total drivers in DB: {}",
                allDrivers.size()
            );

            long flaggedCount = allDrivers.stream()
                    .filter(d -> d.isFlagged())
                    .count();

            logger.info(
                "Flagged drivers count: {}",
                flaggedCount
            );

            StringBuilder sb = new StringBuilder();
            sb.append("Total drivers: ")
              .append(allDrivers.size())
              .append("\n");

            sb.append("Flagged drivers: ")
              .append(flaggedCount)
              .append("\n");

            for (DriverBehavior d : allDrivers) {
                sb.append("Driver ")
                  .append(d.getDriverId())
                  .append(" - Flagged: ")
                  .append(d.isFlagged())
                  .append("\n");
            }

            return sb.toString();

        } catch (Exception e) {
            logger.error("Debug endpoint error", e);
            return "ERROR: "
                    + e.getMessage()
                    + "\nStackTrace: "
                    + e.toString();
        }
    }
    @PostMapping("/block")
public ResponseEntity<?> blockDriver(
        @RequestParam int driverId,
        @RequestParam String reason) {

    DriverBehavior driver =
            service.getAllDrivers().stream()
                    .filter(d -> d.getDriverId() == driverId)
                    .findFirst()
                    .orElseThrow(() -> new RuntimeException("Driver not found"));

    driver.setBlocked(true);
    driver.setAdminJustification(reason);

    service.save(driver);

    return ResponseEntity.ok("Driver blocked successfully");
}

@PostMapping("/unblock")
public ResponseEntity<?> unblockDriver(@RequestParam int driverId) {

    DriverBehavior driver =
            service.getAllDrivers().stream()
                    .filter(d -> d.getDriverId() == driverId)
                    .findFirst()
                    .orElseThrow(() -> new RuntimeException("Driver not found"));

    driver.setBlocked(false);
    driver.setAdminJustification(null);

    service.save(driver);

    return ResponseEntity.ok("Driver unblocked successfully");
}

    
}
