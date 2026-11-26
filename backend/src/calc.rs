use serde::{Deserialize, Serialize};

pub const TARIFF_PER_KWH: i64 = 1445;
pub const EMISSION_FACTOR: f64 = 0.85;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum Transport {
    Public,
    Motor,
    Car,
}

impl Transport {
    pub fn monthly_co2_kg(self) -> i32 {
        match self {
            Transport::Public => 25,
            Transport::Motor => 65,
            Transport::Car => 180,
        }
    }

    pub fn as_str(self) -> &'static str {
        match self {
            Transport::Public => "public",
            Transport::Motor => "motor",
            Transport::Car => "car",
        }
    }
}

#[derive(Debug, Clone, Deserialize)]
pub struct AssessmentInput {
    pub kwh_monthly: i32,
    pub ac_hours: i32,
    pub transport: Transport,
    pub led: bool,
    pub unplug: bool,
}

#[derive(Debug, Serialize, PartialEq)]
pub struct Assessment {
    pub effective_kwh: i32,
    pub total_co2_kg: i32,
    pub cost_rp: i64,
    pub trees: i32,
    pub grade: String,
    pub title: String,
    pub description: String,
    pub recommendations: Vec<String>,
}

#[derive(Debug, Serialize, PartialEq)]
pub struct AssessmentComparison {
    pub before: Assessment,
    pub after: Assessment,
    pub saved_kwh: i32,
    pub saved_co2_kg: i32,
    pub saved_cost_rp: i64,
    pub saved_cost_yearly_rp: i64,
    pub saved_trees: i32,
}

impl AssessmentInput {
    pub fn validate(&self) -> Result<(), String> {
        if !(50..=2000).contains(&self.kwh_monthly) {
            return Err("kwh_monthly must be between 50 and 2000".into());
        }

        if !(0..=24).contains(&self.ac_hours) {
            return Err("ac_hours must be between 0 and 24".into());
        }

        Ok(())
    }

    pub fn calculate(&self) -> Assessment {
        let mut multiplier = 1.0;

        if self.led {
            multiplier -= 0.08;
        }

        if self.unplug {
            multiplier -= 0.07;
        }

        let ac_extra_kwh = if self.ac_hours > 8 {
            (self.ac_hours - 8) * 18
        } else {
            0
        };

        let effective_kwh =
            (((self.kwh_monthly + ac_extra_kwh) as f64) * multiplier)
                .round() as i32;

        let electricity_co2 = effective_kwh as f64 * EMISSION_FACTOR;

        let total_co2_kg =
            (electricity_co2 + self.transport.monthly_co2_kg() as f64)
                .round() as i32;

        let cost_rp = effective_kwh as i64 * TARIFF_PER_KWH;

        let trees = ((total_co2_kg + 17) / 18).max(1);

        let (grade, title, description) = grade_for(total_co2_kg);

        let mut recommendations = Vec::new();

        if self.ac_hours > 8 {
            recommendations.push(format!(
                "Kurangi durasi AC dari {} jam menjadi 8 jam/hari & gunakan fitur timer malam hari.",
                self.ac_hours
            ));
        }

        if !self.led {
            recommendations.push(
                "Ganti seluruh lampu rumah ke LED untuk memangkas konsumsi daya penerangan hingga 85%."
                    .into(),
            );
        }

        if !self.unplug {
            recommendations.push(
                "Gunakan stopkontak bersaklar untuk memutus standby power TV, konsol, dan charger."
                    .into(),
            );
        }

        if self.transport == Transport::Car {
            recommendations.push(
                "Ganti perjalanan mobil pribadi 2 hari/minggu dengan transportasi umum untuk hemat ~50 kg CO₂/bln."
                    .into(),
            );
        }

        if effective_kwh > 450 {
            recommendations.push(
                "Pertimbangkan pemasangan PLTS Atap (Solar Panel) atau periksa insulasi ruangan ber-AC."
                    .into(),
            );
        }

        if recommendations.is_empty() {
            recommendations.push(
                "Pertahankan kebiasaan hebat Anda! Bagikan kalkulator ini untuk menginspirasi keluarga dan tetangga."
                    .into(),
            );
        }

        Assessment {
            effective_kwh,
            total_co2_kg,
            cost_rp,
            trees,
            grade: grade.into(),
            title: title.into(),
            description: description.into(),
            recommendations,
        }
    }

    pub fn calculate_comparison(&self) -> AssessmentComparison {
        // The user's current situation.
        let before = self.calculate();

        // Simulate adopting all the electricity-saving habits.
        let mut improved = self.clone();

        improved.led = true;
        improved.unplug = true;
        improved.ac_hours = improved.ac_hours.min(8);

        // Calculate the improved situation using the same Rust formula.
        let after = improved.calculate();

        let saved_kwh = before.effective_kwh - after.effective_kwh;
        let saved_co2_kg = before.total_co2_kg - after.total_co2_kg;
        let saved_cost_rp = before.cost_rp - after.cost_rp;

        AssessmentComparison {
            saved_kwh,
            saved_co2_kg,
            saved_cost_rp,
            saved_cost_yearly_rp: saved_cost_rp * 12,
            saved_trees: before.trees.saturating_sub(after.trees),
            before,
            after,
        }
    }
}

