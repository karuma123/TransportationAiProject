package com.example.logistics.repository;

import com.example.logistics.entity.GpsPoint;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface GpsPointRepository extends JpaRepository<GpsPoint, Long> {

    List<GpsPoint> findByVehicleIdOrderByTimestampDesc(int vehicleId);
    GpsPoint findTopByDriverIdOrderByTimestampDesc(int driverId);

    @Query(value = "SELECT * FROM gps_points WHERE vehicle_id = ?1 ORDER BY timestamp DESC LIMIT ?2",
           nativeQuery = true)
    List<GpsPoint> findRecentByVehicleId(int vehicleId, int limit);

    @Query(value = """
        SELECT DISTINCT ON (vehicle_id) * 
        FROM gps_points 
        ORDER BY vehicle_id, timestamp DESC
        """, nativeQuery = true)
    List<GpsPoint> findLatestForAllVehicles();
}
