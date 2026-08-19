"""Blender gates for the high-key cobalt correction architecture."""

from __future__ import annotations

import importlib.util
import math
from pathlib import Path
import sys
import unittest

import bpy


ROOT = Path(__file__).resolve().parents[3]
SCRIPT_DIR = ROOT / "scripts/paper-doll-3d"
sys.path.insert(0, str(SCRIPT_DIR))
import luxury_glass_contract as contract


def load_builder():
    path = SCRIPT_DIR / "build-9ml-cobalt-correction.py"
    spec = importlib.util.spec_from_file_location("bb_cobalt_correction_builder", path)
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


builder = load_builder()


class CobaltCorrectionBlenderTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.body = bpy.data.objects[contract.BODY_NAME]
        cls.body_before = contract.object_snapshot(cls.body)
        cls.camera_before = contract.object_snapshot(bpy.data.objects[contract.CAMERA_NAME])
        builder.build_correction_in_memory()

    def test_geometry_and_camera_remain_exact(self):
        self.assertEqual(contract.object_snapshot(self.body), self.body_before)
        self.assertEqual(
            contract.object_snapshot(bpy.data.objects[contract.CAMERA_NAME]),
            self.camera_before,
        )
        self.assertEqual(contract.geometry_fingerprint(self.body.data), contract.BODY_GEOMETRY_SHA256)
        self.assertEqual(self.body.get("bb_thread_source_fingerprint"), contract.THREAD_SHA256)

    def test_visible_and_library_finishes_match_the_approved_baseline(self):
        """Catch finish/runout drift even when body metadata still claims a lock."""
        visible = bpy.data.objects[contract.FINISH_NAME]
        library = bpy.data.objects[contract.FINISH_MASTER_NAME]
        self.assertEqual(
            contract.geometry_fingerprint(visible.data),
            contract.APPROVED_FINISH_GEOMETRY_SHA256,
        )
        self.assertEqual(
            contract.geometry_fingerprint(library.data),
            contract.APPROVED_FINISH_GEOMETRY_SHA256,
        )

    def test_clear_calibration_has_no_absorption_and_neutral_surface(self):
        material = self.body.data.materials[0]
        self.assertEqual(material.name, "BB_CORR_CLEAR")
        group = next(node for node in material.node_tree.nodes if node.bl_idname == "ShaderNodeGroup")
        self.assertEqual(group.inputs["absorption_density"].default_value, 0.0)
        self.assertEqual(group.inputs["transmission"].default_value, 1.0)
        self.assertEqual(group.inputs["IOR"].default_value, 1.5)
        self.assertAlmostEqual(group.inputs["surface_roughness"].default_value, 0.035)

    def test_studio_uses_white_scrims_without_negative_fill_or_rear_rim(self):
        collection = bpy.data.collections[contract.COBALT_CORRECTION.collection_name]
        lights = [obj for obj in collection.objects if obj.type == "LIGHT"]
        scrims = [obj for obj in collection.objects if obj.get("bb_diffusion_scrim")]
        self.assertEqual({obj.name for obj in lights}, {spec.name for spec in contract.CORRECTION_LIGHTS})
        self.assertEqual({obj.name for obj in scrims}, {spec.name for spec in contract.CORRECTION_SCRIMS})
        self.assertEqual(len(lights), 3)
        self.assertEqual(len(scrims), 2)
        for light in lights:
            self.assertFalse(light.visible_glossy)
            self.assertEqual(tuple(light.data.color), (1.0, 1.0, 1.0))
        for scrim in scrims:
            self.assertFalse(scrim.visible_camera)
            self.assertTrue(scrim.visible_glossy)
        panel = bpy.data.objects["BB_CORR_BACKDROP_PANEL"]
        self.assertTrue(panel.visible_camera)
        self.assertTrue(panel.visible_transmission)
        self.assertFalse(panel.visible_glossy)
        floor = bpy.data.objects["BB_CORR_FLOOR"]
        self.assertTrue(floor.get("bb_correction_physical_floor"))
        self.assertTrue(floor.visible_shadow)
        self.assertFalse(floor.visible_transmission)
        self.assertFalse(floor.visible_glossy)
        self.assertTrue(bpy.data.objects["BB_STUDIO_SWEEP"].hide_render)
        self.assertFalse(any(obj.get("bb_negative_fill") and not obj.hide_render for obj in bpy.data.objects))
        self.assertFalse(
            any(
                (obj.name.startswith("BB_FLAG_") or obj.name.startswith("BB_CARD_"))
                and not obj.hide_render
                for obj in bpy.data.objects
            )
        )
        self.assertIsNone(bpy.data.objects.get("BB_CORR_REAR_RIM"))

    def test_background_and_world_are_bright_warm_bone(self):
        scene = bpy.context.scene
        self.assertEqual(scene["bb_background_hex"], "#F3EFE8")
        background = scene.world.node_tree.nodes.get("Background")
        self.assertAlmostEqual(background.inputs["Strength"].default_value, 0.70)
        self.assertEqual(scene.view_settings.view_transform, "AgX")
        self.assertAlmostEqual(
            scene.view_settings.exposure,
            contract.COBALT_CORRECTION.exposure,
        )
        sweep = bpy.data.objects["BB_STUDIO_SWEEP"]
        self.assertTrue(sweep.hide_render)
        panel = bpy.data.objects["BB_CORR_BACKDROP_PANEL"]
        floor = bpy.data.objects["BB_CORR_FLOOR"]
        self.assertGreater(panel.data.materials[0].diffuse_color[0], 0.85)
        self.assertGreater(floor.data.materials[0].diffuse_color[0], 0.85)

    def test_four_cobalt_candidates_only_change_absorption_density(self):
        materials = builder.ensure_correction_materials()
        self.assertEqual(set(materials), {"clear", 25, 50, 75, 100})
        for percentage, density in contract.CORRECTION_COBALT_DENSITIES.items():
            group = next(
                node for node in materials[percentage].node_tree.nodes
                if node.bl_idname == "ShaderNodeGroup"
            )
            self.assertAlmostEqual(group.inputs["absorption_density"].default_value, density)
            for actual, expected in zip(
                tuple(group.inputs["absorption_color"].default_value)[:3],
                (0.003, 0.012, 0.92),
            ):
                self.assertAlmostEqual(actual, expected)
            self.assertAlmostEqual(
                group.inputs["surface_roughness"].default_value,
                contract.COBALT_CORRECTION.cobalt_roughness,
            )

    def test_reference_v2_preserves_geometry_and_uses_royal_cobalt_optics(self):
        body_before = contract.object_snapshot(self.body)
        camera_before = contract.object_snapshot(bpy.data.objects[contract.CAMERA_NAME])
        builder.build_reference_v2_in_memory()
        self.assertEqual(contract.object_snapshot(self.body), body_before)
        self.assertEqual(
            contract.object_snapshot(bpy.data.objects[contract.CAMERA_NAME]),
            camera_before,
        )
        materials = builder.ensure_reference_v2_materials()
        target = contract.COBALT_REFERENCE_V2
        for percentage, density in contract.REFERENCE_V2_COBALT_DENSITIES.items():
            group = next(
                node for node in materials[percentage].node_tree.nodes
                if node.bl_idname == "ShaderNodeGroup"
            )
            self.assertAlmostEqual(group.inputs["absorption_density"].default_value, density)
            self.assertEqual(
                tuple(round(value, 6) for value in group.inputs["absorption_color"].default_value[:3]),
                target.absorption_color,
            )
            self.assertAlmostEqual(
                group.inputs["surface_roughness"].default_value,
                target.cobalt_roughness,
            )
        hero = bpy.data.objects["BB_REF_V2_HERO_SCRIM"]
        top = bpy.data.objects["BB_REF_V2_TOP_FILL"]
        neck_fill = bpy.data.objects["BB_REF_V2_NECK_SEPARATION_FILL"]
        self.assertAlmostEqual(hero["bb_width_mm"], target.hero_scrim_width_mm)
        self.assertAlmostEqual(hero["bb_height_mm"], target.hero_scrim_height_mm)
        self.assertAlmostEqual(hero["bb_wrap_degrees"], target.hero_scrim_wrap_degrees)
        self.assertTrue(hero["bb_curved_diffusion_field"])
        self.assertFalse(hero.visible_glossy)
        active_scrims = [
            obj for obj in bpy.data.objects
            if obj.get("bb_reference_v2_hero_scrim") and not obj.hide_render
        ]
        self.assertEqual([obj.name for obj in active_scrims], [target.hero_scrim_name])
        self.assertTrue(bpy.data.objects.get("BB_REF_V2_LEFT_SCRIM") is None or bpy.data.objects["BB_REF_V2_LEFT_SCRIM"].hide_render)
        self.assertTrue(bpy.data.objects.get("BB_REF_V2_RIGHT_SCRIM") is None or bpy.data.objects["BB_REF_V2_RIGHT_SCRIM"].hide_render)
        self.assertAlmostEqual(top.data.energy, target.top_fill_watts)
        self.assertAlmostEqual(
            neck_fill.data.energy,
            target.neck_separation_fill_watts,
        )
        self.assertFalse(neck_fill.visible_glossy)
        self.assertTrue(neck_fill.get("bb_thread_separation_fill"))
        self.assertFalse(any(obj.get("bb_negative_fill") and not obj.hide_render for obj in bpy.data.objects))
        self.assertEqual(target.selected_density_percentage, 75)
        self.assertEqual(target.selected_packshot_yaw_degrees, -30.0)
        self.assertAlmostEqual(
            contract.REFERENCE_V2_COBALT_DENSITIES[target.selected_density_percentage],
            1.80,
        )
        self.assertEqual(
            bpy.context.scene["bb_selected_density_percentage"],
            target.selected_density_percentage,
        )
        self.assertEqual(
            bpy.context.scene["bb_approved_finish_geometry_sha256"],
            contract.APPROVED_FINISH_GEOMETRY_SHA256,
        )

    def test_final_lock_candidate_combines_photo2_subject_with_photo1_studio(self):
        body = bpy.data.objects[contract.BODY_NAME]
        rotation_before = body.rotation_euler.copy()
        self.addCleanup(setattr, body, "rotation_euler", rotation_before)
        body_mesh_before = contract.geometry_fingerprint(body.data)
        finish_mesh_before = contract.geometry_fingerprint(
            bpy.data.objects[contract.FINISH_MASTER_NAME].data
        )
        camera_before = contract.object_snapshot(bpy.data.objects[contract.CAMERA_NAME])

        builder.build_final_lock_candidate_in_memory()
        target = contract.COBALT_FINAL_LOCK
        collection = bpy.data.collections[target.collection_name]
        key = bpy.data.objects[target.left_key_name]
        scrim = bpy.data.objects[target.left_scrim_name]
        floor = bpy.data.objects[target.floor_name]
        backdrop = bpy.data.objects[target.backdrop_name]

        self.assertEqual(contract.geometry_fingerprint(body.data), body_mesh_before)
        self.assertEqual(
            contract.geometry_fingerprint(bpy.data.objects[contract.FINISH_MASTER_NAME].data),
            finish_mesh_before,
        )
        self.assertEqual(
            contract.object_snapshot(bpy.data.objects[contract.CAMERA_NAME]),
            camera_before,
        )
        self.assertAlmostEqual(math.degrees(body.rotation_euler.z), -30.0, places=4)
        self.assertEqual(body.data.materials[0].name, "BB_REF_V2_COBALT_75")
        self.assertEqual(bpy.context.scene["bb_final_lock_geometry_source"], "Photo 2")
        self.assertEqual(bpy.context.scene["bb_final_lock_lighting_source"], "Photo 1")
        self.assertEqual(bpy.context.scene["bb_shadow_direction"], "camera-right")
        self.assertEqual(bpy.context.scene["bb_background_hex"], target.background_hex)

        self.assertIn(key.name, collection.objects)
        self.assertLess(key.location.x, 0.0)
        self.assertGreater(key.location.z, 72.0)
        self.assertTrue(key.get("bb_shadow_key"))
        self.assertTrue(key.visible_diffuse)
        self.assertFalse(key.visible_glossy)
        self.assertTrue(scrim.visible_glossy)
        self.assertFalse(scrim.visible_camera)
        self.assertTrue(scrim.get("bb_final_left_diffusion_scrim"))
        self.assertTrue(floor.visible_shadow)
        self.assertFalse(floor.visible_glossy)
        self.assertTrue(backdrop.visible_camera)
        self.assertFalse(backdrop.visible_glossy)
        self.assertFalse(any(obj.get("bb_negative_fill") and not obj.hide_render for obj in bpy.data.objects))

    def test_grounded_contact_pass_only_tightens_the_existing_physical_key(self):
        target = contract.COBALT_FINAL_LOCK
        body = bpy.data.objects[contract.BODY_NAME]
        body_mesh_before = contract.geometry_fingerprint(body.data)
        finish_mesh_before = contract.geometry_fingerprint(
            bpy.data.objects[contract.FINISH_MASTER_NAME].data
        )
        camera_before = contract.object_snapshot(bpy.data.objects[contract.CAMERA_NAME])

        builder.build_final_lock_candidate_in_memory()
        key = bpy.data.objects[target.left_key_name]
        floor = bpy.data.objects[target.floor_name]

        self.assertEqual(key.data.size, target.contact_key_width_mm)
        self.assertEqual(key.data.size_y, target.contact_key_height_mm)
        self.assertEqual(key.data.energy, target.contact_key_watts)
        self.assertEqual(tuple(key.location), target.contact_key_location_mm)
        self.assertLess(target.contact_key_width_mm, 40.0)
        self.assertLess(target.contact_key_height_mm, 86.0)
        self.assertLess(target.contact_key_location_mm[2], 88.0)
        self.assertTrue(key["bb_grounded_contact_pass"])
        self.assertEqual(
            bpy.context.scene["bb_contact_shadow_adjustment"],
            "existing-left-key-only",
        )
        self.assertEqual(contract.geometry_fingerprint(body.data), body_mesh_before)
        self.assertEqual(
            contract.geometry_fingerprint(bpy.data.objects[contract.FINISH_MASTER_NAME].data),
            finish_mesh_before,
        )
        self.assertEqual(
            contract.object_snapshot(bpy.data.objects[contract.CAMERA_NAME]), camera_before
        )
        self.assertEqual(min(vertex.co.z for vertex in floor.data.vertices), 0.0)

    def test_base_halo_control_is_removable_glossy_only_and_preserves_scene(self):
        target = contract.COBALT_FINAL_LOCK
        body = bpy.data.objects[contract.BODY_NAME]
        rotation_before = body.rotation_euler.copy()
        material_before = body.data.materials[0]
        self.addCleanup(setattr, body, "rotation_euler", rotation_before)
        def restore_material():
            body.data.materials.clear()
            body.data.materials.append(material_before)

        self.addCleanup(restore_material)
        body_mesh_before = contract.geometry_fingerprint(body.data)
        finish_mesh_before = contract.geometry_fingerprint(
            bpy.data.objects[contract.FINISH_MASTER_NAME].data
        )
        camera_before = contract.object_snapshot(bpy.data.objects[contract.CAMERA_NAME])
        light_names = (
            target.left_key_name,
            target.top_fill_name,
            target.neck_fill_name,
        )
        builder.build_base_halo_control_candidate_in_memory()
        light_before = {
            name: (
                tuple(bpy.data.objects[name].location),
                tuple(bpy.data.objects[name].rotation_euler),
                bpy.data.objects[name].data.energy,
            )
            for name in light_names
        }

        card = bpy.data.objects[target.base_halo_control_name]
        collection = bpy.data.collections[target.collection_name]
        floor = bpy.data.objects[target.floor_name]

        self.assertIn(card.name, collection.objects)
        self.assertEqual(card["bb_base_halo_reduction_percent"], 15)
        self.assertTrue(card["bb_removable_experiment"])
        self.assertFalse(card.visible_camera)
        self.assertTrue(card.visible_glossy)
        self.assertFalse(card.visible_diffuse)
        self.assertFalse(card.visible_transmission)
        self.assertFalse(card.visible_shadow)
        self.assertEqual(
            bpy.context.scene["bb_base_halo_control"], "15-percent-glossy-only"
        )
        self.assertEqual(contract.geometry_fingerprint(body.data), body_mesh_before)
        self.assertEqual(
            contract.geometry_fingerprint(bpy.data.objects[contract.FINISH_MASTER_NAME].data),
            finish_mesh_before,
        )
        self.assertEqual(
            contract.object_snapshot(bpy.data.objects[contract.CAMERA_NAME]), camera_before
        )
        self.assertEqual(min(vertex.co.z for vertex in floor.data.vertices), 0.0)
        self.assertEqual(
            {
                name: (
                    tuple(bpy.data.objects[name].location),
                    tuple(bpy.data.objects[name].rotation_euler),
                    bpy.data.objects[name].data.energy,
                )
                for name in light_names
            },
            light_before,
        )

    def test_grounded_contact_v2_only_tightens_left_key_and_disables_halo_card(self):
        target = contract.COBALT_FINAL_LOCK
        body = bpy.data.objects[contract.BODY_NAME]
        rotation_before = body.rotation_euler.copy()
        material_before = body.data.materials[0]
        self.addCleanup(setattr, body, "rotation_euler", rotation_before)

        def restore_material():
            body.data.materials.clear()
            body.data.materials.append(material_before)

        self.addCleanup(restore_material)
        body_mesh_before = contract.geometry_fingerprint(body.data)
        finish_mesh_before = contract.geometry_fingerprint(
            bpy.data.objects[contract.FINISH_MASTER_NAME].data
        )
        camera_before = contract.object_snapshot(bpy.data.objects[contract.CAMERA_NAME])

        builder.build_grounded_contact_v2_candidate_in_memory()
        key = bpy.data.objects[target.left_key_name]
        top_fill = bpy.data.objects[target.top_fill_name]
        neck_fill = bpy.data.objects[target.neck_fill_name]
        scrim = bpy.data.objects[target.left_scrim_name]
        floor = bpy.data.objects[target.floor_name]
        card = bpy.data.objects.get(target.base_halo_control_name)
        material = body.data.materials[0]
        group = next(
            node for node in material.node_tree.nodes
            if node.bl_idname == "ShaderNodeGroup"
        )

        self.assertEqual(tuple(key.location), target.contact_v2_key_location_mm)
        self.assertEqual(key.data.size, target.contact_v2_key_width_mm)
        self.assertEqual(key.data.size_y, target.contact_v2_key_height_mm)
        self.assertEqual(key.data.energy, target.contact_v2_key_watts)
        self.assertEqual(target.contact_v2_key_watts, target.contact_key_watts)
        self.assertTrue(key["bb_grounded_contact_v2"])
        self.assertEqual(bpy.context.scene["bb_contact_shadow_adjustment"], "v2-tighter")
        self.assertTrue(card is None or card.hide_render)
        self.assertEqual(top_fill.data.energy, target.top_fill_watts)
        self.assertEqual(neck_fill.data.energy, target.neck_fill_watts)
        self.assertEqual(scrim.get("bb_wrap_degrees"), 264.0)
        self.assertEqual(material.name, "BB_REF_V2_COBALT_75")
        self.assertAlmostEqual(group.inputs["absorption_density"].default_value, 1.80)
        self.assertAlmostEqual(group.inputs["surface_roughness"].default_value, 0.032)
        self.assertEqual(contract.geometry_fingerprint(body.data), body_mesh_before)
        self.assertEqual(
            contract.geometry_fingerprint(bpy.data.objects[contract.FINISH_MASTER_NAME].data),
            finish_mesh_before,
        )
        self.assertEqual(
            contract.object_snapshot(bpy.data.objects[contract.CAMERA_NAME]), camera_before
        )
        self.assertEqual(min(vertex.co.z for vertex in floor.data.vertices), 0.0)

    def test_gloss_refraction_candidates_only_change_density_and_surface_roughness(self):
        target = contract.COBALT_FINAL_LOCK
        body = bpy.data.objects[contract.BODY_NAME]
        rotation_before = body.rotation_euler.copy()
        material_before = body.data.materials[0]
        self.addCleanup(setattr, body, "rotation_euler", rotation_before)

        def restore_material():
            body.data.materials.clear()
            body.data.materials.append(material_before)

        self.addCleanup(restore_material)
        builder.build_final_lock_candidate_in_memory()

        body_hash = contract.geometry_fingerprint(body.data)
        finish_hash = contract.geometry_fingerprint(
            bpy.data.objects[contract.FINISH_MASTER_NAME].data
        )
        camera_state = contract.object_snapshot(bpy.data.objects[contract.CAMERA_NAME])

        def studio_signature():
            result = {}
            for name in (
                target.left_key_name,
                target.top_fill_name,
                target.neck_fill_name,
                target.left_scrim_name,
                target.backdrop_name,
                target.floor_name,
            ):
                obj = bpy.data.objects[name]
                entry = {
                    "object": contract.object_snapshot(obj),
                    "hide_render": obj.hide_render,
                    "visible_camera": obj.visible_camera,
                    "visible_glossy": obj.visible_glossy,
                    "visible_diffuse": obj.visible_diffuse,
                    "visible_transmission": obj.visible_transmission,
                    "visible_shadow": obj.visible_shadow,
                }
                if obj.type == "LIGHT":
                    entry["light"] = (
                        obj.data.energy,
                        obj.data.size,
                        obj.data.size_y,
                        tuple(obj.data.color),
                    )
                result[name] = entry
            scene = bpy.context.scene
            result["scene"] = {
                "background": scene["bb_background_hex"],
                "exposure": scene.view_settings.exposure,
                "view_transform": scene.view_settings.view_transform,
                "look": scene.view_settings.look,
                "world_strength": scene.world.node_tree.nodes["Background"].inputs[
                    "Strength"
                ].default_value,
            }
            return result

        studio_before = studio_signature()
        expected = {
            "baseline-v1": ("BB_REF_V2_COBALT_75", 1.80, 0.032),
            "polished": ("BB_GLOSS_COBALT_POLISHED", 1.80, 0.020),
            "luminous-polished": (
                "BB_GLOSS_COBALT_LUMINOUS_POLISHED",
                1.55,
                0.020,
            ),
        }

        baseline_inputs = None
        for key, (material_name, density, roughness) in expected.items():
            builder.build_gloss_refraction_candidate_in_memory(key)
            material = body.data.materials[0]
            group = next(
                node
                for node in material.node_tree.nodes
                if node.bl_idname == "ShaderNodeGroup"
            )
            invariant_inputs = {
                name: tuple(socket.default_value)
                if hasattr(socket.default_value, "__len__")
                else socket.default_value
                for name, socket in group.inputs.items()
                if name not in {"absorption_density", "surface_roughness"}
            }
            if baseline_inputs is None:
                baseline_inputs = invariant_inputs
            self.assertEqual(invariant_inputs, baseline_inputs)
            self.assertEqual(material.name, material_name)
            self.assertAlmostEqual(
                group.inputs["absorption_density"].default_value, density
            )
            self.assertAlmostEqual(
                group.inputs["surface_roughness"].default_value, roughness
            )
            self.assertEqual(
                bpy.context.scene["bb_gloss_refraction_variant"], key
            )
            self.assertEqual(studio_signature(), studio_before)
            self.assertEqual(contract.geometry_fingerprint(body.data), body_hash)
            self.assertEqual(
                contract.geometry_fingerprint(
                    bpy.data.objects[contract.FINISH_MASTER_NAME].data
                ),
                finish_hash,
            )
            self.assertEqual(
                contract.object_snapshot(bpy.data.objects[contract.CAMERA_NAME]),
                camera_state,
            )

        with self.assertRaisesRegex(ValueError, "unknown gloss-refraction candidate"):
            builder.build_gloss_refraction_candidate_in_memory("saturated-plastic")

    def test_gloss_refraction_scrim_calibration_only_gains_the_existing_curved_diffuser(self):
        target = contract.COBALT_FINAL_LOCK
        body = bpy.data.objects[contract.BODY_NAME]
        rotation_before = body.rotation_euler.copy()
        material_before = body.data.materials[0]
        self.addCleanup(setattr, body, "rotation_euler", rotation_before)

        def restore_material():
            body.data.materials.clear()
            body.data.materials.append(material_before)

        self.addCleanup(restore_material)
        builder.build_final_lock_candidate_in_memory()
        body_hash = contract.geometry_fingerprint(body.data)
        finish_hash = contract.geometry_fingerprint(
            bpy.data.objects[contract.FINISH_MASTER_NAME].data
        )
        camera_state = contract.object_snapshot(bpy.data.objects[contract.CAMERA_NAME])
        scrim = bpy.data.objects[target.left_scrim_name]
        scrim_state = contract.object_snapshot(scrim)
        original_material = scrim.data.materials[0]
        original_gain = next(
            node.inputs[1].default_value
            for node in original_material.node_tree.nodes
            if node.bl_idname == "ShaderNodeMath"
            and node.operation == "MULTIPLY"
            and abs(node.inputs[1].default_value - target.scrim_emission) < 1e-6
        )
        light_state = {
            name: (
                contract.object_snapshot(bpy.data.objects[name]),
                bpy.data.objects[name].data.energy,
                bpy.data.objects[name].data.size,
                bpy.data.objects[name].data.size_y,
            )
            for name in (
                target.left_key_name,
                target.top_fill_name,
                target.neck_fill_name,
            )
        }

        builder.build_gloss_refraction_scrim_calibration_in_memory()
        material = body.data.materials[0]
        glass_group = next(
            node
            for node in material.node_tree.nodes
            if node.bl_idname == "ShaderNodeGroup"
        )
        calibrated_material = scrim.data.materials[0]
        calibrated_gain = next(
            node.inputs[1].default_value
            for node in calibrated_material.node_tree.nodes
            if node.bl_idname == "ShaderNodeMath"
            and node.operation == "MULTIPLY"
            and node.name == "BB_GLOSS_REFRACTION_SCRIM_GAIN"
        )

        self.assertEqual(material.name, "BB_GLOSS_COBALT_LUMINOUS_POLISHED")
        self.assertAlmostEqual(
            glass_group.inputs["absorption_density"].default_value, 1.55
        )
        self.assertAlmostEqual(
            glass_group.inputs["surface_roughness"].default_value, 0.020
        )
        self.assertEqual(
            calibrated_material.name,
            "BB_MAT_FINAL_LEFT_DIFFUSION_GLOSS_110",
        )
        self.assertIsNot(calibrated_material, original_material)
        self.assertAlmostEqual(original_gain, target.scrim_emission)
        self.assertAlmostEqual(
            calibrated_gain,
            target.scrim_emission * contract.GLOSS_REFRACTION_SCRIM_GAIN,
        )
        self.assertEqual(contract.object_snapshot(scrim), scrim_state)
        self.assertTrue(scrim.visible_glossy)
        self.assertEqual(scrim.get("bb_wrap_degrees"), 264.0)
        self.assertEqual(
            bpy.context.scene["bb_gloss_refraction_scrim_calibration"],
            "single-curved-scrim-110-percent",
        )
        self.assertEqual(
            {
                name: (
                    contract.object_snapshot(bpy.data.objects[name]),
                    bpy.data.objects[name].data.energy,
                    bpy.data.objects[name].data.size,
                    bpy.data.objects[name].data.size_y,
                )
                for name in light_state
            },
            light_state,
        )
        self.assertEqual(contract.geometry_fingerprint(body.data), body_hash)
        self.assertEqual(
            contract.geometry_fingerprint(
                bpy.data.objects[contract.FINISH_MASTER_NAME].data
            ),
            finish_hash,
        )
        self.assertEqual(
            contract.object_snapshot(bpy.data.objects[contract.CAMERA_NAME]),
            camera_state,
        )

        builder.build_gloss_refraction_scrim_calibration_in_memory()
        rebuilt_material = scrim.data.materials[0]
        rebuilt_gain = next(
            node.inputs[1].default_value
            for node in rebuilt_material.node_tree.nodes
            if node.name == "BB_GLOSS_REFRACTION_SCRIM_GAIN"
        )
        self.assertIs(rebuilt_material, calibrated_material)
        self.assertAlmostEqual(rebuilt_gain, calibrated_gain)

    def test_neutral_surface_tint_candidate_only_neutralizes_dielectric_base_color(self):
        target = contract.COBALT_FINAL_LOCK
        body = bpy.data.objects[contract.BODY_NAME]
        material_before = body.data.materials[0]

        def restore_material():
            body.data.materials.clear()
            body.data.materials.append(material_before)

        self.addCleanup(restore_material)
        builder.build_gloss_refraction_candidate_in_memory("luminous-polished")
        body_hash = contract.geometry_fingerprint(body.data)
        visible_finish_hash = contract.geometry_fingerprint(
            bpy.data.objects[contract.FINISH_NAME].data
        )
        finish_master_hash = contract.geometry_fingerprint(
            bpy.data.objects[contract.FINISH_MASTER_NAME].data
        )
        camera_state = contract.object_snapshot(bpy.data.objects[contract.CAMERA_NAME])

        protected_names = (
            target.left_key_name,
            target.top_fill_name,
            target.neck_fill_name,
            target.left_scrim_name,
            target.backdrop_name,
            target.floor_name,
        )
        protected_state = {
            name: (
                contract.object_snapshot(bpy.data.objects[name]),
                bpy.data.objects[name].hide_render,
                bpy.data.objects[name].visible_camera,
                bpy.data.objects[name].visible_glossy,
                bpy.data.objects[name].visible_diffuse,
                bpy.data.objects[name].visible_transmission,
                bpy.data.objects[name].visible_shadow,
            )
            for name in protected_names
        }

        source = body.data.materials[0]
        source_group = next(
            node for node in source.node_tree.nodes if node.bl_idname == "ShaderNodeGroup"
        )
        source_inputs = {
            name: tuple(socket.default_value)
            if hasattr(socket.default_value, "__len__")
            else socket.default_value
            for name, socket in source_group.inputs.items()
        }

        builder.build_neutral_surface_tint_candidate_in_memory()
        candidate = body.data.materials[0]
        candidate_group = next(
            node
            for node in candidate.node_tree.nodes
            if node.bl_idname == "ShaderNodeGroup"
        )
        candidate_inputs = {
            name: tuple(socket.default_value)
            if hasattr(socket.default_value, "__len__")
            else socket.default_value
            for name, socket in candidate_group.inputs.items()
        }
        dielectric = candidate_group.node_tree.nodes["Physical Dielectric Glass"]

        self.assertEqual(candidate.name, "BB_GLOSS_COBALT_NEUTRAL_SURFACE")
        self.assertEqual(candidate_inputs, source_inputs)
        self.assertEqual(
            tuple(dielectric.inputs["Base Color"].default_value),
            (1.0, 1.0, 1.0, 1.0),
        )
        self.assertAlmostEqual(candidate_group.inputs["absorption_density"].default_value, 1.55)
        self.assertAlmostEqual(candidate_group.inputs["surface_roughness"].default_value, 0.020)
        self.assertEqual(bpy.context.scene["bb_neutral_surface_tint_version"], "cobalt-neutral-surface-tint-v1")
        self.assertEqual(bpy.context.scene["bb_neutral_surface_tint_scope"], "dielectric-base-color-only")
        self.assertEqual(contract.geometry_fingerprint(body.data), body_hash)
        self.assertEqual(
            contract.geometry_fingerprint(bpy.data.objects[contract.FINISH_NAME].data),
            visible_finish_hash,
        )
        self.assertEqual(
            contract.geometry_fingerprint(bpy.data.objects[contract.FINISH_MASTER_NAME].data),
            finish_master_hash,
        )
        self.assertEqual(
            contract.object_snapshot(bpy.data.objects[contract.CAMERA_NAME]),
            camera_state,
        )
        self.assertEqual(
            {
                name: (
                    contract.object_snapshot(bpy.data.objects[name]),
                    bpy.data.objects[name].hide_render,
                    bpy.data.objects[name].visible_camera,
                    bpy.data.objects[name].visible_glossy,
                    bpy.data.objects[name].visible_diffuse,
                    bpy.data.objects[name].visible_transmission,
                    bpy.data.objects[name].visible_shadow,
                )
                for name in protected_names
            },
            protected_state,
        )


suite = unittest.defaultTestLoader.loadTestsFromTestCase(CobaltCorrectionBlenderTests)
result = unittest.TextTestRunner(verbosity=2).run(suite)
if not result.wasSuccessful():
    raise SystemExit(1)
