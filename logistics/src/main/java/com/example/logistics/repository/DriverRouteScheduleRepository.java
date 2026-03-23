package com.example.logistics.repository;

import java.time.Instant;
import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

import com.example.logistics.entity.DriverRouteSchedule;

public interface DriverRouteScheduleRepository extends JpaRepository<DriverRouteSchedule, Long> {

    List<DriverRouteSchedule> findByDriverIdOrderByDepartureAtAsc(Long driverId);

    List<DriverRouteSchedule> findByActiveTrueAndCapacityAvailableGreaterThanAndDepartureAtAfterOrderByDepartureAtAsc(
            Integer minCapacity,
            Instant after
    );
}
