package com.example.logistics.controller;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;

import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.example.logistics.dto.PinVerificationRequest;
import com.example.logistics.dto.RideBookingRequest;
import com.example.logistics.entity.DriverRouteSchedule;
import com.example.logistics.entity.Ride;
import com.example.logistics.service.RideService;

@CrossOrigin(origins = "*")
@RestController
@RequestMapping("/api/rides")
public class RideController {

    private final RideService rideService;

    public RideController(RideService rideService) {
        this.rideService = rideService;
    }

    @PostMapping("/book")
    public Ride bookRide(@RequestBody RideBookingRequest request) {
        return rideService.bookRide(request);
    }

    @PostMapping("/driver-schedules")
    public DriverRouteSchedule createDriverSchedule(@RequestBody Map<String, Object> payload) {
        Long driverId = payload == null || payload.get("driverId") == null
                ? null
                : ((Number) payload.get("driverId")).longValue();
        String fromLocation = payload == null ? null : (String) payload.get("fromLocation");
        String toLocation = payload == null ? null : (String) payload.get("toLocation");
        String departureAtText = payload == null ? null : (String) payload.get("departureAt");
        Integer capacity = null;
        if (payload != null && payload.get("capacity") != null) {
            Object cap = payload.get("capacity");
            if (cap instanceof Number) {
                capacity = ((Number) cap).intValue();
            } else {
                capacity = Integer.parseInt(String.valueOf(cap));
            }
        }

        return rideService.createDriverSchedule(
                driverId,
                fromLocation,
                toLocation,
                parseInstantFlexible(departureAtText),
                capacity
        );
    }

    private Instant parseInstantFlexible(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        try {
            return Instant.parse(raw);
        } catch (Exception ignore) {
            try {
                LocalDateTime ldt = LocalDateTime.parse(raw);
                return ldt.atZone(ZoneId.systemDefault()).toInstant();
            } catch (Exception ex) {
                throw new RuntimeException("Invalid departureAt datetime format");
            }
        }
    }

    @GetMapping("/driver-schedules")
    public List<DriverRouteSchedule> driverSchedules(@RequestParam(required = false) Long driverId) {
        return rideService.getDriverSchedules(driverId);
    }

    @GetMapping("/available-schedules")
    public List<DriverRouteSchedule> availableSchedules(
            @RequestParam(required = false) String fromLocation,
            @RequestParam(required = false) String toLocation
    ) {
        return rideService.getAvailableSchedules(fromLocation, toLocation);
    }

    @GetMapping("/live")
    public List<Ride> getLiveRides() {
        return rideService.getLiveRides();
    }

    @GetMapping
    public List<Ride> getRides(
            @RequestParam(required = false) Long userId,
            @RequestParam(required = false) String role
    ) {
        return rideService.getRides(userId, role);
    }

    @PostMapping("/{rideId}/accept")
    public Ride acceptRide(@PathVariable Long rideId, @RequestParam Long driverId) {
        return rideService.acceptRide(rideId, driverId);
    }

    @PostMapping("/{rideId}/auto-assign")
    public Ride autoAssign(@PathVariable Long rideId) {
        return rideService.autoAssignNearestDriver(rideId);
    }

    @PostMapping("/{rideId}/start")
    public Ride startRide(@PathVariable Long rideId, @RequestBody PinVerificationRequest request) {
        return rideService.startRide(rideId, request == null ? null : request.getPin());
    }

    @PostMapping("/{rideId}/complete")
    public Ride completeRide(@PathVariable Long rideId, @RequestBody PinVerificationRequest request) {
        return rideService.completeRide(rideId, request == null ? null : request.getPin());
    }

    @GetMapping("/{rideId}/tracking")
    public Map<String, Object> tracking(@PathVariable Long rideId) {
        return rideService.getRideTracking(rideId);
    }

    @PostMapping("/{rideId}/cancel")
    public Ride cancelRide(@PathVariable Long rideId, @RequestParam(required = false) String reason) {
        return rideService.cancelRide(rideId, reason);
    }

    @PostMapping("/{rideId}/shipment-update")
    public Ride shipmentUpdate(@PathVariable Long rideId, @RequestBody(required = false) Map<String, Object> payload) {
        String stage = payload == null ? null : (String) payload.get("stage");
        String note = payload == null ? null : (String) payload.get("note");
        return rideService.updateShipmentStage(rideId, stage, note);
    }

