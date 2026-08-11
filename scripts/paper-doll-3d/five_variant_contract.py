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
    ior: float = 1.52
    transmission: float = 1.0
    absorption_color: Optional[Color] = None
    density: Optional[float] = None
    frosted: bool = False
    surface_tint: Color = (1.0, 1.0, 1.0)
    frost_scale: Optional[float] = None
    frost_strength: Optional[float] = None
    frost_distance: Optional[float] = None


@dataclass(frozen=True)
class PrecisionShoulderSpec:
    body_radius_mm: float = 9.85
    finish_root_radius_mm: float = 7.40
    datum_z_mm: float = 58.24
    convex_radius_mm: float = 1.75
    concave_radius_mm: float = 0.80
    wall_mm: float = 1.60
    base_mm: float = 3.50


@dataclass(frozen=True)
class ShoulderSolution:
    angle_rad: float
    transition_height_mm: float
    start_z_mm: float


@dataclass(frozen=True)
class TransmissionCardSpec:
    width_mm: float = 140.0
    height_mm: float = 220.0
    location_mm: Tuple[float, float, float] = (-35.0, 105.0, 95.0)
    emission_strength: float = 0.60
    visible_camera: bool = False
    visible_shadow: bool = False
    visible_transmission: bool = True
    visible_glossy: bool = False


@dataclass(frozen=True)
class SwirlSpec:
    height_mm: float = 74.0
    diameter_mm: float = 21.0
    finish: str = "17-415"
    flute_count: int = 10
    twist_deg: float = 90.0
    depth_mm: float = 0.75
    minimum_wall_mm: float = 0.8
    fade_mm: float = 2.75
    channel_power: float = 2.5


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
    "clear": VariantSpec("clear", False, 0.018),
    "frosted": VariantSpec(
        "frosted", False, 0.22, frosted=True,
        frost_scale=85.0, frost_strength=0.04, frost_distance=0.012,
    ),
    "cobalt": VariantSpec(
        "cobalt", False, 0.018,
        absorption_color=(0.003, 0.012, 0.92), density=0.55,
    ),
    "amber": VariantSpec(
        "amber", False, 0.020,
        absorption_color=(0.55, 0.20, 0.035), density=0.60,
    ),
    "swirl": VariantSpec("swirl", True, 0.025),
}

SWIRL_CANDIDATES = {
    10: SwirlSpec(flute_count=10),
    12: SwirlSpec(flute_count=12),
}
JUNCTION_17_415 = JunctionSpec()
SHOULDER_009 = PrecisionShoulderSpec()
TRANSMISSION_CARD_009 = TransmissionCardSpec()


def shoulder_solution(spec):
    span = spec.body_radius_mm - spec.finish_root_radius_mm
    radius_sum = spec.convex_radius_mm + spec.concave_radius_mm
    if radius_sum <= span:
        raise ValueError("precision shoulder radii must exceed radial span")
    angle = math.acos(1.0 - span / radius_sum)
    height = radius_sum * math.sin(angle)
    return ShoulderSolution(angle, height, spec.datum_z_mm - height)


def smoothstep01(value):
    value = max(0.0, min(1.0, value))
    return value * value * (3.0 - 2.0 * value)


def swirl_radius(radius, theta, z, outer_radius, z_min, z_max, spec):
    """Return a real inward-only multi-start helical molded radius.

    Only vertices within 0.8 mm of the nominal outer envelope are eligible.
    This keeps the inner cavity smooth. A powered cosine produces narrow,
    smoothly rounded channels between broad outer lands. Short smoothstep
    fades retain full molded depth over most of the body.
    """
    if radius < outer_radius - 0.8 or not z_min <= z <= z_max:
        return radius
    span = z_max - z_min
    if span <= 0:
        raise ValueError("swirl region must have positive height")
    t = (z - z_min) / span
    edge_distance = min(z - z_min, z_max - z)
    fade = smoothstep01(edge_distance / spec.fade_mm)
    phase = spec.flute_count * (
        theta - math.radians(spec.twist_deg) * t
    )
    channel = ((1.0 + math.cos(phase)) * 0.5) ** spec.channel_power
    return radius - spec.depth_mm * fade * channel


def fingerprint_values(values, digits=6):
    """Fingerprint numeric state after stable, precision-bounded rounding."""
    encoded = "|".join(f"{float(value):.{digits}f}" for value in values)
    return hashlib.sha256(encoded.encode("utf-8")).hexdigest()
