package com.example.logistics.repository;

import com.example.logistics.entity.AnomalyEvent;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface AnomalyEventRepository extends JpaRepository<AnomalyEvent, Long> {

    List<AnomalyEvent> findByAcknowledgedFalseOrderByDetectedAtDesc();

    List<AnomalyEvent> findByVehicleIdOrderByDetectedAtDesc(int vehicleId);

    List<AnomalyEvent> findTop50ByOrderByDetectedAtDesc();
}
