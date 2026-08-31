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
import struct
from typing import Any, Iterable, Mapping, Tuple


ROOT = Path(__file__).resolve().parents[2]
SOURCE_SCENE = ROOT / (
    "pipeline/paper-doll-3d/master/working/five-variant/"
    "9ml-shoulder-glass-upgrade/009ml-clear-shoulder-glass.blend"
)
SOURCE_SHA256 = "c436ed8f8c0c363695bf2bcbbdb371a67a4e8c1fd2b6574ac8ebcd6663d22ea0"
BODY_GEOMETRY_SHA256 = "ed64930d7ea4e7301a2687340ea2e3235cbb5f0f4545be0313200e1d1dfba016"
THREAD_SHA256 = "016804a72dc0e7e1197d76d92a20ce84bbac75944a876dda6d2f34712129b39f"
APPROVED_FINISH_GEOMETRY_SHA256 = (
    "c53244ffb82a5944134f1318ff77da5be7aca7c423ceb6c663e7e4264be1f6c9"
)
WORKING_OUTPUT_DIR = ROOT / (
    "pipeline/paper-doll-3d/master/working/five-variant/9ml-luxury-glass-studio"
)
RENDER_OUTPUT_DIR = ROOT / (
    "pipeline/paper-doll-3d/renders/five-variant/9ml-luxury-glass-studio"
)
CORRECTION_WORKING_DIR = ROOT / (
    "pipeline/paper-doll-3d/master/working/five-variant/9ml-cobalt-correction-v1"
)
CORRECTION_RENDER_DIR = ROOT / (
    "pipeline/paper-doll-3d/renders/five-variant/9ml-cobalt-correction-v1"
)
REFERENCE_V2_WORKING_DIR = ROOT / (
    "pipeline/paper-doll-3d/master/working/five-variant/9ml-cobalt-reference-v2"
)
REFERENCE_V2_RENDER_DIR = ROOT / (
    "pipeline/paper-doll-3d/renders/five-variant/9ml-cobalt-reference-v2"
)
FINAL_LOCK_WORKING_DIR = ROOT / (
    "pipeline/paper-doll-3d/master/working/five-variant/9ml-cobalt-final-lock"
)
FINAL_LOCK_RENDER_DIR = ROOT / (
    "pipeline/paper-doll-3d/renders/five-variant/9ml-cobalt-final-lock"
)
GLOSS_REFRACTION_WORKING_DIR = FINAL_LOCK_WORKING_DIR / "gloss-refraction-bracket-v1"
GLOSS_REFRACTION_RENDER_DIR = FINAL_LOCK_RENDER_DIR / "gloss-refraction-bracket-v1"
GLOSS_REFRACTION_SCRIM_GAIN = 1.10
GLOSS_REFRACTION_SCRIM_FILENAME = "05_COBALT_LUMINOUS_POLISHED_SCRIM_110.png"
NEUTRAL_SURFACE_TINT_WORKING_DIR = FINAL_LOCK_WORKING_DIR / "neutral-surface-tint-v1"
NEUTRAL_SURFACE_TINT_RENDER_DIR = FINAL_LOCK_RENDER_DIR / "neutral-surface-tint-v1"
COMPARISON_FONT = Path("/System/Library/Fonts/Supplemental/Arial.ttf")

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


@dataclass(frozen=True)
class CobaltCorrectionContract:
    version: str = "cobalt-correction-v1"
    collection_name: str = "BB_STUDIO_COBALT_CORRECTION_V1"
    background_hex: str = "#F3EFE8"
    clear_roughness: float = 0.035
    cobalt_roughness: float = 0.040
    world_strength: float = 0.70
    exposure: float = 0.50
    use_negative_fill: bool = False
    use_rear_rim: bool = False


@dataclass(frozen=True)
class CobaltReferenceV2Contract:
    """Material/lighting-only target derived from the supplied product photo."""

    version: str = "cobalt-reference-v2"
    collection_name: str = "BB_STUDIO_COBALT_REFERENCE_V2"
    background_hex: str = "#F5F3EF"
    absorption_color: Tuple[float, float, float] = (0.002, 0.006, 0.72)
    transmission_tint: Tuple[float, float, float] = (0.0002, 0.0015, 0.98)
    clear_roughness: float = 0.032
    cobalt_roughness: float = 0.032
    world_strength: float = 0.92
    exposure: float = 0.25
    selected_density_percentage: int = 75
    selected_packshot_yaw_degrees: float = -30.0
    hero_scrim_name: str = "BB_REF_V2_HERO_SCRIM"
    hero_scrim_width_mm: float = 118.0
    hero_scrim_height_mm: float = 122.0
    hero_scrim_wrap_degrees: float = 220.0
    hero_scrim_emission: float = 0.75
    left_scrim_width_mm: float = 13.0
    right_scrim_width_mm: float = 5.0
    left_area_watts: float = 820.0
    right_area_watts: float = 350.0
    top_fill_watts: float = 210.0
    neck_separation_fill_watts: float = 65.0
    use_negative_fill: bool = False
    use_rear_rim: bool = False


