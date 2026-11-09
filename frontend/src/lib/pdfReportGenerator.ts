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
    source?: string | null;
    observation_time_utc?: string | null;
    retrieved_at?: string | null;
    is_simulation?: boolean;
    wind_averaging_minutes?: number | null;
    wind_convention?: string | null;
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
  const affectedDistricts = data.affectedDistricts || [];

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

  const hasKnots = typeof system.intensity_knots === "number" && Number.isFinite(system.intensity_knots) && system.intensity_knots >= 0;
  const knots = hasKnots ? Number(system.intensity_knots) : null;
  const kmh = knots !== null ? Math.round(knots * 1.852) : null;
  const gusts = null;
  const surge = null;
  const wave = null;
  const pressure = typeof system.central_pressure_hpa === 'number' && Number.isFinite(system.central_pressure_hpa) && system.central_pressure_hpa > 0 ? system.central_pressure_hpa : null;
  const now = new Date();
  const dateStr = now.toUTCString();

  const systemName = system.name || "Unclassified Cyclonic Disturbance";
  const systemCategory = system.category || "Category Pending Assessment";
  const systemBasin = system.basin || "Not available";
  const hasCoords = typeof system.lat === "number" && typeof system.lon === "number" && Number.isFinite(system.lat) && Number.isFinite(system.lon) && Math.abs(system.lat) <= 90 && Math.abs(system.lon) <= 180;
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
  doc.text("CYCLONET | EXPERIMENTAL SOURCE SUMMARY", margin, 10);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(252, 211, 77); // Amber-300
  doc.text("NOT AN OFFICIAL WARNING OR OPERATIONAL FORECAST", margin, 15.5);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  doc.setTextColor(148, 163, 184); // Slate-400
  const agencyLabel = system.source || "Source not available";
  doc.text(`Generated: ${dateStr}`, margin, 20.5);

  // Badge on Header Right
  doc.setFillColor(...accentColor);
  doc.roundedRect(pageWidth - margin - 40, 6, 40, 13, 2, 2, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("UNVALIDATED", pageWidth - margin - 20, 11.5, { align: "center" });
  doc.setFontSize(5.5);
  doc.text("RESEARCH REPORT", pageWidth - margin - 20, 16, { align: "center" });

  y = 32;

  // ── 2. System Identification & Status Callout ──────────────────────────────
  doc.setFillColor(248, 250, 252); // Slate-50
  doc.setDrawColor(226, 232, 240); // Slate-200
  doc.setTextColor(15, 23, 42);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  const systemLines = doc.splitTextToSize(`SYSTEM: ${systemName.toUpperCase()} (${systemCategory.toUpperCase()})`, pageWidth - margin * 2 - 8);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  const coordFixStr = (systemLat !== null && systemLon !== null)
    ? `${Math.abs(systemLat).toFixed(2)} ${systemLat < 0 ? 'S' : 'N'}, ${Math.abs(systemLon).toFixed(2)} ${systemLon < 0 ? 'W' : 'E'}`
    : "Not available";
  const details = doc.splitTextToSize(`Basin: ${systemBasin} | Center fix: ${coordFixStr} | Ref: ${systemId}\nSource: ${agencyLabel}\nAssessment: ${alertInfo.title || "Data unavailable"}`, pageWidth - margin * 2 - 8);
  const boxHeight = 8 + systemLines.length * 4.5 + details.length * 3.5;
  doc.roundedRect(margin, y, pageWidth - margin * 2, boxHeight, 2, 2, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.text(systemLines, margin + 4, y + 6);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text(details, margin + 4, y + 7 + systemLines.length * 4.5);
  y += boxHeight + 6;

  // ── 3. Synoptic Meteorological Parameters Grid (FIX-004) ───────────────────
  doc.setTextColor(15, 23, 42);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.text("1. SUPPLIED SOURCE TELEMETRY (EXPERIMENTAL REPORT)", margin, y);
  y += 3.5;

  const averaging = typeof system.wind_averaging_minutes === 'number' && Number.isFinite(system.wind_averaging_minutes) && system.wind_averaging_minutes > 0 ? `${system.wind_averaging_minutes} min` : 'Not available';
  const windHeaderLabel = 'Supplied sustained wind:';
  const windValStr = knots !== null ? `${knots} Knots (${kmh} km/h)` : "Not available";
  const pressureValStr = pressure !== null ? `${pressure} hPa` : "Not available";

  const paramData = [
    ["Source issue time", system.observation_time_utc || "Not available", "Retrieved", system.retrieved_at || "Not available"],
    ["Simulation", system.is_simulation === true ? "Yes - synthetic / replay" : system.is_simulation === false ? "No" : "Not available", "Wind convention / averaging", system.wind_convention || averaging],
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
      "Not evaluated in this source report"
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
  doc.text("3. SOURCE POSITION AND FORECAST AVAILABILITY", margin, y);
  y += 3.5;

  const forecastRows = [
    ["Supplied fix", system.observation_time_utc || "Not available", coordFixStr, windValStr, systemCategory, "Source record; freshness must be checked"],
    ["Forecast", "Not available", "Not available", "Not available", "Not available", "Forecast not available: no verified forecast supplied to this export"],
  ];

  runAutoTable(doc, {
    startY: y,
    head: [["Record", "Source time", "Coordinates", "Sustained Winds", "Source Category", "Availability"]],
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
  doc.text("4. SUPPLIED DISTRICT INFORMATION (NOT INDEPENDENTLY VERIFIED)", margin, y);
  y += 3.5;

  const districtRows = affectedDistricts.map(d => [
    d.district || "Not available",
    d.state || "Not available",
    d.risk || "Not available",
    d.shelters || "Not available",
    d.evacuation || "Not available"
  ]);

  runAutoTable(doc, {
    startY: y,
    head: [["District / Jurisdiction", "State", "Hazard Rating", "Shelter Facilities", "Advisory Status"]],
    body: districtRows.length > 0 ? districtRows : [["Not available", "Not available", "Not available", "Not available", "No district conditions established"]],
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
  doc.text("5. SAFETY AND USE LIMITATIONS", margin, y);
  y += 4;

  doc.setFillColor(254, 242, 242); // Red-50
  doc.setDrawColor(252, 165, 165); // Red-300
  doc.roundedRect(margin, y, pageWidth - (margin * 2), 22, 1.5, 1.5, "FD");

  doc.setTextColor(153, 27, 27); // Red-800
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.text("RESEARCH SUMMARY - NO OPERATIONAL AUTHORITY:", margin + 3.5, y + 4.5);

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
  const footerFeedsLabel = "CycloNet experimental source summary";

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
    doc.text(`Document reference: CN-${authHash} (not verification)`, pageWidth - margin, footerY + 2.5, { align: "right" });

    // Row 2: Left operational context, Right page numbers
    doc.setFontSize(6.2);
    doc.setTextColor(148, 163, 184); // Slate-400
    doc.text("EXPERIMENTAL - NOT AN OFFICIAL WARNING - Consult authorized agencies", margin, footerY + 6.5);
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
    throw new Error("PDF download could not be started. Please try again.");
  }
}
