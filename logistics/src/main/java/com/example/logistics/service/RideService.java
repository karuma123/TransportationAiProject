package com.example.logistics.service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Random;
import java.util.Set;

import org.springframework.stereotype.Service;

import com.example.logistics.dto.RideBookingRequest;
import com.example.logistics.entity.DriverBehavior;
import com.example.logistics.entity.DriverRouteSchedule;
import com.example.logistics.entity.GpsPoint;
import com.example.logistics.entity.Ride;
import com.example.logistics.entity.RideStatus;
import com.example.logistics.repository.DriverBehaviorRepository;
import com.example.logistics.repository.GpsPointRepository;
import com.example.logistics.repository.DriverRouteScheduleRepository;
import com.example.logistics.repository.RideRepository;

@Service
public class RideService {

    private static final Random RANDOM = new Random();

    private final RideRepository rideRepository;
    private final DriverBehaviorRepository driverBehaviorRepository;
    private final GpsPointRepository gpsPointRepository;
    private final DriverRouteScheduleRepository driverRouteScheduleRepository;

    public RideService(
            RideRepository rideRepository,
            DriverBehaviorRepository driverBehaviorRepository,
            GpsPointRepository gpsPointRepository,
            DriverRouteScheduleRepository driverRouteScheduleRepository
    ) {
        this.rideRepository = rideRepository;
        this.driverBehaviorRepository = driverBehaviorRepository;
        this.gpsPointRepository = gpsPointRepository;
        this.driverRouteScheduleRepository = driverRouteScheduleRepository;
    }

    public Ride bookRide(RideBookingRequest request) {
        if (request.getCustomerId() == null) {
            throw new RuntimeException("customerId is required");
        }
        if (request.getPickupLocation() == null || request.getPickupLocation().isBlank()) {
            throw new RuntimeException("pickupLocation is required");
        }
        if (request.getDropLocation() == null || request.getDropLocation().isBlank()) {
            throw new RuntimeException("dropLocation is required");
        }

        Ride ride = new Ride();
        ride.setCustomerId(request.getCustomerId());
        ride.setPickupLocation(request.getPickupLocation().trim());
        ride.setPickupLat(request.getPickupLat());
        ride.setPickupLng(request.getPickupLng());
        ride.setDropLocation(request.getDropLocation().trim());
        ride.setDropLat(request.getDropLat());
        ride.setDropLng(request.getDropLng());
        ride.setScheduledAt(request.getScheduledAt());
        ride.setPackageType(request.getPackageType());
        ride.setPackageStatus("BOOKED");
        ride.setPickupPin(generatePin());
        ride.setDropPin(generatePin());
        ride.setPickupVerified(false);
        ride.setDropVerified(false);
        ride.setPackageWeightKg(request.getPackageWeightKg());
        ride.setPackageDescription(request.getPackageDescription());
        ride.setEstimatedFare(request.getEstimatedFare());
        ride.setAmountPaid(0.0);
        ride.setPaymentStatus("PENDING");
        ride.setPaymentMethod("UNSET");
        ride.setShipmentStage("BOOKED");
        ride.setShipmentUpdateNote("Shipment booked");
        ride.setShipmentUpdatedAt(Instant.now());
        ride.setCurrentPackageLat(ride.getPickupLat());
        ride.setCurrentPackageLng(ride.getPickupLng());
        ride.setSosActive(false);

        if (request.getScheduledAt() != null && request.getScheduledAt().isAfter(Instant.now())) {
            ride.setStatus(RideStatus.SCHEDULED);
        } else {
            ride.setStatus(RideStatus.REQUESTED);
        }

        DriverRouteSchedule schedule = findMatchingSchedule(ride, request.getPreferredScheduleId());
        if (schedule != null) {
            ride.setDriverId(schedule.getDriverId());
            ride.setRouteScheduleId(schedule.getId());
            ride.setStatus(RideStatus.SCHEDULED);
            ride.setPackageStatus("ASSIGNED");
            ride.setShipmentStage("DRIVER_ASSIGNED");
            ride.setShipmentUpdateNote("Assigned to scheduled driver route");
            ride.setShipmentUpdatedAt(Instant.now());

            schedule.setCapacityAvailable(Math.max(0, schedule.getCapacityAvailable() - 1));
            if (schedule.getCapacityAvailable() <= 0) {
                schedule.setActive(false);
            }
            driverRouteScheduleRepository.save(schedule);
        } else if (ride.getStatus() == RideStatus.REQUESTED) {
            // Auto-assign nearest available driver for immediate rides.
            Long assigned = findNearestAvailableDriver(ride.getPickupLat(), ride.getPickupLng(), ride.getPickupLocation());
            if (assigned != null) {
                ride.setDriverId(assigned);
                ride.setStatus(RideStatus.ACCEPTED);
                ride.setPackageStatus("ASSIGNED");
                ride.setShipmentStage("DRIVER_ASSIGNED");
                ride.setShipmentUpdateNote("Driver assigned to shipment");
                ride.setShipmentUpdatedAt(Instant.now());
            }
        }

        return rideRepository.save(ride);
    }