@dataclass(frozen=True)
class CobaltFinalLockContract:
    """Photo 2 subject rendered through Photo 1's warm left-key studio."""

    version: str = "cobalt-final-lock-candidate-v1"
    collection_name: str = "BB_STUDIO_COBALT_FINAL_LOCK_V1"
    background_hex: str = "#B8B1A7"
    floor_hex: str = "#D5CFC3"
    world_strength: float = 2.00
    exposure: float = 0.80
    left_key_name: str = "BB_FINAL_LEFT_SHADOW_KEY"
    left_scrim_name: str = "BB_FINAL_LEFT_DIFFUSION_SCRIM"
    top_fill_name: str = "BB_FINAL_TOP_FILL"
    neck_fill_name: str = "BB_FINAL_NECK_FILL"
    backdrop_name: str = "BB_FINAL_WARM_BONE_BACKDROP"
    floor_name: str = "BB_FINAL_WARM_BONE_FLOOR"
    left_key_watts: float = 85000.0
    top_fill_watts: float = 12000.0
    neck_fill_watts: float = 5000.0
    scrim_emission: float = 0.13
    selected_density_percentage: int = 75
    selected_packshot_yaw_degrees: float = -30.0
    contact_key_location_mm: Tuple[float, float, float] = (-88.0, -30.0, 84.0)
    contact_key_width_mm: float = 37.0
    contact_key_height_mm: float = 80.0
    contact_key_watts: float = 89000.0
    contact_v2_key_location_mm: Tuple[float, float, float] = (-88.0, -30.0, 82.0)
    contact_v2_key_width_mm: float = 35.0
    contact_v2_key_height_mm: float = 76.0
    contact_v2_key_watts: float = 89000.0
    base_halo_control_name: str = "BB_FINAL_BASE_HALO_CONTROL_15"
    base_halo_reduction_percent: int = 15
    base_halo_control_radius_mm: float = 32.0
    base_halo_control_height_mm: float = 9.0
    base_halo_control_center_z_mm: float = 3.5
    base_halo_control_wrap_degrees: float = 250.0


@dataclass(frozen=True)
class GlossRefractionPreset:
    material_name: str
    absorption_density: float
    surface_roughness: float
    filename: str


@dataclass(frozen=True)
class NeutralSurfaceTintPreset:
    version: str = "cobalt-neutral-surface-tint-v1"
    material_name: str = "BB_GLOSS_COBALT_NEUTRAL_SURFACE"
    node_group_name: str = "BB_GLASS_MASTER_COBALT_NEUTRAL_SURFACE"
    surface_tint: Tuple[float, float, float] = (1.0, 1.0, 1.0)
    absorption_color: Tuple[float, float, float] = (0.002, 0.006, 0.72)
    absorption_density: float = 1.55
    surface_roughness: float = 0.020
    ior: float = 1.50
    transmission: float = 1.0
    filename: str = "07_COBALT_NEUTRAL_SURFACE_TINT.png"
    scene_filename: str = "009ml-cobalt-neutral-surface-tint-v1.blend"
    comparison_filename: str = "08_NEUTRAL_SURFACE_TINT_COMPARISON.png"


@dataclass(frozen=True)
class CorrectionLightSpec:
    name: str
    location_mm: Tuple[float, float, float]
    target_mm: Tuple[float, float, float]
    width_mm: float
    height_mm: float
    energy_watts: float
    visible_glossy: bool


@dataclass(frozen=True)
class CorrectionScrimSpec:
    name: str
    location_mm: Tuple[float, float, float]
    target_mm: Tuple[float, float, float]
    width_mm: float
    height_mm: float


GEOMETRY = GeometryContract()
RENDER = RenderContract()
COBALT_CORRECTION = CobaltCorrectionContract()
COBALT_REFERENCE_V2 = CobaltReferenceV2Contract()
COBALT_FINAL_LOCK = CobaltFinalLockContract()

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

CORRECTION_COBALT_DENSITIES = {25: 0.50, 50: 1.00, 75: 1.50, 100: 2.00}

# Stronger than the first correction bracket because the supplied physical
# sample is a saturated royal cobalt.  The bracket still leaves selection to
# rendered optical-path evidence rather than treating a density as universal.
REFERENCE_V2_COBALT_DENSITIES = {25: 1.00, 50: 1.40, 75: 1.80, 100: 2.20}

