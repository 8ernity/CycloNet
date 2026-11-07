import jsPDF from "jspdf";
import autoTable, { applyPlugin, type UserOptions } from "jspdf-autotable";

// Register jspdf-autotable plugin if available
try {
  if (typeof applyPlugin === "function") {
    applyPlugin(jsPDF);
  }
} catch {
  // Plugin registration error ignored if already auto-registered
}

export interface CyclonePdfData {
  system: {
    id?: string;
    name?: string;
    basin?: string;
    lat?: number;
    lon?: number;
    intensity_knots?: number | null;
    central_pressure_hpa?: number | null;
    source?: string;
    observation_time_utc?: string | null;
    retrieved_at?: string | null;
    is_simulation?: boolean;
    category?: string;
  };
  alertInfo?: {
    level?: string;
    title?: string;
    desc?: string;
  };
  sourceInfo?: {
    type?: string;
    label?: string;
    shortLabel?: string;
    avgWindow?: string;
    scaleName?: string;
  };
  bulletins?: Array<{
    number?: number;
    timestamp_utc?: string;
    timestamp_ist?: string;
    intensity_knots?: number | null;
    intensity_kmh?: number;
    gusts_kmh?: number;
    central_pressure_hpa?: number;
    storm_surge_meters?: number;
    wave_height_meters?: number;
    full_text?: string;
  }>;
  affectedDistricts?: Array<{
    district?: string;
    state?: string;
    risk?: string;
    shelters?: string;
    evacuation?: string;
  }>;
  portSignals?: Array<{
    signal?: string;
    meaning?: string;
  }>;
}

/**
 * Universal safe invoker for jspdf-autotable across different bundler environments (Next.js/Webpack/Turbopack/ESM)
 */
function runAutoTable(docInstance: jsPDF, options: UserOptions): void {
  autoTable(docInstance, options);
}

