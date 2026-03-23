package com.example.logistics.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

import com.example.logistics.entity.Ride;
import com.example.logistics.entity.RideStatus;

public interface RideRepository extends JpaRepository<Ride, Long> {
    List<Ride> findByStatusInOrderByUpdatedAtDesc(List<RideStatus> statuses);
    List<Ride> findByCustomerIdOrderByUpdatedAtDesc(Long customerId);
    List<Ride> findByDriverIdOrderByUpdatedAtDesc(Long driverId);
}
