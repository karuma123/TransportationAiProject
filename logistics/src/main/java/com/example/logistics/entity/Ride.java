package com.example.logistics.entity;

import java.time.Instant;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;

@Entity
@Table(name = "ride")
public class Ride {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long customerId;

    @Column
    private Long driverId;

    @Column
    private Long routeScheduleId;

    @Column(nullable = false)
    private String pickupLocation;

    @Column
    private Double pickupLat;

    @Column
    private Double pickupLng;

    @Column(nullable = false)
    private String dropLocation;

    @Column
    private Double dropLat;

    @Column
    private Double dropLng;

    @Column
    private Instant scheduledAt;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private RideStatus status;

    @Column
    private String packageType;

    @Column
    private String packageStatus;

    @Column(length = 8)
    private String pickupPin;

    @Column(length = 8)
    private String dropPin;

    @Column
    private Boolean pickupVerified;

    @Column
    private Boolean dropVerified;

    @Column
    private Double packageWeightKg;

    @Column(length = 2000)
    private String packageDescription;

    @Column
    private Double estimatedFare;

    @Column
    private Double amountPaid;

    @Column(length = 40)
    private String paymentStatus;

    @Column(length = 40)
    private String paymentMethod;

    @Column(length = 120)
    private String paymentTransactionRef;

    @Column
    private Instant paymentUpdatedAt;

    @Column(length = 80)
    private String shipmentStage;

    @Column(length = 500)
    private String shipmentUpdateNote;

    @Column
    private Instant shipmentUpdatedAt;

    @Column
    private Double currentPackageLat;

    @Column
    private Double currentPackageLng;

    @Column
    private Boolean sosActive;

    @Column(length = 1000)
    private String sosMessage;

    @Column
    private Instant sosRaisedAt;

    @Column
    private Instant sosResolvedAt;

    @Column(length = 120)
    private String sosResolvedBy;

    @Column
    private Integer customerRating;

    @Column(length = 2000)
    private String customerFeedback;

    @Column
    private Instant customerFeedbackAt;

    @Column(length = 500)
    private String cancelReason;

    @Column(nullable = false)
    private Instant createdAt;

    @Column(nullable = false)
    private Instant updatedAt;

    @PrePersist
    public void onCreate() {
        Instant now = Instant.now();
        createdAt = now;
        updatedAt = now;
    }