    public Ride autoAssignNearestDriver(Long rideId) {
        Ride ride = getRideOrThrow(rideId);
        if (ride.getStatus() == RideStatus.COMPLETED || ride.getStatus() == RideStatus.CANCELLED) {
            throw new RuntimeException("Cannot assign a finalized ride");
        }

        Long assigned = findNearestAvailableDriver(ride.getPickupLat(), ride.getPickupLng(), ride.getPickupLocation());
        if (assigned == null) {
            throw new RuntimeException("No available active drivers found");
        }

        ride.setDriverId(assigned);
        if (ride.getStatus() == RideStatus.REQUESTED || ride.getStatus() == RideStatus.SCHEDULED) {
            ride.setStatus(RideStatus.ACCEPTED);
            ride.setPackageStatus("ASSIGNED");
        }
        return rideRepository.save(ride);
    }

    public List<Ride> getLiveRides() {
        return rideRepository.findByStatusInOrderByUpdatedAtDesc(List.of(
                RideStatus.REQUESTED,
                RideStatus.SCHEDULED,
                RideStatus.ACCEPTED,
                RideStatus.IN_PROGRESS
        ));
    }

    public List<Ride> getRides(Long userId, String role) {
        if (userId == null || role == null || role.isBlank()) {
            return rideRepository.findAll();
        }

        String normalizedRole = role.toUpperCase(Locale.ROOT);
        if ("CUSTOMER".equals(normalizedRole)) {
            return rideRepository.findByCustomerIdOrderByUpdatedAtDesc(userId);
        }
        if ("DRIVER".equals(normalizedRole)) {
            return rideRepository.findByDriverIdOrderByUpdatedAtDesc(userId);
        }
        return rideRepository.findAll();
    }

    public Ride acceptRide(Long rideId, Long driverId) {
        Ride ride = getRideOrThrow(rideId);
        if (ride.getStatus() != RideStatus.REQUESTED && ride.getStatus() != RideStatus.SCHEDULED) {
            throw new RuntimeException("Ride cannot be accepted in current status");
        }
        ride.setDriverId(driverId);
        ride.setStatus(RideStatus.ACCEPTED);
        ride.setPackageStatus("ASSIGNED");
        ride.setShipmentStage("DRIVER_ASSIGNED");
        ride.setShipmentUpdateNote("Driver accepted the shipment");
        ride.setShipmentUpdatedAt(Instant.now());
        return rideRepository.save(ride);
    }

    public Ride startRide(Long rideId, String pickupPin) {
        Ride ride = getRideOrThrow(rideId);
        if (ride.getStatus() != RideStatus.ACCEPTED) {
            throw new RuntimeException("Only accepted rides can be started");
        }
        if (pickupPin == null || pickupPin.isBlank()) {
            throw new RuntimeException("pickup PIN is required to start ride");
        }
        if (ride.getPickupPin() == null || !ride.getPickupPin().equals(pickupPin.trim())) {
            throw new RuntimeException("Invalid pickup PIN");
        }
        ride.setStatus(RideStatus.IN_PROGRESS);
        ride.setPickupVerified(true);
        ride.setPackageStatus("IN_TRANSIT");
        ride.setShipmentStage("PICKED_UP");
        ride.setShipmentUpdateNote("Package picked up from source");
        ride.setShipmentUpdatedAt(Instant.now());
        return rideRepository.save(ride);
    }

