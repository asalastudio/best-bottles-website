# Homepage hero water and lighting

## Approved direction

- Low, irregular black marble formation surrounded by water.
- Waterline rises almost to the dry rock top; every rock top and bottle base remains dry.
- Obsidian wall with dramatic reflected light from the upper left and no visible light source.
- Crisp, high-contrast glass and reflections with no fog or haze.
- Two exact-source Empire 50 mL assemblies on the right: a gold fine-mist closure and a black antique bulb.
- Left side remains calm and dark enough for white homepage copy.

## Environment plate

- The generated products were removed after visual review found geometry drift.
- The retained raster is a background-only obsidian, rock and water environment.
- Asset: `public/assets/homepage/hero-obsidian-water-stage.webp`

## Exact product sources

- `15. GBEmp50SpryShnGl.psd` supplies the gold fine-mist bottle.
- `39. GBEmp50AnSpBlk.psd` supplies the black antique bulb bottle.
- Original Photoshop layer offsets are preserved and each complete assembly receives only uniform CSS scaling and positioning.
- A deterministic luminance-to-alpha adjustment affects only the clear-glass region so the source prepared for a white catalog field can transmit the dark environment. It does not reshape the bottle or reconstruct the hardware.

## Motion

- A transparent Three.js shader animates only the lower water field and its reflected light.
- Bottles, closures, rock, wall, camera, focus and waterline remain static DOM imagery.
- Reduced-motion visitors receive the static environment plate without the shader layer.
