"""Shared meteorological classification helpers (IMD 3-minute wind conventions)."""

from typing import Optional


def classify_imd_category_from_knots(knots: Optional[int | float]) -> str:
    """Map sustained wind speed in knots to the IMD cyclone classification."""
    if knots is None:
        return "Cyclonic Disturbance (Unclassified Wind)"
    if knots < 17:
        return "Low Pressure Area"
    if knots < 28:
        return "Depression"
    if knots < 34:
        return "Deep Depression"
    if knots < 48:
        return "Cyclonic Storm"
    if knots < 64:
        return "Severe Cyclonic Storm"
    if knots < 90:
        return "Very Severe Cyclonic Storm"
    if knots < 120:
        return "Extremely Severe Cyclonic Storm"
    return "Super Cyclonic Storm"


def derive_empirical_dvorak_t(knots: Optional[int | float]) -> tuple[str, str, bool]:
    """Return parametric diagnostic Dvorak T-number metadata from sustained wind speed."""
    if knots is None:
        return (
            "T-Pending",
            "Unavailable (Missing Wind Telemetry)",
            False,
        )
    if knots >= 120:
        t_num = "T6.0+"
    elif knots >= 90:
        t_num = "T5.5"
    elif knots >= 65:
        t_num = "T4.5"
    elif knots >= 45:
        t_num = "T3.5"
    elif knots >= 30:
        t_num = "T2.5"
    else:
        t_num = "T1.5"
    return (
        t_num,
        "Parametric Wind-Speed Scale (Decision Support Diagnostic Only)",
        True,
    )
