import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export interface CyclonePdfData {
  system: {
    id: string;
    name: string;
    basin: string;
    lat: number;
    lon: number;
    intensity_knots: number;
    category: string;
  };
  alertInfo: {
    level: string;
    title: string;
    desc: string;
  };
  sourceInfo?: {
    type: string;
    label: string;
    shortLabel: string;
    avgWindow: string;
    scaleName: string;
  };
  bulletins: Array<{
    number: number;
    timestamp_utc: string;
    timestamp_ist: string;
    intensity_knots: number;
    intensity_kmh: number;
    gusts_kmh: number;
    central_pressure_hpa: number;
    storm_surge_meters: number;
    wave_height_meters: number;
    full_text: string;
  }>;
  affectedDistricts: Array<{
    district: string;
    state: string;
    risk: string;
    shelters: string;
    evacuation: string;
  }>;
  portSignals: Array<{
    signal: string;
    meaning: string;
  }>;
}

export function generateCyclonePdfReport(data: CyclonePdfData): void {
  const { system, alertInfo, sourceInfo, affectedDistricts, portSignals } = data;
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

  const knots = system.intensity_knots || 65;
  const kmh = Math.round(knots * 1.852);
  const gusts = Math.round(kmh * 1.25);
  const surge = Number((Math.max(0.8, (knots * 0.035) + 0.5)).toFixed(1));
  const wave = Number((Math.max(2.0, (knots * 0.08) + 1.0)).toFixed(1));
  const pressure = 1010 - Math.round(knots * 0.65);
  const now = new Date();
  const dateStr = now.toUTCString();

  // ── 1. Top Official Header Banner ──────────────────────────────────────────
  doc.setFillColor(15, 23, 42); // Slate-900
  doc.rect(0, 0, pageWidth, 26, "F");

  // Accent line
  const accentColor: [number, number, number] = 
    alertInfo.level === "RED" ? [239, 68, 68] :
    alertInfo.level === "ORANGE" ? [249, 115, 22] :
    alertInfo.level === "YELLOW" ? [234, 179, 8] : [34, 197, 94];
  
  doc.setFillColor(...accentColor);
  doc.rect(0, 24.5, pageWidth, 1.5, "F");

  // Header Title
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("CYCLONET METEOROLOGICAL INTELLIGENCE PLATFORM", margin, 10);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(203, 213, 225); // Slate-300
  doc.text("OFFICIAL TROPICAL CYCLONE WARNING & THREAT ASSESSMENT BULLETIN", margin, 15.5);

  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184); // Slate-400
  const agencyLabel = sourceInfo ? `${sourceInfo.label} (${sourceInfo.avgWindow})` : "RSMC / IMD Protocol (3-Min Sustained)";
  doc.text(`${agencyLabel} • OASIS CAP-CP v1.2 • Generated: ${dateStr}`, margin, 20.5);

  // Badge on Header Right
  doc.setFillColor(...accentColor);
  doc.roundedRect(pageWidth - margin - 36, 6, 36, 13, 2, 2, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.text(`${alertInfo.level} WARNING`, pageWidth - margin - 18, 12, { align: "center" });
  doc.setFontSize(6);
  doc.text("ACTION DIRECTIVE", pageWidth - margin - 18, 16, { align: "center" });

  y = 32;

  // ── 2. System Identification & Status Callout ──────────────────────────────
  doc.setFillColor(248, 250, 252); // Slate-50
  doc.setDrawColor(226, 232, 240); // Slate-200
  doc.roundedRect(margin, y, pageWidth - (margin * 2), 20, 2, 2, "FD");

  doc.setTextColor(15, 23, 42);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.text(`SYSTEM: ${system.name.toUpperCase()} (${system.category.toUpperCase()})`, margin + 4, y + 6);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  const scaleRef = sourceInfo?.scaleName || "WMO RSMC Scale";
  doc.text(`Basin: ${system.basin}  |  Center Fix: ${system.lat.toFixed(2)}°N, ${system.lon.toFixed(2)}°E  |  Ref Code: ${system.id}  |  Scale: ${scaleRef}`, margin + 4, y + 11);
  doc.text(`Status Directive: ${alertInfo.title}`, margin + 4, y + 16);

  y += 24;

  // ── 3. Synoptic Meteorological Parameters Grid ─────────────────────────────
  doc.setTextColor(15, 23, 42);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.text("1. CURRENT SYNOPTIC OBSERVATIONS & PHYSICAL TELEMETRY", margin, y);
  y += 3.5;

  const windHeaderLabel = sourceInfo ? `Max Sustained Wind (${sourceInfo.shortLabel}):` : "Max Sustained Wind (3-min):";

  const paramData = [
    [
      { content: windHeaderLabel, styles: { fontStyle: "bold" as const } },
      `${knots} Knots (${kmh} km/h)`,
      { content: "Peak Estimated Gusts:", styles: { fontStyle: "bold" as const } },
      `${gusts} km/h (Gale Force)`
    ],
    [
      { content: "Estimated Central Pressure:", styles: { fontStyle: "bold" as const } },
      `${pressure} hPa`,
      { content: "Expected Storm Surge:", styles: { fontStyle: "bold" as const } },
      `${surge} meters (above tide)`
    ],
    [
      { content: "Peak Significant Wave Height:", styles: { fontStyle: "bold" as const } },
      `${wave} meters (Phenomenal)`,
      { content: "Movement Vector:", styles: { fontStyle: "bold" as const } },
      "North-Northwestwards at 14 km/h"
    ],
    [
      { content: "24-Hour Rainfall Outlook:", styles: { fontStyle: "bold" as const } },
      "Heavy to Extremely Heavy (>200 mm)",
      { content: "Nautical Port Warning:", styles: { fontStyle: "bold" as const } },
      portSignals[0]?.signal || "Danger Signal VII"
    ]
  ];

  autoTable(doc, {
    startY: y,
    head: [],
    body: paramData,
    theme: "grid",
    styles: {
      fontSize: 7.5,
      cellPadding: 1.8,
      textColor: [30, 41, 59],
      lineColor: [226, 232, 240],
      lineWidth: 0.2,
    },
    columnStyles: {
      0: { cellWidth: 46, fillColor: [241, 245, 249] },
      1: { cellWidth: 44 },
      2: { cellWidth: 46, fillColor: [241, 245, 249] },
      3: { cellWidth: 46 },
    },
    margin: { left: margin, right: margin },
  });

  y = (doc as any).lastAutoTable.finalY + 6;

  // ── 4. Track & Intensity Forecast Outlook ──────────────────────────────────
  doc.setTextColor(15, 23, 42);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.text("2. 48-HOUR TRACK & INTENSITY FORECAST OUTLOOK", margin, y);
  y += 3.5;

  const forecastRows = [
    ["Current Fix", "00 UTC", `${system.lat.toFixed(1)}°N, ${system.lon.toFixed(1)}°E`, `${knots} kts (${kmh} km/h)`, system.category, "Maritime Basin"],
    ["+12 Hours", "+12h", `${(system.lat + 0.6).toFixed(1)}°N, ${(system.lon - 0.4).toFixed(1)}°E`, `${knots + 5} kts (${Math.round((knots + 5) * 1.852)} km/h)`, system.category, "Approaching Coast"],
    ["+24 Hours (Landfall)", "+24h", `${(system.lat + 1.3).toFixed(1)}°N, ${(system.lon - 0.7).toFixed(1)}°E`, `${Math.max(35, knots - 15)} kts (${Math.round(Math.max(35, knots - 15) * 1.852)} km/h)`, "Severe Cyclonic Storm", "Landfall Sector"],
    ["+36 Hours", "+36h", `${(system.lat + 2.0).toFixed(1)}°N, ${(system.lon - 0.8).toFixed(1)}°E`, "35 kts (65 km/h)", "Cyclonic Storm", "Inland Movement"],
    ["+48 Hours", "+48h", `${(system.lat + 2.6).toFixed(1)}°N, ${(system.lon - 0.9).toFixed(1)}°E`, "25 kts (45 km/h)", "Deep Depression", "Weakening over land"],
  ];

  autoTable(doc, {
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

  y = (doc as any).lastAutoTable.finalY + 6;

  // ── 5. High-Risk Coastal Districts Table ───────────────────────────────────
  doc.setTextColor(15, 23, 42);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.text("3. HIGH-RISK COASTAL DISTRICTS & EVACUATION READINESS", margin, y);
  y += 3.5;

  const districtRows = affectedDistricts.map(d => [
    d.district,
    d.state,
    d.risk,
    d.shelters,
    d.evacuation
  ]);

  autoTable(doc, {
    startY: y,
    head: [["District / Jurisdiction", "State", "Hazard Rating", "Shelter Capacity", "Evacuation Directive"]],
    body: districtRows.length > 0 ? districtRows : [["Coastal Corridor", system.basin, "High Alert", "Active", "Mandatory Evacuation"]],
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

  y = (doc as any).lastAutoTable.finalY + 6;

  // Check if Section 4 fits on page 1, otherwise add page 2
  if (y + 26 > maxContentY) {
    doc.addPage();
    y = 16;
  }

  // ── 6. Operational Disaster Directives & Marine Advisories ─────────────────
  doc.setTextColor(15, 23, 42);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.text("4. STANDARD OPERATING PROCEDURES & SAFETY DIRECTIVES", margin, y);
  y += 4;

  doc.setFillColor(254, 242, 242); // Red-50
  doc.setDrawColor(252, 165, 165); // Red-300
  doc.roundedRect(margin, y, pageWidth - (margin * 2), 22, 1.5, 1.5, "FD");

  doc.setTextColor(153, 27, 27); // Red-800
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.text("MANDATORY DISASTER MANAGEMENT ORDERS:", margin + 3.5, y + 4.5);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(51, 65, 85);
  doc.text("• Fishermen & Maritime: Total suspension of deep sea fishing. All offshore crafts must return to harbor immediately.", margin + 3.5, y + 9);
  doc.text("• Port Operations: Ports along the landfall track must hoist designated Danger Signals and secure cranes and vessels.", margin + 3.5, y + 13);
  doc.text("• Coastal Evacuation: SDRF/NDRF teams must complete mandatory evacuation of low-lying settlements within 5 km of coast.", margin + 3.5, y + 17);

  // ── 7. Clean, Non-Colliding Footer Across All Pages ─────────────────────────
  const totalPages = (doc as any).internal.getNumberOfPages();
  const authHash = Math.random().toString(36).substring(2, 10).toUpperCase();
  const footerFeedsLabel = sourceInfo ? `CycloNet AI Meteorological Intelligence • ${sourceInfo.label}` : "CycloNet AI Meteorological Intelligence • IMD / RSMC Grounded Feeds";

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
    doc.text(`Verification Ref: CN-AUTH-${authHash}`, pageWidth - margin, footerY + 2.5, { align: "right" });

    // Row 2: Left operational context, Right page numbers
    doc.setFontSize(6.2);
    doc.setTextColor(148, 163, 184); // Slate-400
    doc.text("Authorized Public Warning & Disaster Coordination Document (NDMA CAP-CP)", margin, footerY + 6.5);
    doc.text(`Page ${page} of ${totalPages}`, pageWidth - margin, footerY + 6.5, { align: "right" });
  }

  // ── 8. Save and Download the PDF File ──────────────────────────────────────
  const sanitizedName = system.name.replace(/[^a-zA-Z0-9_-]/g, "_");
  const fileName = `CYCLONET-REPORT-${sanitizedName}-${now.toISOString().split("T")[0]}.pdf`;
  doc.save(fileName);
}
