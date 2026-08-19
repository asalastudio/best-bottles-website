#!/usr/bin/env python3
"""Prepare a generated Best Bottles .blend for hands-on Blender inspection.

The production studio uses very large emissive cards and a cyclorama. They
must remain renderable, but displaying them as solid viewport meshes makes it
nearly impossible to understand or navigate the scene. This pass changes only
viewport/workspace presentation and saves a separate interactive working file.

Usage:
    blender -b input.blend -P prepare-interactive-scene.py -- --output out.blend
"""

import argparse
import math
import sys
from pathlib import Path

import bpy
from mathutils import Quaternion, Vector


def arguments():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--preview-image", type=Path, default=None)
    return parser.parse_args(argv)


def set_collection_color(name, color):
    collection = bpy.data.collections.get(name)
    if collection:
        collection.color_tag = color


def guide_empty(name, location, display_type, size, collection):
    obj = bpy.data.objects.get(name)
    if obj is None:
        obj = bpy.data.objects.new(name, None)
        collection.objects.link(obj)
    obj.location = location
    obj.empty_display_type = display_type
    obj.empty_display_size = size
    obj.show_name = True
    obj.show_in_front = True
    obj.hide_render = True
    return obj


def configure_view(screen_name, location, distance, rotation, shading):
    screen = bpy.data.screens.get(screen_name)
    if not screen:
        return
    for area in screen.areas:
        if area.type != "VIEW_3D":
            continue
        space = area.spaces.active
        space.clip_start = 0.1
        space.clip_end = 10000.0
        space.overlay.show_floor = True
        space.overlay.show_axis_x = True
        space.overlay.show_axis_y = True
        space.overlay.show_extras = True
        space.overlay.show_text = True
        space.overlay.show_relationship_lines = True
        space.overlay.show_outline_selected = True
        space.shading.type = shading
        space.shading.light = "STUDIO"
        space.shading.color_type = "OBJECT"
        space.shading.show_shadows = True
        region = space.region_3d
        region.view_location = Vector(location)
        region.view_distance = distance
        region.view_rotation = Quaternion(rotation)
        region.view_perspective = "PERSP"


def configure_camera_preview(screen_name):
    screen = bpy.data.screens.get(screen_name)
    if not screen:
        return
    for area in screen.areas:
        if area.type != "VIEW_3D":
            continue
        space = area.spaces.active
        space.clip_start = 0.1
        space.clip_end = 10000.0
        space.shading.type = "RENDERED"
        space.shading.use_scene_lights_render = True
        space.shading.use_scene_world_render = True
        space.overlay.show_overlays = False
        region = space.region_3d
        region.view_perspective = "CAMERA"
        region.view_camera_offset = (0.0, 0.0)
        region.view_camera_zoom = 0.0


def activate_workspace(workspace):
    """Return the screen actually associated with this window/workspace.

    Configuring datablocks by their factory names alone is not sufficient:
    Blender can reuse the current window's screen the first time a renamed
    workspace is opened. Activating first makes the saved tab deterministic.
    """
    if not (bpy.context.window and workspace):
        return None
    bpy.context.window.workspace = workspace
    return bpy.context.window.screen