    public Ride completeRide(Long rideId, String dropPin) {
        Ride ride = getRideOrThrow(rideId);
        boolean wasAlreadyDelivered = "DELIVERED".equalsIgnoreCase(ride.getPackageStatus());
        if (ride.getStatus() != RideStatus.IN_PROGRESS) {
            throw new RuntimeException("Only in-progress rides can be completed");
        }
        if (dropPin == null || dropPin.isBlank()) {
            throw new RuntimeException("drop PIN is required to complete ride");
        }
        if (ride.getDropPin() == null || !ride.getDropPin().equals(dropPin.trim())) {
            throw new RuntimeException("Invalid drop PIN");
        }
        ride.setStatus(RideStatus.COMPLETED);
        ride.setDropVerified(true);
        ride.setPackageStatus("DELIVERED");
        ride.setShipmentStage("DELIVERED");
        ride.setShipmentUpdateNote("Package delivered successfully");
        ride.setShipmentUpdatedAt(Instant.now());
        ride.setCurrentPackageLat(ride.getDropLat());
        ride.setCurrentPackageLng(ride.getDropLng());
        Ride saved = rideRepository.save(ride);
        if (!wasAlreadyDelivered) {
            incrementDeliveriesForDriver(saved.getDriverId());
        }
        return saved;
    }

    public Ride cancelRide(Long rideId, String reason) {
        Ride ride = getRideOrThrow(rideId);
        boolean wasAlreadyCancelled = "CANCELLED".equalsIgnoreCase(ride.getPackageStatus());
        if (ride.getStatus() == RideStatus.COMPLETED || ride.getStatus() == RideStatus.CANCELLED) {
            throw new RuntimeException("Ride is already finalized");
        }
        ride.setStatus(RideStatus.CANCELLED);
        ride.setCancelReason(reason == null ? "Cancelled" : reason);
        ride.setPackageStatus("CANCELLED");
        ride.setShipmentStage("CANCELLED");
        ride.setShipmentUpdateNote(ride.getCancelReason());
        ride.setShipmentUpdatedAt(Instant.now());

        if (ride.getRouteScheduleId() != null) {
            DriverRouteSchedule schedule = driverRouteScheduleRepository.findById(ride.getRouteScheduleId())
                    .orElse(null);
            if (schedule != null) {
                schedule.setCapacityAvailable(Math.min(
                        schedule.getCapacityTotal(),
                        schedule.getCapacityAvailable() + 1
                ));
                if (schedule.getCapacityAvailable() > 0) {
                    schedule.setActive(true);
                }
                driverRouteScheduleRepository.save(schedule);
            }
        }

        Ride saved = rideRepository.save(ride);
        if (!wasAlreadyCancelled) {
            incrementCancellationsForDriver(saved.getDriverId());
        }
        return saved;
    }

    public DriverRouteSchedule createDriverSchedule(
            Long driverId,
            String fromLocation,
            String toLocation,
            Instant departureAt,
            Integer capacity
    ) {
        if (driverId == null) {
            throw new RuntimeException("driverId is required");
        }
        if (fromLocation == null || fromLocation.isBlank()) {
            throw new RuntimeException("fromLocation is required");
        }
        if (toLocation == null || toLocation.isBlank()) {
            throw new RuntimeException("toLocation is required");
        }
        if (departureAt == null) {
            throw new RuntimeException("departureAt is required");
        }
        if (capacity == null || capacity <= 0) {
            throw new RuntimeException("capacity must be greater than 0");
        }

        DriverRouteSchedule schedule = new DriverRouteSchedule();
        schedule.setDriverId(driverId);
        schedule.setFromLocation(fromLocation.trim());
        schedule.setToLocation(toLocation.trim());
        schedule.setDepartureAt(departureAt);
        schedule.setCapacityTotal(capacity);
        schedule.setCapacityAvailable(capacity);
        schedule.setActive(true);
        return driverRouteScheduleRepository.save(schedule);
    }

    public List<DriverRouteSchedule> getDriverSchedules(Long driverId) {
        if (driverId == null) {
            return driverRouteScheduleRepository.findAll();
        }
        return driverRouteScheduleRepository.findByDriverIdOrderByDepartureAtAsc(driverId);
    }

    public List<DriverRouteSchedule> getAvailableSchedules(String fromLocation, String toLocation) {
        List<DriverRouteSchedule> schedules =
                driverRouteScheduleRepository.findByActiveTrueAndCapacityAvailableGreaterThanAndDepartureAtAfterOrderByDepartureAtAsc(
                        0,
                        Instant.now()
                );

        if ((fromLocation == null || fromLocation.isBlank())
                && (toLocation == null || toLocation.isBlank())) {
            return schedules;
        }

        String fromNorm = normalizeLocation(fromLocation);
        String toNorm = normalizeLocation(toLocation);

        List<DriverRouteSchedule> filtered = new ArrayList<>();
        for (DriverRouteSchedule s : schedules) {
            boolean fromMatch = fromNorm == null || normalizeLocation(s.getFromLocation()).contains(fromNorm);
            boolean toMatch = toNorm == null || normalizeLocation(s.getToLocation()).contains(toNorm);
            if (fromMatch && toMatch) {
                filtered.add(s);
            }
        }
        // If language/script differences (e.g., Telugu vs English) prevent text matching,
        // return active schedules so the customer can still choose a route manually.
        if (filtered.isEmpty()) {
            return schedules;
        }
        return filtered;
    }

