"""Immutable contracts for the protected 9 ml luxury glass studio.

This module deliberately has no Blender dependency.  Blender builders and
plain Python tests consume the same geometry locks, optical presets, rig
formulas, render requirements, and output naming rules.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass
import hashlib
import math
from pathlib import Path
from typing import Any, Iterable, Mapping, Tuple


ROOT = Path(__file__).resolve().parents[2]
SOURCE_SCENE = ROOT / (
    "pipeline/paper-doll-3d/master/working/five-variant/"
    "9ml-shoulder-glass-upgrade/009ml-clear-shoulder-glass.blend"
)
SOURCE_SHA256 = "c436ed8f8c0c363695bf2bcbbdb371a67a4e8c1fd2b6574ac8ebcd6663d22ea0"
BODY_GEOMETRY_SHA256 = "ed64930d7ea4e7301a2687340ea2e3235cbb5f0f4545be0313200e1d1dfba016"
THREAD_SHA256 = "016804a72dc0e7e1197d76d92a20ce84bbac75944a876dda6d2f34712129b39f"

BODY_NAME = "BB_BTL_CYL_009ML_001"
FINISH_NAME = "BB_FIN_17_415"
FINISH_MASTER_NAME = "FINISH_MASTER_17_415"
CAMERA_NAME = "BB_CAM_MASTER"
LUXURY_COLLECTION = "BB_STUDIO_GLASS_LUXURY"
MASTER_GROUP_NAME = "BB_GLASS_MASTER"


@dataclass(frozen=True)
class GeometryContract:
    body_sha256: str = BODY_GEOMETRY_SHA256
    thread_sha256: str = THREAD_SHA256
    diameter_mm: float = 19.7
    height_mm: float = 72.0
    finish_datum_z_mm: float = 58.24
    neck_height_mm: float = 13.76
    bore_diameter_mm: float = 9.8
    minimum_wall_mm: float = 1.6
    base_thickness_mm: float = 3.5
    camera_lens_mm: float = 100.0
    camera_sensor_mm: float = 36.0
    camera_location: Tuple[float, float, float] = (0.0, -305.5555, 36.0)
    camera_rotation_degrees: Tuple[float, float, float] = (90.0, 0.0, 0.0)


@dataclass(frozen=True)
class GlassPreset:
    ior: float
    surface_roughness: float
    transmission: float
    absorption_color: Tuple[float, float, float]
    absorption_density: float
    frost_amount: float
    micro_roughness_amount: float
    micro_roughness_scale: float
    micro_normal_strength: float


@dataclass(frozen=True)
class LightSpec:
    name: str
    angle_degrees: float
    radius_diameters: float
    z_heights: float
    width_diameters: float
    height_heights: float
    energy_watts: float
    target_z_heights: float = 38.0 / 72.0

    def location(self, geometry: GeometryContract) -> Tuple[float, float, float]:
        radius = self.radius_diameters * geometry.diameter_mm
        angle = math.radians(self.angle_degrees)
        return (
            radius * math.sin(angle),
            -radius * math.cos(angle),
            self.z_heights * geometry.height_mm,
        )

    def dimensions(self, geometry: GeometryContract) -> Tuple[float, float]:
        return (
            self.width_diameters * geometry.diameter_mm,
            self.height_heights * geometry.height_mm,
        )

    def target(self, geometry: GeometryContract) -> Tuple[float, float, float]:
        return (0.0, 0.0, self.target_z_heights * geometry.height_mm)


@dataclass(frozen=True)
class NegativeCardSpec:
    name: str
    x_diameters: float
    y_diameters: float
    z_heights: float
    width_diameters: float
    height_heights: float

    def location(self, geometry: GeometryContract) -> Tuple[float, float, float]:
        return (
            self.x_diameters * geometry.diameter_mm,
            self.y_diameters * geometry.diameter_mm,
            self.z_heights * geometry.height_mm,
        )

    def dimensions(self, geometry: GeometryContract) -> Tuple[float, float]:
        return (
            self.width_diameters * geometry.diameter_mm,
            self.height_heights * geometry.height_mm,
        )


@dataclass(frozen=True)
class RenderContract:
    engine: str = "CYCLES"
    device: str = "GPU"
    samples: int = 512
    adaptive_sampling: bool = True
    noise_threshold: float = 0.005
    max_bounces: int = 12
    transmission_bounces: int = 12
    glossy_bounces: int = 8
    diffuse_bounces: int = 4
    transparent_bounces: int = 8
    denoise: bool = True
    view_transform: str = "AgX"
    look: str = "Medium High Contrast"
    exposure: float = 0.0
    gamma: float = 1.0


GEOMETRY = GeometryContract()
RENDER = RenderContract()

VARIANTS: Mapping[str, GlassPreset] = {
    "clear": GlassPreset(1.50, 0.020, 1.0, (1.0, 1.0, 1.0), 0.0, 0.0, 0.0, 420.0, 0.0),
    "amber": GlassPreset(1.50, 0.022, 1.0, (0.72, 0.32, 0.045), 0.75, 0.0, 0.006, 420.0, 0.0),
    "cobalt": GlassPreset(1.50, 0.020, 1.0, (0.003, 0.012, 0.92), 0.55, 0.0, 0.006, 420.0, 0.0),
    "frosted": GlassPreset(1.50, 0.260, 1.0, (1.0, 1.0, 1.0), 0.0, 1.0, 0.035, 420.0, 0.018),
}

# Energies are starting-point photographic ratios.  Calibration may alter
# them in this contract, never directly in a derivative scene.
LIGHTS = (
    LightSpec("BB_LUX_KEY_LEFT", -38.0, 5.4, 0.58, 1.35, 1.45, 720.0),
    LightSpec("BB_LUX_EDGE_RIGHT", 60.0, 5.0, 0.56, 0.62, 1.30, 310.0),
    LightSpec("BB_LUX_RIM_REAR", 180.0, 4.0, 0.58, 0.72, 1.18, 170.0),
    LightSpec("BB_LUX_TOP", -8.0, 1.8, 1.56, 2.80, 0.48, 420.0, 0.76),
    LightSpec("BB_LUX_FILL_FRONT", 0.0, 7.0, 0.52, 3.20, 1.35, 75.0),
)

NEGATIVE_CARDS = (
    NegativeCardSpec("BB_LUX_NEG_LEFT", -2.30, -0.80, 0.53, 0.52, 1.38),
    NegativeCardSpec("BB_LUX_NEG_RIGHT", 2.45, -0.55, 0.53, 0.42, 1.32),
)


def geometry_fingerprint(mesh: Any) -> str:
    """Hash original mesh coordinates and polygon topology deterministically."""
    digest = hashlib.sha256()
    digest.update(f"v={len(mesh.vertices)};p={len(mesh.polygons)};".encode())
    for vertex in mesh.vertices:
        digest.update(("%.6f,%.6f,%.6f;" % tuple(vertex.co)).encode("ascii"))
    for polygon in mesh.polygons:
        digest.update((",".join(str(index) for index in polygon.vertices) + ";").encode("ascii"))
    return digest.hexdigest()


def object_snapshot(obj: Any) -> dict[str, Any]:
    """Return the immutable transform/topology state used by derivative gates."""
    snapshot = {
        "name": obj.name,
        "type": obj.type,
        "location": tuple(round(float(value), 7) for value in obj.location),
        "rotation": tuple(round(float(value), 7) for value in obj.rotation_euler),
        "scale": tuple(round(float(value), 7) for value in obj.scale),
    }
    if obj.type == "MESH":
        snapshot.update(
            mesh=geometry_fingerprint(obj.data),
            vertices=len(obj.data.vertices),
            polygons=len(obj.data.polygons),
            modifiers=tuple((modifier.name, modifier.type) for modifier in obj.modifiers),
            smooth=tuple(bool(polygon.use_smooth) for polygon in obj.data.polygons),
        )
    elif obj.type == "CAMERA":
        snapshot.update(
            lens=round(float(obj.data.lens), 7),
            sensor_width=round(float(obj.data.sensor_width), 7),
            dof=bool(obj.data.dof.use_dof),
        )
    return snapshot


def crop_boxes(width: int, height: int) -> dict[str, tuple[int, int, int, int]]:
    """Return deterministic, axis-centered diagnostic crop boxes."""
    if width <= 0 or height <= 0:
        raise ValueError("render dimensions must be positive")
    boxes_normalized = {
        "neck": (0.34, 0.055, 0.66, 0.34),
        "shoulder": (0.30, 0.22, 0.70, 0.49),
        "base": (0.30, 0.70, 0.70, 0.965),
    }
    return {
        name: (
            round(left * width),
            round(top * height),
            round(right * width),
            round(bottom * height),
        )
        for name, (left, top, right, bottom) in boxes_normalized.items()
    }


def qc_filename(variant: str, region: str, samples: int, denoised: bool) -> str:
    if variant not in VARIANTS:
        raise ValueError(f"unknown glass variant {variant!r}")
    if region not in {"full", "neck", "shoulder", "base"}:
        raise ValueError(f"unknown QC region {region!r}")
    state = "denoised" if denoised else "raw"
    return f"009ml-{variant}-{region}-{samples}s-{state}.png"


def dataclass_dict(value: Any) -> dict[str, Any]:
    return asdict(value)


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()
