"""Source-independent contracts for the Best Bottles five-variant family.

This module deliberately has no Blender dependency. Geometry math and the
approved material parameters can therefore be regression-tested without
launching Blender, while the scene builder consumes the same immutable values.
"""

from dataclasses import dataclass
import hashlib
import math
from typing import Optional, Tuple


Color = Tuple[float, float, float]


@dataclass(frozen=True)
class VariantSpec:
    name: str
    allows_body_geometry_change: bool
    roughness: float
    absorption_color: Optional[Color] = None
    density: Optional[float] = None
    frosted: bool = False
    surface_tint: Color = (1.0, 1.0, 1.0)


@dataclass(frozen=True)
class SwirlSpec:
    height_mm: float = 74.0
    diameter_mm: float = 21.0
    finish: str = "17-415"
    flute_count: int = 8
    twist_deg: float = 85.0
    depth_mm: float = 0.75
    minimum_wall_mm: float = 0.8


@dataclass(frozen=True)
class JunctionSpec:
    nominal_finish_height_mm: float = 14.06
    finish_height_mm: float = 13.76
    top_land_mm: float = 0.9
    nominal_thread_zone_mm: float = 8.8
    thread_material_envelope_mm: float = 8.05
    thread_group_offset_z_mm: float = 0.375
    runout_overlap_deg: float = 20.0
    band_height_mm: float = 2.0
    band_center_z_mm: float = 1.3
    first_thread_material_bottom_z_mm: float = 4.06

    @property
    def shoulder_to_band_gap_mm(self):
        return self.band_center_z_mm - self.band_height_mm / 2.0

    @property
    def band_to_first_thread_gap_mm(self):
        return (
            self.first_thread_material_bottom_z_mm
            - self.band_center_z_mm
            - self.band_height_mm / 2.0
        )


VARIANTS = {
    "clear": VariantSpec("clear", False, 0.025),
    "frosted": VariantSpec("frosted", False, 0.28, frosted=True),
    "cobalt": VariantSpec(
        "cobalt", False, 0.012,
        absorption_color=(0.002, 0.008, 0.95), density=0.65,
        surface_tint=(0.005, 0.012, 0.65),
    ),
    "amber": VariantSpec(
        "amber", False, 0.012,
        absorption_color=(0.50, 0.22, 0.055), density=0.65,
        surface_tint=(0.35, 0.07, 0.008),
    ),
    "swirl": VariantSpec("swirl", True, 0.025),
}

SWIRL = SwirlSpec()
JUNCTION_17_415 = JunctionSpec()


def swirl_radius(radius, theta, z, outer_radius, z_min, z_max, spec=SWIRL):
    """Return a real inward-only multi-start helical molded radius.

    Only vertices within 0.8 mm of the nominal outer envelope are eligible.
    This keeps the inner cavity smooth. A squared sinusoid gives broad molded
    troughs rather than sharp screw-like grooves, and the vertical sine fade
    returns the relief to the smooth body before the heel and shoulder.
    """
    if radius < outer_radius - 0.8 or not z_min <= z <= z_max:
        return radius
    span = z_max - z_min
    if span <= 0:
        raise ValueError("swirl region must have positive height")
    t = (z - z_min) / span
    fade = math.sin(math.pi * t) ** 2
    phase = spec.flute_count * (
        theta - math.radians(spec.twist_deg) * t
    )
    groove = (1.0 + math.cos(phase)) * 0.5
    return radius - spec.depth_mm * fade * groove


def fingerprint_values(values, digits=6):
    """Fingerprint numeric state after stable, precision-bounded rounding."""
    encoded = "|".join(f"{float(value):.{digits}f}" for value in values)
    return hashlib.sha256(encoded.encode("utf-8")).hexdigest()