    public Ride updateShipmentStage(Long rideId, String stage, String note) {
        Ride ride = getRideOrThrow(rideId);
        String previousPackageStatus = ride.getPackageStatus();
        String normalized = normalizeStage(stage, ride.getStatus());
        ride.setShipmentStage(normalized);
        ride.setShipmentUpdateNote(
                note == null || note.isBlank()
                        ? "Shipment stage updated to " + normalized
                        : note.trim()
        );
        ride.setShipmentUpdatedAt(Instant.now());

        if ("IN_TRANSIT".equals(normalized)) {
            ride.setPackageStatus("IN_TRANSIT");
        } else if ("OUT_FOR_DELIVERY".equals(normalized)) {
            ride.setPackageStatus("OUT_FOR_DELIVERY");
        } else if ("DELIVERED".equals(normalized)) {
            ride.setPackageStatus("DELIVERED");
            ride.setCurrentPackageLat(ride.getDropLat());
            ride.setCurrentPackageLng(ride.getDropLng());
            if (!"DELIVERED".equalsIgnoreCase(previousPackageStatus)) {
                incrementDeliveriesForDriver(ride.getDriverId());
            }
        } else if ("CANCELLED".equals(normalized)) {
            ride.setPackageStatus("CANCELLED");
            if (!"CANCELLED".equalsIgnoreCase(previousPackageStatus)) {
                incrementCancellationsForDriver(ride.getDriverId());
            }
        }

        return rideRepository.save(ride);
    }

    public Ride markPayment(Long rideId, String method, Double amount, String transactionRef) {
        Ride ride = getRideOrThrow(rideId);

        if (amount == null || amount <= 0) {
            throw new RuntimeException("Valid amount is required for payment");
        }

        ride.setAmountPaid(amount);
        ride.setPaymentMethod(method == null || method.isBlank() ? "UNKNOWN" : method.trim().toUpperCase(Locale.ROOT));
        ride.setPaymentStatus("SUCCESS");
        ride.setPaymentTransactionRef(
                transactionRef == null || transactionRef.isBlank()
                        ? "TXN-" + System.currentTimeMillis()
                        : transactionRef.trim()
        );
        ride.setPaymentUpdatedAt(Instant.now());

        return rideRepository.save(ride);
    }

    public Ride raiseSos(Long rideId, String message) {
        Ride ride = getRideOrThrow(rideId);
        ride.setSosActive(true);
        ride.setSosMessage(
                message == null || message.isBlank()
                        ? "Customer requested urgent support"
                        : message.trim()
        );
        ride.setSosRaisedAt(Instant.now());
        ride.setSosResolvedAt(null);
        ride.setSosResolvedBy(null);
        return rideRepository.save(ride);
    }

    public Ride resolveSos(Long rideId, String resolvedBy) {
        Ride ride = getRideOrThrow(rideId);
        ride.setSosActive(false);
        ride.setSosResolvedAt(Instant.now());
        ride.setSosResolvedBy(
                resolvedBy == null || resolvedBy.isBlank()
                        ? "support-team"
                        : resolvedBy.trim()
        );
        return rideRepository.save(ride);
    }

    public Ride submitFeedback(Long rideId, Integer rating, String feedback) {
        Ride ride = getRideOrThrow(rideId);

        if (rating == null || rating < 1 || rating > 5) {
            throw new RuntimeException("rating must be between 1 and 5");
        }

        ride.setCustomerRating(rating);
        ride.setCustomerFeedback(feedback == null ? null : feedback.trim());
        ride.setCustomerFeedbackAt(Instant.now());
        return rideRepository.save(ride);
    }