    @PreUpdate
    public void onUpdate() {
        updatedAt = Instant.now();
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public Long getCustomerId() {
        return customerId;
    }

    public void setCustomerId(Long customerId) {
        this.customerId = customerId;
    }

    public Long getDriverId() {
        return driverId;
    }

    public void setDriverId(Long driverId) {
        this.driverId = driverId;
    }

    public Long getRouteScheduleId() {
        return routeScheduleId;
    }

    public void setRouteScheduleId(Long routeScheduleId) {
        this.routeScheduleId = routeScheduleId;
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

    public RideStatus getStatus() {
        return status;
    }

    public void setStatus(RideStatus status) {
        this.status = status;
    }

    public String getPackageType() {
        return packageType;
    }

    public void setPackageType(String packageType) {
        this.packageType = packageType;
    }

    public String getPackageStatus() {
        return packageStatus;
    }

    public void setPackageStatus(String packageStatus) {
        this.packageStatus = packageStatus;
    }

    public String getPickupPin() {
        return pickupPin;
    }

    public void setPickupPin(String pickupPin) {
        this.pickupPin = pickupPin;
    }

    public String getDropPin() {
        return dropPin;
    }

    public void setDropPin(String dropPin) {
        this.dropPin = dropPin;
    }

    public Boolean getPickupVerified() {
        return pickupVerified;
    }

    public void setPickupVerified(Boolean pickupVerified) {
        this.pickupVerified = pickupVerified;
    }

    public Boolean getDropVerified() {
        return dropVerified;
    }

    public void setDropVerified(Boolean dropVerified) {
        this.dropVerified = dropVerified;
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

    public Double getAmountPaid() {
        return amountPaid;
    }

    public void setAmountPaid(Double amountPaid) {
        this.amountPaid = amountPaid;
    }

    public String getPaymentStatus() {
        return paymentStatus;
    }

    public void setPaymentStatus(String paymentStatus) {
        this.paymentStatus = paymentStatus;
    }

    public String getPaymentMethod() {
        return paymentMethod;
    }

    public void setPaymentMethod(String paymentMethod) {
        this.paymentMethod = paymentMethod;
    }

    public String getPaymentTransactionRef() {
        return paymentTransactionRef;
    }

    public void setPaymentTransactionRef(String paymentTransactionRef) {
        this.paymentTransactionRef = paymentTransactionRef;
    }

    public Instant getPaymentUpdatedAt() {
        return paymentUpdatedAt;
    }

    public void setPaymentUpdatedAt(Instant paymentUpdatedAt) {
        this.paymentUpdatedAt = paymentUpdatedAt;
    }

    public String getShipmentStage() {
        return shipmentStage;
    }

    public void setShipmentStage(String shipmentStage) {
        this.shipmentStage = shipmentStage;
    }

    public String getShipmentUpdateNote() {
        return shipmentUpdateNote;
    }

    public void setShipmentUpdateNote(String shipmentUpdateNote) {
        this.shipmentUpdateNote = shipmentUpdateNote;
    }

    public Instant getShipmentUpdatedAt() {
        return shipmentUpdatedAt;
    }

    public void setShipmentUpdatedAt(Instant shipmentUpdatedAt) {
        this.shipmentUpdatedAt = shipmentUpdatedAt;
    }

    public Double getCurrentPackageLat() {
        return currentPackageLat;
    }

    public void setCurrentPackageLat(Double currentPackageLat) {
        this.currentPackageLat = currentPackageLat;
    }

    public Double getCurrentPackageLng() {
        return currentPackageLng;
    }

    public void setCurrentPackageLng(Double currentPackageLng) {
        this.currentPackageLng = currentPackageLng;
    }

    public Boolean getSosActive() {
        return sosActive;
    }

    public void setSosActive(Boolean sosActive) {
        this.sosActive = sosActive;
    }

    public String getSosMessage() {
        return sosMessage;
    }

    public void setSosMessage(String sosMessage) {
        this.sosMessage = sosMessage;
    }

    public Instant getSosRaisedAt() {
        return sosRaisedAt;
    }

    public void setSosRaisedAt(Instant sosRaisedAt) {
        this.sosRaisedAt = sosRaisedAt;
    }

    public Instant getSosResolvedAt() {
        return sosResolvedAt;
    }

    public void setSosResolvedAt(Instant sosResolvedAt) {
        this.sosResolvedAt = sosResolvedAt;
    }

    public String getSosResolvedBy() {
        return sosResolvedBy;
    }

    public void setSosResolvedBy(String sosResolvedBy) {
        this.sosResolvedBy = sosResolvedBy;
    }

    public Integer getCustomerRating() {
        return customerRating;
    }

    public void setCustomerRating(Integer customerRating) {
        this.customerRating = customerRating;
    }

    public String getCustomerFeedback() {
        return customerFeedback;
    }

    public void setCustomerFeedback(String customerFeedback) {
        this.customerFeedback = customerFeedback;
    }

    public Instant getCustomerFeedbackAt() {
        return customerFeedbackAt;
    }

    public void setCustomerFeedbackAt(Instant customerFeedbackAt) {
        this.customerFeedbackAt = customerFeedbackAt;
    }

    public String getCancelReason() {
        return cancelReason;
    }

    public void setCancelReason(String cancelReason) {
        this.cancelReason = cancelReason;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(Instant updatedAt) {
        this.updatedAt = updatedAt;
    }
}
