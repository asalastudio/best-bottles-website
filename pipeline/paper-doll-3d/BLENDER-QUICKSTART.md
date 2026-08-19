# Best Bottles Blender quickstart

This guide is for the Best Bottles product-photography scene. The working
scene uses a cobalt bottle, a warm bone/tan cyclorama, one camera, and four
large emissive light cards.

## See the scene

- **Home** — frame the complete stage: bottle, backdrop, camera, and cards.
- **Numpad 0** — enter or leave the active camera view.
- **Numpad .** — frame the selected object.
- **Numpad 1 / 3 / 7** — front / side / top view.
- **F12** — render the real materials, lighting, backdrop, and shadow.
- **Esc** — return from a render to the 3D viewport.

## Move around

- **Middle-mouse drag** — orbit.
- **Shift + middle-mouse drag** — pan.
- **Mouse wheel** — zoom.
- If the view gets lost, press **Home** to recover the entire scene.

## Select reliably

Use the Outliner at the upper right when objects overlap. Click a name there,
then press **Numpad .** to find it.

- `BB_PRODUCT_ROOT` — whole bottle assembly.
- `BB_BTL_CYL_009ML_001` — bottle body.
- `BB_FIN_17_415` — finish and true helix threads.
- `BB_CAM_MASTER` — render camera.
- `BB_STUDIO_SWEEP` — seamless floor/background cyclorama.
- `BB_LIGHT_KEY_SOFTBOX` — main highlight and shadow direction.
- `BB_CARD_FILL_RIGHT` — controls right-side darkness.
- `BB_CARD_TOP` — top/rim highlight.
- `BB_LIGHT_SWEEP_WASH` — background evenness.

Hold **Shift** while clicking to add or remove objects from a selection.

## Move and rotate precisely

- **G**, then **X / Y / Z** — move on one axis.
- **R**, then **X / Y / Z** — rotate on one axis.
- Type a value after the axis, then press **Enter**. Example: `G`, `Z`,
  `0.25`, `Enter` moves 0.25 Blender units; this scene is authored in
  millimeters, so use the **N panel** for unambiguous production edits.
- **N** — open the Transform panel and edit Location/Rotation numerically.
- **Command + Z** — undo.

Do not scale the bottle body, finish, or thread object. Those dimensions are
locked to the specification. Move the whole product using `BB_PRODUCT_ROOT`.

## Adjust lighting

The softboxes are large emissive mesh cards, not point lights. Select them in
the Outliner so you do not accidentally grab the bottle.

- Move the **key softbox** to change the main vertical highlight and shadow.
- Move the **right fill** closer to open the dark right edge; move it farther
  away for more contrast.
- Move or rotate the **top card** to shape the lip and shoulder highlight.
- Adjust the **sweep wash** to make the tan background more or less even.
- To change brightness, open **Material Properties**, select the card's
  emission material, and change **Emission Strength**.

Change one light at a time and press **F12** after each meaningful move. A
viewport preview is useful for placement, but the render is the authority for
glass, reflections, and shadows.

## Change the backdrop

Select `BB_STUDIO_SWEEP`. Its material is `BB_MAT_STUDIO_BONE`. Change the
Principled BSDF **Base Color** to adjust the background. The approved warm
bone/tan starting point is `#B29878`.

Avoid moving or scaling the sweep during color experiments; it is a large
continuous cyclorama built to catch the bottle's contact shadow.

## How to describe edits

Pixels are fine for reviewing a fixed screenshot, but millimeters and degrees
are repeatable in Blender. Useful instructions look like:

- “Move the complete thread group up 0.25 mm.”
- “Reduce thread spacing from 2.70 mm to 2.60 mm.”
- “Move the key softbox 20 mm left and 10 mm higher.”
- “Rotate the top card 5 degrees toward the bottle.”
- “Make the fill 10% weaker.”

Before experimenting, use **File → Save As** and create a copy. This keeps the
production scene recoverable.