    public Map<String, Object> getRideTracking(Long rideId) {
        Ride ride = getRideOrThrow(rideId);
        Map<String, Object> tracking = new HashMap<>();
        tracking.put("rideId", ride.getId());
        tracking.put("status", ride.getStatus());
        tracking.put("packageStatus", ride.getPackageStatus());
        tracking.put("pickupLocation", ride.getPickupLocation());
        tracking.put("dropLocation", ride.getDropLocation());
        tracking.put("pickupLat", ride.getPickupLat());
        tracking.put("pickupLng", ride.getPickupLng());
        tracking.put("dropLat", ride.getDropLat());
        tracking.put("dropLng", ride.getDropLng());
        tracking.put("pickupPin", ride.getPickupPin());
        tracking.put("dropPin", ride.getDropPin());
        tracking.put("pickupVerified", ride.getPickupVerified());
        tracking.put("dropVerified", ride.getDropVerified());
        tracking.put("shipmentStage", ride.getShipmentStage());
        tracking.put("shipmentUpdateNote", ride.getShipmentUpdateNote());
        tracking.put("shipmentUpdatedAt", ride.getShipmentUpdatedAt());
        tracking.put("paymentStatus", ride.getPaymentStatus());
        tracking.put("paymentMethod", ride.getPaymentMethod());
        tracking.put("paymentTransactionRef", ride.getPaymentTransactionRef());
        tracking.put("amountPaid", ride.getAmountPaid());
        tracking.put("routeScheduleId", ride.getRouteScheduleId());
        tracking.put("sosActive", ride.getSosActive());
        tracking.put("sosMessage", ride.getSosMessage());
        tracking.put("sosRaisedAt", ride.getSosRaisedAt());
        tracking.put("sosResolvedAt", ride.getSosResolvedAt());
        tracking.put("sosResolvedBy", ride.getSosResolvedBy());
        tracking.put("customerRating", ride.getCustomerRating());
        tracking.put("customerFeedback", ride.getCustomerFeedback());
        tracking.put("customerFeedbackAt", ride.getCustomerFeedbackAt());
        tracking.put("currentPackageLat", ride.getCurrentPackageLat());
        tracking.put("currentPackageLng", ride.getCurrentPackageLng());

        if (ride.getDriverId() != null) {
            GpsPoint current = gpsPointRepository.findTopByDriverIdOrderByTimestampDesc(ride.getDriverId().intValue());
            if (current != null) {
                Map<String, Object> driverLocation = new HashMap<>();
                driverLocation.put("driverId", current.getDriverId());
                driverLocation.put("vehicleId", current.getVehicleId());
                driverLocation.put("latitude", current.getLatitude());
                driverLocation.put("longitude", current.getLongitude());
                driverLocation.put("speed", current.getSpeed());
                driverLocation.put("timestamp", current.getTimestamp());
                tracking.put("driverLocation", driverLocation);

                ride.setCurrentPackageLat(current.getLatitude());
                ride.setCurrentPackageLng(current.getLongitude());
                ride.setShipmentUpdatedAt(Instant.now());
                rideRepository.save(ride);
                tracking.put("currentPackageLat", current.getLatitude());
                tracking.put("currentPackageLng", current.getLongitude());

                if (ride.getDropLat() != null && ride.getDropLng() != null) {
                    double kmToDrop = haversineKm(
                            current.getLatitude(),
                            current.getLongitude(),
                            ride.getDropLat(),
                            ride.getDropLng()
                    );
                    tracking.put("distanceToDropKm", round(kmToDrop));

                    double speed = Math.max(current.getSpeed(), 20.0);
                    double etaMinutes = (kmToDrop / speed) * 60.0;
                    tracking.put("etaMinutes", Math.max(1, (int) Math.round(etaMinutes)));
                }
            }
        }

        return tracking;
    }

    private String normalizeStage(String stage, RideStatus status) {
        if (stage == null || stage.isBlank()) {
            if (status == RideStatus.COMPLETED) {
                return "DELIVERED";
            }
            if (status == RideStatus.CANCELLED) {
                return "CANCELLED";
            }
            if (status == RideStatus.IN_PROGRESS) {
                return "IN_TRANSIT";
            }
            if (status == RideStatus.ACCEPTED) {
                return "PICKED_UP";
            }
            return "BOOKED";
        }
        return stage.trim().toUpperCase(Locale.ROOT).replace(' ', '_');
    }

    private Ride getRideOrThrow(Long rideId) {
        return rideRepository.findById(rideId)
                .orElseThrow(() -> new RuntimeException("Ride not found"));
    }