# Material-only bracket against the protected grounded-contact V1 scene.
# The first entry is the immutable visual baseline; the other two are isolated
# derivatives that alter only the two explicitly listed optical inputs.
GLOSS_REFRACTION_PRESETS: Mapping[str, GlossRefractionPreset] = {
    "baseline-v1": GlossRefractionPreset(
        "BB_REF_V2_COBALT_75", 1.80, 0.032, "01_COBALT_BASELINE_V1.png"
    ),
    "polished": GlossRefractionPreset(
        "BB_GLOSS_COBALT_POLISHED", 1.80, 0.020, "02_COBALT_POLISHED.png"
    ),
    "luminous-polished": GlossRefractionPreset(
        "BB_GLOSS_COBALT_LUMINOUS_POLISHED",
        1.55,
        0.020,
        "03_COBALT_LUMINOUS_POLISHED.png",
    ),
}

NEUTRAL_SURFACE_TINT = NeutralSurfaceTintPreset()

CORRECTION_SCRIMS = (
    CorrectionScrimSpec(
        "BB_CORR_LEFT_SCRIM", (-27.0, -20.0, 38.0), (0.0, 0.0, 38.0), 27.0, 104.0
    ),
    CorrectionScrimSpec(
        "BB_CORR_RIGHT_SCRIM", (29.0, -7.0, 38.0), (0.0, 0.0, 38.0), 12.0, 94.0
    ),
)

CORRECTION_LIGHTS = (
    CorrectionLightSpec(
        "BB_CORR_LEFT_AREA", (-55.0, -10.0, 40.0), (-27.0, -20.0, 38.0), 34.0, 112.0, 700.0, False
    ),
    CorrectionLightSpec(
        "BB_CORR_RIGHT_AREA", (53.0, 4.0, 40.0), (29.0, -7.0, 38.0), 18.0, 102.0, 310.0, False
    ),
    CorrectionLightSpec(
        "BB_CORR_TOP_FILL", (0.0, -42.0, 104.0), (0.0, 0.0, 53.0), 76.0, 48.0, 90.0, False
    ),
)


def geometry_fingerprint(mesh: Any) -> str:
    """Hash original mesh coordinates and polygon topology deterministically."""
    digest = hashlib.sha256()
    for vertex in mesh.vertices:
        digest.update(
            struct.pack(
                "<3d",
                round(float(vertex.co.x), 6),
                round(float(vertex.co.y), 6),
                round(float(vertex.co.z), 6),
            )
        )
    for polygon in mesh.polygons:
        digest.update(struct.pack("<I", len(polygon.vertices)))
        for index in polygon.vertices:
            digest.update(struct.pack("<I", index))
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


def gloss_refraction_crop_boxes(
    width: int, height: int
) -> dict[str, tuple[int, int, int, int]]:
    """Return diagnostic boxes for finish, full optical body, and thick base."""
    if width <= 0 or height <= 0:
        raise ValueError("render dimensions must be positive")
    boxes_normalized = {
        "neck": (0.34, 0.055, 0.66, 0.34),
        "body": (0.30, 0.27, 0.70, 0.81),
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


def qc_render_plan(width: int, height: int, samples: int) -> dict[str, dict[str, Any]]:
    boxes = crop_boxes(width, height)
    plan = {}
    for variant in VARIANTS:
        entry: dict[str, Any] = {
            "resolution": (width, height),
            "crop_scale_percent": 200,
            "full_denoised": qc_filename(variant, "full", samples, True),
            "full_raw": qc_filename(variant, "full", samples, False),
        }
        for region in boxes:
            entry[f"{region}_denoised"] = qc_filename(variant, region, samples, True)
            entry[f"{region}_raw"] = qc_filename(variant, region, samples, False)
            entry[f"{region}_box"] = boxes[region]
        plan[variant] = entry
    return plan


def correction_filename(value: Any) -> str:
    names = {
        "clear": "01_CLEAR_CALIBRATION.png",
        25: "02_COBALT_25.png",
        50: "03_COBALT_50.png",
        75: "04_COBALT_75.png",
        100: "05_COBALT_100.png",
    }
    if value not in names:
        raise ValueError(f"unknown correction output {value!r}")
    return names[value]


def correction_crop_filename(value: Any, region: str, suffix: str = "") -> str:
    if region not in {"neck", "shoulder", "base"}:
        raise ValueError(f"unknown correction crop region {region!r}")
    stem = Path(correction_filename(value)).stem
    suffix_text = f"_{suffix.upper()}" if suffix else ""
    return f"{stem}_{region.upper()}_200PCT{suffix_text}.png"


def dataclass_dict(value: Any) -> dict[str, Any]:
    return asdict(value)


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def assert_derivative_path(path: Path, root: Path, label: str) -> Path:
    """Resolve and confine a generated derivative below its dedicated root."""
    path = path.expanduser().resolve()
    root = root.expanduser().resolve()
    if path != root and root not in path.parents:
        raise ValueError(f"{label} must remain below {root}")
    return path