pub fn grade_for(co2_kg: i32) -> (&'static str, &'static str, &'static str) {
    match co2_kg {
        0..=220 => (
            "A",
            "Sangat Efisien (Teladan SDG 12)",
            "Luar biasa! Pola konsumsi energi Anda sangat hemat dan ramah lingkungan.",
        ),
        221..=360 => (
            "B",
            "Efisien (Baik)",
            "Konsumsi energi Anda terkendali, namun masih ada ruang untuk penghematan.",
        ),
        361..=550 => (
            "C",
            "Moderat (Rata-Rata)",
            "Konsumsi energi cukup tinggi. Pertimbangkan mengurangi jam AC atau beralih transportasi.",
        ),
        551..=800 => (
            "D",
            "Boros Energi (Perlu Perbaikan)",
            "Jejak karbon dan tagihan listrik Anda tergolong tinggi. Terapkan langkah efisiensi segera.",
        ),
        _ => (
            "E",
            "Sangat Boros (Kritis)",
            "Konsumsi energi sangat tinggi! Audit peralatan rumah tangga dan pola perjalanan Anda.",
        ),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn baseline() -> AssessmentInput {
        AssessmentInput {
            kwh_monthly: 300,
            ac_hours: 6,
            transport: Transport::Public,
            led: true,
            unplug: false,
        }
    }

    #[test]
    fn baseline_assessment_matches_contract() {
        let result = baseline().calculate();

        assert_eq!(result.effective_kwh, 276);
        assert_eq!(result.total_co2_kg, 260);
        assert_eq!(result.cost_rp, 398_820);
        assert_eq!(result.trees, 15);
        assert_eq!(result.grade, "B");
        assert_eq!(result.recommendations.len(), 1);
    }

    #[test]
    fn combined_habits_and_ac_load() {
        let input = AssessmentInput {
            kwh_monthly: 500,
            ac_hours: 10,
            transport: Transport::Car,
            led: true,
            unplug: true,
        };

        let result = input.calculate();

        // (500 + 36) * 0.85 = 455.6 -> 456 kWh
        assert_eq!(result.effective_kwh, 456);

        // 456 * 0.85 + 180 = 567.6 -> 568 kg
        assert_eq!(result.total_co2_kg, 568);

        assert_eq!(result.grade, "D");
        assert_eq!(result.recommendations.len(), 3);
    }

    #[test]
    fn comparison_calculates_both_scenarios() {
        let input = AssessmentInput {
            kwh_monthly: 500,
            ac_hours: 10,
            transport: Transport::Car,
            led: false,
            unplug: false,
        };

        let result = input.calculate_comparison();

        assert_eq!(result.before.effective_kwh, 536);
        assert_eq!(result.after.effective_kwh, 425);

        assert_eq!(result.saved_kwh, 111);
        assert_eq!(result.saved_co2_kg, 95);
        assert_eq!(result.saved_cost_rp, 160_395);
        assert_eq!(result.saved_cost_yearly_rp, 1_924_740);

        assert!(result.after.total_co2_kg <= result.before.total_co2_kg);
        assert!(result.after.trees <= result.before.trees);
    }

    #[test]
    fn comparison_does_not_reduce_already_improved_inputs() {
        let input = AssessmentInput {
            kwh_monthly: 300,
            ac_hours: 6,
            transport: Transport::Public,
            led: true,
            unplug: true,
        };

        let result = input.calculate_comparison();

        assert_eq!(result.saved_kwh, 0);
        assert_eq!(result.saved_co2_kg, 0);
        assert_eq!(result.saved_cost_rp, 0);
        assert_eq!(result.saved_trees, 0);
    }

    #[test]
    fn validation_rejects_out_of_range() {
        let extra_low = AssessmentInput {
            kwh_monthly: 10,
            ..baseline()
        };

        assert!(extra_low.validate().is_err());

        let ac_high = AssessmentInput {
            ac_hours: 25,
            ..baseline()
        };

        assert!(ac_high.validate().is_err());
        assert!(baseline().validate().is_ok());
    }

    #[test]
    fn grade_boundaries_are_inclusive() {
        assert_eq!(grade_for(220).0, "A");
        assert_eq!(grade_for(221).0, "B");
        assert_eq!(grade_for(360).0, "B");
        assert_eq!(grade_for(361).0, "C");
        assert_eq!(grade_for(550).0, "C");
        assert_eq!(grade_for(551).0, "D");
        assert_eq!(grade_for(800).0, "D");
        assert_eq!(grade_for(801).0, "E");
    }
}