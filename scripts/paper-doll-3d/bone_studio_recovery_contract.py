"""Immutable contract for restoring the approved Best Bottles bone studio.

This module has no Blender dependency.  Blender builders consume these values,
while ordinary Python tests guard the geometry and camera source of truth.
"""

from dataclasses import dataclass
from pathlib import Path
from typing import Mapping, Tuple


ROOT = Path(__file__).resolve().parents[2]
LOCK_ROOT = ROOT / "pipeline/paper-doll-3d/master/locked/five-variant-2026-08-11"
WORK_ROOT = ROOT / "pipeline/paper-doll-3d/master/working/five-variant/9ml-bone-studio-recovery"
RENDER_ROOT = ROOT / "pipeline/paper-doll-3d/renders/five-variant/9ml-bone-studio-recovery"
APPROVED_REFERENCE = (
    ROOT / "pipeline/paper-doll-3d/renders/nemat-progress-2026-08-09/final-9ml-cobalt.png"
)

LOCKED_SOURCES = {
    variant: LOCK_ROOT / f"010ml-{variant}-17-415-THREAD-LOCKED-2026-08-11.blend"
    for variant in ("clear", "frosted", "cobalt", "amber", "swirl")
}

LOCKED_FILE_SHA256 = {
    "amber": "0558c8968352003a9136cbdf6812de00c134f36e8998bf6a605c0a620eee4c0f",
    "clear": "8eae1e971da81605b9b7dcb1250256241be9d329b8c293e66e4c6796966f2284",
    "cobalt": "bfa65e27be196e489890cc3680434257b864e4e631687807d907882ceeb6569b",
    "frosted": "b6eae0117092c32c67f9a7366236897a0451501dbe5255c093d11fac3a874d29",
    "swirl": "b621b9adf8e890f29f359bd46ea92c3b6f888d65e161e10fa77170e08decad19",
}

THREAD_SHA256 = "016804a72dc0e7e1197d76d92a20ce84bbac75944a876dda6d2f34712129b39f"
SHARED_BODY_SHA256 = "e9be8d2ddada1a3a2ca926b25a44ae067d9d5ae2f27f25ab55ed62712592f5b6"
SWIRL_BODY_SHA256 = "df1c80ac0c034cba09758c2fcda6d649908c8183ba1a8dd354e0da5beb08eff7"

BODY_NAME = "BB_BTL_CYL_009ML_001"
FINISH_NAME = "BB_FIN_17_415"
CAMERA_NAME = "BB_CAM_MASTER"
PERMITTED_MUTATION_TYPES = frozenset({"STUDIO", "LIGHT", "WORLD", "MATERIAL"})
MUTABLE_SNAPSHOT_FIELDS = frozenset({"materials"})


@dataclass(frozen=True)
class StudioSpec:
    backdrop_hex: str = "#EFE9DE"
    camera_lens_mm: float = 100.0
    camera_sensor_width_mm: float = 36.0
    camera_location_mm: Tuple[float, float, float] = (0.0, -305.5555, 36.0)
    camera_rotation_deg: Tuple[float, float, float] = (90.0, 0.0, 0.0)
    use_dof: bool = False
    render_width_px: int = 2080
    render_height_px: int = 2288
    render_samples: int = 512
    engine: str = "CYCLES"
    view_transform: str = "Standard"
    look: str = "None"
    exposure: float = 0.0


TARGET_STUDIO = StudioSpec()


def working_scene_path(variant: str) -> Path:
    if variant not in LOCKED_SOURCES:
        raise ValueError(f"unknown recovery variant: {variant}")
    return WORK_ROOT / f"009ml-{variant}-bone-recovery.blend"


def assert_protected_state(
    before: Mapping[str, Mapping[str, object]],
    after: Mapping[str, Mapping[str, object]],
) -> None:
    """Reject geometry, transform, camera, or object-set drift.

    A recovery may swap material assignments.  Every other captured field is
    immutable; failures name the exact object and field that drifted.
    """
    if set(before) != set(after):
        missing = sorted(set(before) - set(after))
        added = sorted(set(after) - set(before))
        raise AssertionError(f"protected object set changed; missing={missing}, added={added}")

    for object_name in sorted(before):
        before_fields = before[object_name]
        after_fields = after[object_name]
        comparable_fields = (set(before_fields) | set(after_fields)) - MUTABLE_SNAPSHOT_FIELDS
        for field in sorted(comparable_fields):
            left = before_fields.get(field)
            right = after_fields.get(field)
            if left != right:
                raise AssertionError(
                    f"protected state drifted for {object_name}.{field}: {left!r} != {right!r}"
                )
