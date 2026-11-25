"use client";

import { useState, useEffect } from "react";
import type { RainfallPathway, SurgeCalculation, SurgeSector, WeatherSystem } from "@/types/api";
import { apiFetch } from "@/lib/api";

export function useScenarioCalculation(
  scenarioMode: boolean,
  selectedCycloneId: string | null,
  system: WeatherSystem | null
) {
  const [simPressureHpa, setSimPressureHpa] = useState<number>(945);
  const [simWindKts, setSimWindKts] = useState<number>(115);
  const [simTideM, setSimTideM] = useState<number>(1.8);
  const [simAngleDeg, setSimAngleDeg] = useState<number>(75);
  const simForwardSpeed = 18;
  const simRainMm = 240;

  const scenarioKey = JSON.stringify([
    scenarioMode,
    selectedCycloneId,
    system,
    simWindKts,
    simPressureHpa,
    simTideM,
    simAngleDeg,
  ]);
  const [scenarioResult, setScenarioResult] = useState<{
    key: string;
    surge: SurgeCalculation;
    sectors: SurgeSector[];
    pathways: RainfallPathway[];
  } | null>(null);
  const [scenarioError, setScenarioError] = useState(false);
  const [scenarioRetry, setScenarioRetry] = useState(0);

  const currentScenario = scenarioMode && scenarioResult?.key === scenarioKey ? scenarioResult : null;

  useEffect(() => {
    const controller = new AbortController();
    async function fetchSurgeAndGee() {
      setScenarioResult(null);
      setScenarioError(false);
      if (!scenarioMode) return;
      try {
        const lat = system?.lat ?? 18.2;
        const lon = system?.lon ?? 84.8;
        const basin = system?.basin || "Bay of Bengal";
        const options = { signal: controller.signal, maxRetries: 0 };

        const [surge, sectors, pathways] = await Promise.all([
          apiFetch<SurgeCalculation>(
            `/api/surge/calculate?knots=${simWindKts}&pressure_hpa=${simPressureHpa}&forward_speed=${simForwardSpeed}&angle_deg=${simAngleDeg}&tide_m=${simTideM}&basin=${encodeURIComponent(basin)}`,
            options
          ),
          apiFetch<{ sectors: SurgeSector[] }>(
            `/api/surge/profile?name=${encodeURIComponent(system?.name || "Cyclone")}&lat=${lat}&lon=${lon}&knots=${simWindKts}`,
            options
          ),
          apiFetch<{ pathways: RainfallPathway[] }>(
            `/api/gee/rainfall-pathways?lat=${lat}&lon=${lon}&rain_mm=${simRainMm}`,
            options
          ),
        ]);

        if (controller.signal.aborted) return;
        if (
          !surge ||
          !Number.isFinite(surge.peak_surge_height_m) ||
          !Array.isArray(sectors?.sectors) ||
          !Array.isArray(pathways?.pathways)
        ) {
          throw new Error("Invalid scenario response");
        }
        setScenarioResult({
          key: scenarioKey,
          surge,
          sectors: sectors.sectors,
          pathways: pathways.pathways,
        });
      } catch (err) {
        if (controller.signal.aborted) return;
        setScenarioError(true);
        controller.abort();
        console.error("Scenario calculation unavailable", err);
      }
    }
    const debounce = window.setTimeout(() => void fetchSurgeAndGee(), 350);
    return () => {
      controller.abort();
      window.clearTimeout(debounce);
    };
  }, [scenarioMode, system, simWindKts, simPressureHpa, simTideM, simForwardSpeed, simAngleDeg, simRainMm, scenarioRetry, scenarioKey]);

  return {
    simPressureHpa,
    setSimPressureHpa,
    simWindKts,
    setSimWindKts,
    simTideM,
    setSimTideM,
    simAngleDeg,
    setSimAngleDeg,
    simRainMm,
    scenarioKey,
    surgeCalcData: currentScenario?.surge ?? null,
    surgeSectors: currentScenario?.sectors ?? [],
    rainfallPathways: currentScenario?.pathways ?? [],
    scenarioError,
    retryScenario: () => setScenarioRetry((v) => v + 1),
  };
}