    @PostMapping("/{rideId}/payment")
    public Ride markPayment(@PathVariable Long rideId, @RequestBody(required = false) Map<String, Object> payload) {
        String method = payload == null ? null : (String) payload.get("method");
        String transactionRef = payload == null ? null : (String) payload.get("transactionRef");
        Double amount = null;
        if (payload != null && payload.get("amount") != null) {
            amount = ((Number) payload.get("amount")).doubleValue();
        }
        return rideService.markPayment(rideId, method, amount, transactionRef);
    }

    @PostMapping("/{rideId}/payment/initiate")
    public Ride initiateRealtimePayment(@PathVariable Long rideId, @RequestBody(required = false) Map<String, Object> payload) {
        String method = payload == null ? null : (String) payload.get("method");
        String transactionRef = payload == null ? null : (String) payload.get("transactionRef");
        Double amount = null;
        if (payload != null && payload.get("amount") != null) {
            amount = ((Number) payload.get("amount")).doubleValue();
        }
        return rideService.initiateRealtimePayment(rideId, method, amount, transactionRef);
    }

    @GetMapping("/{rideId}/payment/status")
    public Map<String, Object> paymentStatus(@PathVariable Long rideId) {
        return rideService.getPaymentStatus(rideId);
    }

    @PostMapping("/{rideId}/payment/razorpay/order")
    public Map<String, Object> createRazorpayOrder(@PathVariable Long rideId, @RequestBody(required = false) Map<String, Object> payload) {
        Double amount = null;
        if (payload != null && payload.get("amount") != null) {
            amount = ((Number) payload.get("amount")).doubleValue();
        }
        return rideService.createRazorpayOrder(rideId, amount);
    }

    @PostMapping("/{rideId}/payment/razorpay/verify")
    public Ride verifyRazorpayPayment(@PathVariable Long rideId, @RequestBody Map<String, Object> payload) {
        String orderId = payload == null ? null : (String) payload.get("razorpay_order_id");
        String paymentId = payload == null ? null : (String) payload.get("razorpay_payment_id");
        String signature = payload == null ? null : (String) payload.get("razorpay_signature");
        Double amount = null;
        if (payload != null && payload.get("amount") != null) {
            amount = ((Number) payload.get("amount")).doubleValue();
        }
        return rideService.verifyRazorpayPayment(rideId, orderId, paymentId, signature, amount);
    }

    @PostMapping("/{rideId}/sos")
    public Ride raiseSos(@PathVariable Long rideId, @RequestBody(required = false) Map<String, Object> payload) {
        String message = payload == null ? null : (String) payload.get("message");
        return rideService.raiseSos(rideId, message);
    }

    @PostMapping("/{rideId}/sos/resolve")
    public Ride resolveSos(@PathVariable Long rideId, @RequestBody(required = false) Map<String, Object> payload) {
        String resolvedBy = payload == null ? null : (String) payload.get("resolvedBy");
        return rideService.resolveSos(rideId, resolvedBy);
    }

    @PostMapping("/{rideId}/feedback")
    public Ride submitFeedback(@PathVariable Long rideId, @RequestBody(required = false) Map<String, Object> payload) {
        Integer rating = null;
        String feedback = null;

        if (payload != null && payload.get("rating") != null) {
            rating = ((Number) payload.get("rating")).intValue();
        }
        if (payload != null) {
            feedback = (String) payload.get("feedback");
        }

        return rideService.submitFeedback(rideId, rating, feedback);
    }

    @GetMapping("/metrics")
    public Map<String, Object> metrics() {
        List<Ride> live = rideService.getLiveRides();
        List<Ride> all = rideService.getRides(null, null);

        long completed = all.stream().filter(r -> "COMPLETED".equals(r.getStatus().name())).count();
        long cancelled = all.stream().filter(r -> "CANCELLED".equals(r.getStatus().name())).count();
        long scheduled = all.stream().filter(r -> "SCHEDULED".equals(r.getStatus().name())).count();

        Map<String, Object> data = new HashMap<>();
        data.put("liveRides", live.size());
        data.put("scheduled", scheduled);
        data.put("deliveries", completed);
        data.put("cancellations", cancelled);
        return data;
    }
}