def main():
    args = arguments()
    scene = bpy.context.scene

    # Make the renderable studio readable without changing any render flags.
    for name in (
        "BB_STUDIO_SWEEP",
        "BB_LIGHT_KEY_SOFTBOX",
        "BB_CARD_FILL_RIGHT",
        "BB_CARD_TOP",
        "BB_LIGHT_SWEEP_WASH",
    ):
        obj = bpy.data.objects.get(name)
        if obj:
            obj.display_type = "BOUNDS"
            obj.show_wire = False
            obj.show_all_edges = False
            obj.show_name = True
            obj.show_in_front = True

    studio = bpy.data.objects.get("BB_STUDIO_SWEEP")
    if studio:
        # The actual cyclorama remains visible so rendered/camera preview can
        # display the floor and contact shadow. Correct saved views prevent
        # the user from accidentally starting inside this large mesh.
        studio.display_type = "TEXTURED"
        # Match the actual warm bone/tan studio sweep in solid viewport mode.
        # This is intentionally distinct from the cobalt product color so the
        # bottle remains easy to read while arranging the set.
        studio.color = (0.50, 0.35, 0.23, 1.0)
    for name in ("BB_LIGHT_KEY_SOFTBOX", "BB_CARD_FILL_RIGHT", "BB_CARD_TOP",
                 "BB_LIGHT_SWEEP_WASH"):
        obj = bpy.data.objects.get(name)
        if obj:
            obj.color = (1.0, 0.52, 0.08, 1.0)

    camera = bpy.data.objects.get("BB_CAM_MASTER")
    if camera:
        camera.show_name = True
        camera.show_in_front = True
        camera.color = (0.95, 0.12, 0.08, 1.0)
        camera.data.display_size = 35.0
        camera.data.show_passepartout = False

    for name in ("BB_PRODUCT_ROOT", "BB_BTL_CYL_009ML_001", "BB_FIN_17_415",
                 "BB_ATTACH_NECK"):
        obj = bpy.data.objects.get(name)
        if obj:
            obj.show_name = True

    for name in ("BB_BTL_CYL_009ML_001", "BB_FIN_17_415"):
        obj = bpy.data.objects.get(name)
        if obj:
            obj.color = (0.04, 0.10, 0.82, 1.0)

    attachment = bpy.data.objects.get("BB_ATTACH_NECK")
    if attachment:
        attachment.show_in_front = True
        attachment.empty_display_size = 4.0

    # Parked library geometry and render-only helpers stay available in the
    # Outliner but no longer obstruct interactive navigation.
    library_master = bpy.data.objects.get("FINISH_MASTER_17_415")
    if library_master:
        library_master.hide_viewport = True
    render_flag = bpy.data.objects.get("BB_FLAG_CAMERA")
    if render_flag:
        render_flag.hide_viewport = True

    guides = bpy.data.collections.get("SCENE_GUIDES")
    if guides is None:
        guides = bpy.data.collections.new("SCENE_GUIDES")
        scene.collection.children.link(guides)
    guides.color_tag = "COLOR_04"
    guide_empty("GUIDE_PRODUCT_ORIGIN", (0, 0, 0), "ARROWS", 18.0, guides)
    guide_empty("GUIDE_PRODUCT_CENTER", (0, 0, 36), "SPHERE", 6.0, guides)
    guide_empty("GUIDE_CAMERA_AIM", (0, 0, 36), "CIRCLE", 15.0, guides)

    set_collection_color("CAMERA", "COLOR_01")
    set_collection_color("LIGHTING", "COLOR_03")
    set_collection_color("STUDIO", "COLOR_05")
    set_collection_color("PRODUCT_ROOT", "COLOR_04")
    set_collection_color("BOTTLES", "COLOR_04")
    set_collection_color("FINISH_LIBRARY", "COLOR_06")
    set_collection_color("RENDER_HELPERS", "COLOR_08")

    # Repurpose two standard workspaces with explicit names and saved views.
    overview_workspace = bpy.data.workspaces.get("Layout")
    if overview_workspace:
        overview_workspace.name = "SCENE OVERVIEW"
    detail_workspace = bpy.data.workspaces.get("Modeling")
    if detail_workspace:
        detail_workspace.name = "PRODUCT DETAIL"
    lighting_workspace = bpy.data.workspaces.get("Rendering")
    if lighting_workspace:
        lighting_workspace.name = "LIGHTING PREVIEW"

    # Blender's familiar default perspective quaternion gives a clear
    # three-quarter diagram of the cards, camera, sweep, and product.
    overview_rotation = (0.712, 0.441, 0.287, 0.464)
    front_rotation = (0.7071068, 0.7071068, 0.0, 0.0)
    overview_screen = activate_workspace(overview_workspace)
    if overview_screen:
        configure_view(overview_screen.name, (0, -80, 260), 1450.0,
                       overview_rotation, "SOLID")
    detail_screen = activate_workspace(detail_workspace)
    if detail_screen:
        configure_view(detail_screen.name, (0, 0, 36), 95.0,
                       front_rotation, "SOLID")
    if args.preview_image:
        preview_path = args.preview_image.resolve()
        preview = bpy.data.images.load(str(preview_path), check_existing=True)
        render_screen = activate_workspace(lighting_workspace)
        if render_screen:
            for area in render_screen.areas:
                if area.type == "IMAGE_EDITOR":
                    area.spaces.active.image = preview
        scene["lighting_preview_image"] = str(preview_path)

    # Open on the overview workspace when the file is loaded interactively.
    activate_workspace(overview_workspace)

    scene["interactive_scene_ready"] = True
    scene["interactive_scene_notes"] = (
        "SCENE OVERVIEW shows the complete wireframe studio; PRODUCT DETAIL "
        "frames the bottle; LIGHTING PREVIEW shows the production camera, "
        "backdrop, and rendered contact shadow."
    )

    args.output.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(args.output.resolve()))
    print(f"INTERACTIVE_SCENE_SAVED {args.output.resolve()}")


main()