    private void incrementDeliveriesForDriver(Long driverId) {
        if (driverId == null) {
            return;
        }
        int id = driverId.intValue();
        DriverBehavior driver = driverBehaviorRepository.findById(id)
                .orElse(new DriverBehavior(id));
        driver.setTotalDeliveries(driver.getTotalDeliveries() + 1);
        driverBehaviorRepository.save(driver);
    }

    private void incrementCancellationsForDriver(Long driverId) {
        if (driverId == null) {
            return;
        }
        int id = driverId.intValue();
        DriverBehavior driver = driverBehaviorRepository.findById(id)
                .orElse(new DriverBehavior(id));
        driver.setCancellations(driver.getCancellations() + 1);
        driverBehaviorRepository.save(driver);
    }

    private Long findNearestAvailableDriver(Double pickupLat, Double pickupLng, String pickupLocation) {
        List<GpsPoint> latest = gpsPointRepository.findLatestForAllVehicles();
        if (latest.isEmpty()) {
            return null;
        }

        Set<Long> busyDrivers = new HashSet<>();
        List<Ride> liveRides = getLiveRides();
        for (Ride r : liveRides) {
            if (r.getDriverId() != null) {
                busyDrivers.add(r.getDriverId());
            }
        }

        Set<Integer> blockedDriverIds = new HashSet<>();
        for (DriverBehavior d : driverBehaviorRepository.findAll()) {
            if (d.isBlocked()) {
                blockedDriverIds.add(d.getDriverId());
            }
        }

        List<GpsPoint> candidates = new ArrayList<>();
        for (GpsPoint point : latest) {
            long driverId = point.getDriverId();
            if (busyDrivers.contains(driverId)) {
                continue;
            }
            if (blockedDriverIds.contains((int) driverId)) {
                continue;
            }
            candidates.add(point);
        }

        if (candidates.isEmpty()) {
            return null;
        }

        double[] pickup = (pickupLat != null && pickupLng != null)
            ? new double[] { pickupLat, pickupLng }
            : parsePickupCoordinates(pickupLocation);
        if (pickup == null) {
            // Fallback when pickup isn't in lat,lng format.
            return (long) candidates.get(0).getDriverId();
        }

        GpsPoint nearest = null;
        double bestDistance = Double.MAX_VALUE;
        for (GpsPoint point : candidates) {
            double d = haversineKm(pickup[0], pickup[1], point.getLatitude(), point.getLongitude());
            if (d < bestDistance) {
                bestDistance = d;
                nearest = point;
            }
        }

        return nearest == null ? null : (long) nearest.getDriverId();
    }

    private DriverRouteSchedule findMatchingSchedule(Ride ride, Long preferredScheduleId) {
        if (preferredScheduleId != null) {
            DriverRouteSchedule chosen = driverRouteScheduleRepository.findById(preferredScheduleId)
                    .orElseThrow(() -> new RuntimeException("Selected driver schedule not found"));
            if (!Boolean.TRUE.equals(chosen.getActive()) || chosen.getCapacityAvailable() <= 0) {
                throw new RuntimeException("Selected driver schedule has no available capacity");
            }
            return chosen;
        }

        List<DriverRouteSchedule> schedules = getAvailableSchedules(ride.getPickupLocation(), ride.getDropLocation());
        if (schedules.isEmpty()) {
            return null;
        }
        return schedules.get(0);
    }

    private String normalizeLocation(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return value.trim().toLowerCase(Locale.ROOT);
    }

    private double[] parsePickupCoordinates(String pickupLocation) {
        if (pickupLocation == null || !pickupLocation.contains(",")) {
            return null;
        }
        try {
            String[] parts = pickupLocation.split(",");
            if (parts.length < 2) {
                return null;
            }
            double lat = Double.parseDouble(parts[0].trim());
            double lng = Double.parseDouble(parts[1].trim());
            return new double[] { lat, lng };
        } catch (Exception ex) {
            return null;
        }
    }

    private String generatePin() {
        int pin = 1000 + RANDOM.nextInt(9000);
        return String.valueOf(pin);
    }

    private double round(double value) {
        return Math.round(value * 100.0) / 100.0;
    }

    private double haversineKm(double lat1, double lon1, double lat2, double lon2) {
        double earthRadiusKm = 6371.0;
        double dLat = Math.toRadians(lat2 - lat1);
        double dLon = Math.toRadians(lon2 - lon1);
        double a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
                + Math.cos(Math.toRadians(lat1))
                * Math.cos(Math.toRadians(lat2))
                * Math.sin(dLon / 2)
                * Math.sin(dLon / 2);
        double c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return earthRadiusKm * c;
    }
}
