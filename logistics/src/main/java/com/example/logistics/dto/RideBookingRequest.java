package com.example.logistics.dto;

import java.time.Instant;

public class RideBookingRequest {
    private Long customerId;
    private String pickupLocation;
    private Double pickupLat;
    private Double pickupLng;
    private String dropLocation;
    private Double dropLat;
    private Double dropLng;
    private Instant scheduledAt;
    private String packageType;
    private Double packageWeightKg;
    private String packageDescription;
    private Double estimatedFare;
    private Long preferredScheduleId;

    public Long getCustomerId() {
        return customerId;
    }

    public void setCustomerId(Long customerId) {
        this.customerId = customerId;
    }

    public String getPickupLocation() {
        return pickupLocation;
    }

    public void setPickupLocation(String pickupLocation) {
        this.pickupLocation = pickupLocation;
    }

    public Double getPickupLat() {
        return pickupLat;
    }

    public void setPickupLat(Double pickupLat) {
        this.pickupLat = pickupLat;
    }

    public Double getPickupLng() {
        return pickupLng;
    }

    public void setPickupLng(Double pickupLng) {
        this.pickupLng = pickupLng;
    }

    public String getDropLocation() {
        return dropLocation;
    }

    public void setDropLocation(String dropLocation) {
        this.dropLocation = dropLocation;
    }

    public Double getDropLat() {
        return dropLat;
    }

    public void setDropLat(Double dropLat) {
        this.dropLat = dropLat;
    }

    public Double getDropLng() {
        return dropLng;
    }

    public void setDropLng(Double dropLng) {
        this.dropLng = dropLng;
    }

    public Instant getScheduledAt() {
        return scheduledAt;
    }

    public void setScheduledAt(Instant scheduledAt) {
        this.scheduledAt = scheduledAt;
    }

    public String getPackageType() {
        return packageType;
    }

    public void setPackageType(String packageType) {
        this.packageType = packageType;
    }

    public Double getPackageWeightKg() {
        return packageWeightKg;
    }

    public void setPackageWeightKg(Double packageWeightKg) {
        this.packageWeightKg = packageWeightKg;
    }

    public String getPackageDescription() {
        return packageDescription;
    }

    public void setPackageDescription(String packageDescription) {
        this.packageDescription = packageDescription;
    }

    public Double getEstimatedFare() {
        return estimatedFare;
    }

    public void setEstimatedFare(Double estimatedFare) {
        this.estimatedFare = estimatedFare;
    }

    public Long getPreferredScheduleId() {
        return preferredScheduleId;
    }

    public void setPreferredScheduleId(Long preferredScheduleId) {
        this.preferredScheduleId = preferredScheduleId;
    }
}