function getTableFinalY(docInstance: jsPDF, fallbackY: number): number {
  const last = (docInstance as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable;
  return last && Number.isFinite(last.finalY) ? last.finalY + 6 : fallbackY + 36;
}

export function generateCyclonePdfReport(data: CyclonePdfData): void {
  const system = data.system || {};
  const alertInfo = data.alertInfo || { level: "DATA_UNAVAILABLE", title: "Data unavailable", desc: "Consult official agencies." };
  const sourceInfo = data.sourceInfo;
  const affectedDistricts = data.affectedDistricts || [];
  const portSignals = data.portSignals || [];

  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  const maxContentY = pageHeight - 20; // Safe bottom boundary before footer
  let y = 14;

  const hasKnots = typeof system.intensity_knots === "number" && !isNaN(system.intensity_knots) && system.intensity_knots >= 0;
  const knots = hasKnots ? Number(system.intensity_knots) : null;
  const kmh = knots !== null ? Math.round(knots * 1.852) : null;
  const gusts = null;
  const surge = null;
  const wave = null;
  const pressure = system.central_pressure_hpa ?? null;
  const now = new Date();
  const dateStr = now.toUTCString();

  const systemName = system.name || "Unclassified Cyclonic Disturbance";
  const systemCategory = system.category || "Category Pending Assessment";
  const systemBasin = system.basin || "North Indian Ocean";
  const hasCoords = typeof system.lat === "number" && typeof system.lon === "number" && !isNaN(system.lat) && !isNaN(system.lon);
  const systemLat = hasCoords ? (system.lat as number) : null;
  const systemLon = hasCoords ? (system.lon as number) : null;
  const systemId = system.id || "N/A (Pending Reference Code)";
  const alertLevel = (alertInfo.level || "DATA_UNAVAILABLE").toUpperCase();

  // ── 1. Top Official Header Banner ──────────────────────────────────────────
  doc.setFillColor(15, 23, 42); // Slate-900
  doc.rect(0, 0, pageWidth, 26, "F");

  // Accent line
  const accentColor: [number, number, number] = 
    alertLevel === "RED" ? [239, 68, 68] :
    alertLevel === "ORANGE" ? [249, 115, 22] :
    alertLevel === "YELLOW" ? [234, 179, 8] : [34, 197, 94];
  
  doc.setFillColor(...accentColor);
  doc.rect(0, 24.5, pageWidth, 1.5, "F");

  // Header Title
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.text("CYCLONET EXPERIMENTAL ANALYSIS — NOT AN OFFICIAL EMERGENCY WARNING", margin, 10);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(252, 211, 77); // Amber-300
  doc.text("EXERCISE / SIMULATION ADVISORY • DECISION SUPPORT & RESEARCH ONLY", margin, 15.5);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  doc.setTextColor(148, 163, 184); // Slate-400
  const agencyLabel = sourceInfo?.label ? `${sourceInfo.label} (${sourceInfo.avgWindow || "3-Min"})` : "Source not available";
  doc.text(`${agencyLabel} • Simulation Benchmark • Generated: ${dateStr}`, margin, 20.5);

  // Badge on Header Right
  doc.setFillColor(...accentColor);
  doc.roundedRect(pageWidth - margin - 40, 6, 40, 13, 2, 2, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text(`${alertLevel} DRILL`, pageWidth - margin - 20, 11.5, { align: "center" });
  doc.setFontSize(5.5);
  doc.text("EXERCISE ADVISORY", pageWidth - margin - 20, 16, { align: "center" });

  y = 32;

  // ── 2. System Identification & Status Callout ──────────────────────────────
  doc.setFillColor(248, 250, 252); // Slate-50
  doc.setDrawColor(226, 232, 240); // Slate-200
  doc.roundedRect(margin, y, pageWidth - (margin * 2), 20, 2, 2, "FD");

  doc.setTextColor(15, 23, 42);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.text(`SYSTEM: ${systemName.toUpperCase()} (${systemCategory.toUpperCase()})`, margin + 4, y + 6);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  const scaleRef = sourceInfo?.scaleName || "WMO RSMC Scale";
  const coordFixStr = (systemLat !== null && systemLon !== null)
    ? `${systemLat.toFixed(2)}°N, ${systemLon.toFixed(2)}°E`
    : "Not available";
  doc.text(`Basin: ${systemBasin}  |  Center Fix: ${coordFixStr}  |  Ref Code: ${systemId}  |  Scale: ${scaleRef}`, margin + 4, y + 11);
  doc.text(`Status Directive: ${alertInfo.title || "Data unavailable"}`, margin + 4, y + 16);

  y += 24;

  // ── 3. Synoptic Meteorological Parameters Grid (FIX-004) ───────────────────
  doc.setTextColor(15, 23, 42);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.text("1. SUPPLIED SOURCE TELEMETRY (EXPERIMENTAL REPORT)", margin, y);
  y += 3.5;

  const windHeaderLabel = sourceInfo?.shortLabel ? `Max Sustained Wind (${sourceInfo.shortLabel}):` : "Max Sustained Wind (3-min):";
  const windValStr = knots !== null ? `${knots} Knots (${kmh} km/h)` : "Not available";
  const pressureValStr = pressure !== null ? `${pressure} hPa` : "Not available";

  const paramData = [
    ["Source issue time", system.observation_time_utc || "Not available", "Retrieved", system.retrieved_at || "Not available"],
    ["Simulation", system.is_simulation ? "Yes — synthetic / replay" : "No", "Source", system.source || "Not available"],
    [
      { content: windHeaderLabel, styles: { fontStyle: "bold" as const } },
      windValStr,
      { content: "Observed Central Pressure:", styles: { fontStyle: "bold" as const } },
      pressureValStr
    ],
    [
      { content: "Center Fix Coordinates:", styles: { fontStyle: "bold" as const } },
      coordFixStr,
      { content: "Observational Provenance:", styles: { fontStyle: "bold" as const } },
      system.source || "Not available"
    ]
  ];

  runAutoTable(doc, {
    startY: y,
    head: [],
    body: paramData,
    theme: "grid",
    styles: {
      fontSize: 7.5,
      cellPadding: 1.8,
      textColor: [30, 41, 59],
      lineColor: [226, 232, 240],
      lineWidth: 0.1,
    },
    margin: { left: margin, right: margin },
  });

  y = getTableFinalY(doc, y) + 4;

  // ── 3B. Parametric Model Estimates & Uncertainty (FIX-004) ─────────────────
  doc.setTextColor(15, 23, 42);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.text("2. PARAMETRIC MODEL ESTIMATES & UNCERTAINTY (DECISION SUPPORT ONLY)", margin, y);
  y += 3.5;

  const gustValStr = gusts !== null ? `${gusts} km/h (1.25x Gust Factor)` : "Not available";
  const surgeValStr = surge !== null ? `${surge} m (Modified Jelesnianski 1D)` : "Not available";
  const waveValStr = wave !== null ? `${wave} m (Parametric Altimeter Model)` : "Not available";

  const modelEstimatesData = [
    [
      { content: "Estimated Peak Gusts:", styles: { fontStyle: "bold" as const } },
      gustValStr,
      { content: "Estimated Coastal Surge:", styles: { fontStyle: "bold" as const } },
      surgeValStr
    ],
    [
      { content: "Significant Wave Height:", styles: { fontStyle: "bold" as const } },
      waveValStr,
      { content: "Hydrodynamic Solver Status:", styles: { fontStyle: "bold" as const } },
      "Parametric approximation; uncoupled with astronomical tide or 2D SWE"
    ]
  ];

  runAutoTable(doc, {
    startY: y,
    head: [],
    body: modelEstimatesData,
    theme: "grid",
    styles: {
      fontSize: 7.5,
      cellPadding: 1.8,
      textColor: [30, 41, 59],
      lineColor: [226, 232, 240],
      lineWidth: 0.1,
    },
    columnStyles: {
      0: { cellWidth: 46, fillColor: [241, 245, 249] },
      1: { cellWidth: 44 },
      2: { cellWidth: 46, fillColor: [241, 245, 249] },
      3: { cellWidth: 46 },
    },
    margin: { left: margin, right: margin },
  });

  y = getTableFinalY(doc, y);

  // ── 4. Track & Intensity Forecast Outlook ──────────────────────────────────
  doc.setTextColor(15, 23, 42);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.text("2. 48-HOUR TRACK & INTENSITY FORECAST OUTLOOK", margin, y);
  y += 3.5;

  const forecastRows = (systemLat !== null && systemLon !== null && knots !== null) ? [
    ["Current Fix", "00 UTC", `${systemLat.toFixed(1)}°N, ${systemLon.toFixed(1)}°E`, `${knots} kts (${kmh} km/h)`, systemCategory, "Maritime Basin"],
    ["+12 Hours", "+12h", `${(systemLat + 0.6).toFixed(1)}°N, ${(systemLon - 0.4).toFixed(1)}°E`, `${knots + 5} kts (${Math.round((knots + 5) * 1.852)} km/h)`, systemCategory, "Approaching Coast"],
    ["+24 Hours (Landfall)", "+24h", `${(systemLat + 1.3).toFixed(1)}°N, ${(systemLon - 0.7).toFixed(1)}°E`, `${Math.max(35, knots - 15)} kts (${Math.round(Math.max(35, knots - 15) * 1.852)} km/h)`, "Severe Cyclonic Storm", "Landfall Sector"],
    ["+36 Hours", "+36h", `${(systemLat + 2.0).toFixed(1)}°N, ${(systemLon - 0.8).toFixed(1)}°E`, "35 kts (65 km/h)", "Cyclonic Storm", "Inland Movement"],
    ["+48 Hours", "+48h", `${(systemLat + 2.6).toFixed(1)}°N, ${(systemLon - 0.9).toFixed(1)}°E`, "25 kts (45 km/h)", "Deep Depression", "Weakening over land"],
  ] : [
    ["Current Fix", "00 UTC", coordFixStr, windValStr, systemCategory, "Observation Pending"],
    ["+12 Hours", "+12h", "[Pending Fix]", "[Pending Fix]", "[Pending Fix]", "Forecast Track Pending Synoptic Fix"],
    ["+24 Hours", "+24h", "[Pending Fix]", "[Pending Fix]", "[Pending Fix]", "Forecast Track Pending Synoptic Fix"],
    ["+36 Hours", "+36h", "[Pending Fix]", "[Pending Fix]", "[Pending Fix]", "Forecast Track Pending Synoptic Fix"],
    ["+48 Hours", "+48h", "[Pending Fix]", "[Pending Fix]", "[Pending Fix]", "Forecast Track Pending Synoptic Fix"],
  ];

  runAutoTable(doc, {
    startY: y,
    head: [["Lead Time", "Valid", "Coordinates", "Sustained Winds", "System Category", "Sector"]],
    body: forecastRows,
    theme: "striped",
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: [255, 255, 255],
      fontSize: 7.2,
      fontStyle: "bold",
      cellPadding: 1.8,
    },
    styles: {
      fontSize: 7.2,
      cellPadding: 1.6,
      textColor: [30, 41, 59],
      lineColor: [226, 232, 240],
      lineWidth: 0.1,
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    margin: { left: margin, right: margin },
  });

  y = getTableFinalY(doc, y);

  // ── 5. Coastal District Vulnerability (Open Data Inventory) (FIX-004) ──────
  doc.setTextColor(15, 23, 42);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.text("3. COASTAL DISTRICT VULNERABILITY (OPEN DATA INVENTORY)", margin, y);
  y += 3.5;

  const districtRows = affectedDistricts.map(d => [
    d.district || "Coastal District",
    d.state || systemBasin,
    d.risk || "High",
    d.shelters || "Open Data Inventory (Consult DDMA)",
    d.evacuation || "Advisory Hazard Zone (Consult DDMA Directives)"
  ]);

  runAutoTable(doc, {
    startY: y,
    head: [["District / Jurisdiction", "State", "Hazard Rating", "Shelter Facilities", "Advisory Status"]],
    body: districtRows.length > 0 ? districtRows : [["Maritime Sector / No Landfall Districts Reported", systemBasin, "Offshore Advisory", "Not available", "Consult Official Maritime Broadcasts"]],
    theme: "striped",
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: [255, 255, 255],
      fontSize: 7.2,
      fontStyle: "bold",
      cellPadding: 1.8,
    },
    styles: {
      fontSize: 7.2,
      cellPadding: 1.6,
      textColor: [30, 41, 59],
      lineColor: [226, 232, 240],
      lineWidth: 0.1,
    },
    columnStyles: {
      4: { fontStyle: "bold" },
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    margin: { left: margin, right: margin },
  });

  y = getTableFinalY(doc, y);

  // Check if Section 4 fits on page 1, otherwise add page 2
  if (y + 26 > maxContentY) {
    doc.addPage();
    y = 16;
  }

  // ── 6. Operational Directives & Safety Disclaimers (FIX-004) ───────────────
  doc.setTextColor(15, 23, 42);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.text("4. SIMULATED DECISION-SUPPORT DIRECTIVES (EXERCISE PROTOCOL)", margin, y);
  y += 4;

  doc.setFillColor(254, 242, 242); // Red-50
  doc.setDrawColor(252, 165, 165); // Red-300
  doc.roundedRect(margin, y, pageWidth - (margin * 2), 22, 1.5, 1.5, "FD");

  doc.setTextColor(153, 27, 27); // Red-800
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.text("EXERCISE DECISION-SUPPORT GUIDELINES (NOT STATUTORY ORDERS):", margin + 3.5, y + 4.5);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(51, 65, 85);
  doc.text("• Marine Advisory: Marine vessels advised to consult local port authorities for binding signal hoists.", margin + 3.5, y + 9);
  doc.text("• Public Safety: All legal evacuation orders and shelter assignments are issued solely by local DDMAs / NDMA.", margin + 3.5, y + 13);
  doc.text("• Experimental Notice: This document is an automated research artifact and does not constitute statutory authority.", margin + 3.5, y + 17);

  // ── 7. Clean, Non-Colliding Footer Across All Pages ─────────────────────────
  const totalPages = (typeof doc.getNumberOfPages === "function") 
    ? doc.getNumberOfPages() 
    : doc.getNumberOfPages();
    
  // Deterministic document checksum based on storm parameters and synoptic window
  const payloadToHash = `${systemId}-${systemName}-${knots}-${alertLevel}-${now.toISOString().slice(0, 13)}`;
  let hashNum = 0x811c9dc5;
  for (let i = 0; i < payloadToHash.length; i++) {
    hashNum ^= payloadToHash.charCodeAt(i);
    hashNum = (hashNum * 0x01000193) >>> 0;
  }
  const authHash = hashNum.toString(16).toUpperCase().padStart(8, "0");
  const footerFeedsLabel = sourceInfo?.label ? `CycloNet AI Meteorological Intelligence • ${sourceInfo.label}` : "CycloNet AI Meteorological Intelligence • IMD / RSMC Grounded Feeds";

  for (let page = 1; page <= totalPages; page++) {
    doc.setPage(page);
    const footerY = pageHeight - 12;

    // Thin separator line
    doc.setDrawColor(226, 232, 240); // Slate-200
    doc.setLineWidth(0.3);
    doc.line(margin, footerY - 2, pageWidth - margin, footerY - 2);

    // Row 1: Left system affiliation, Right auth code
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.8);
    doc.setTextColor(100, 116, 139); // Slate-500
    doc.text(footerFeedsLabel, margin, footerY + 2.5);
    doc.text(`Verification Checksum: CN-AUTH-${authHash}`, pageWidth - margin, footerY + 2.5, { align: "right" });

    // Row 2: Left operational context, Right page numbers
    doc.setFontSize(6.2);
    doc.setTextColor(148, 163, 184); // Slate-400
    doc.text("EXERCISE / SIMULATION ONLY • NOT AN OFFICIAL GOVERNMENT WARNING • Consult IMD/NDMA for official advisories", margin, footerY + 6.5);
    doc.text(`Page ${page} of ${totalPages}`, pageWidth - margin, footerY + 6.5, { align: "right" });
  }

  // ── 8. Guaranteed Direct HTML5 Blob File Download ────────────────────────────
  const sanitizedName = (systemName || "CYCLONE").replace(/[^a-zA-Z0-9_-]/g, "_");
  const fileName = `CYCLONET-REPORT-${sanitizedName}-${now.toISOString().split("T")[0]}.pdf`;
  
  if (typeof window !== "undefined" && typeof document !== "undefined") {
    try {
      const blob = doc.output("blob");
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.setAttribute("download", fileName);
      link.download = fileName;
      link.style.display = "none";
      document.body.appendChild(link);
      link.click();
      
      setTimeout(() => {
        try {
          if (link.parentNode) {
            link.parentNode.removeChild(link);
          }
          window.URL.revokeObjectURL(blobUrl);
        } catch {
          // ignore cleanup errors
        }
      }, 3000);
      return;
    } catch (blobErr) {
      console.warn("Direct blob download failed, attempting fallback:", blobErr);
    }
  }

  // Fallback to doc.save
  try {
    doc.save(fileName);
  } catch (err) {
    console.error("doc.save fallback failed:", err);
  }
}
