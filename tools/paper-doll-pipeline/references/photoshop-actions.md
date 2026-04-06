# Photoshop Batch Processing Reference

Supplementary guide for using Adobe Photoshop when the Python pipeline flags images
for manual correction, or as a standalone alternative workflow.

---

## Photoshop Actions Setup

Create these three actions in a new Action Set called "BestBottles_PaperDoll":

### Action 1: BB_BackgroundRemove

1. Select > Subject (AI-powered selection)
2. Select > Inverse
3. Edit > Clear (deletes background)
4. Select > Deselect
5. Layer > Matting > Defringe... > 1 pixel
6. Layer > Matting > Remove White Matte (for white studio backgrounds)

### Action 2: BB_CanvasNormalize

1. Image > Canvas Size > Width: 600px, Height: 1063px, Anchor: Center, Extension: Transparent
2. (If image is larger than canvas, first run Image > Image Size > fit within 570x1010, constrain proportions, Lanczos resampling)

### Action 3: BB_ExportPNG

1. File > Export > Export As...
   - Format: PNG
   - Transparency: On
   - Quality: Maximum
   - Scale: 1x

---

## Batch Processing

File > Automate > Batch:
- Set: BestBottles_PaperDoll
- Action: BB_BackgroundRemove (or whichever step)
- Source: Folder (select SKU folder)
- Override Action "Open" Commands: checked
- Destination: Folder (select output folder)
- File Naming: Document Name + extension

---

## ExtendScript for Headless Batch Processing

Save as `bb_batch_process.jsx` and run from Photoshop or via command line:

```javascript
// bb_batch_process.jsx
// Run: photoshop.exe -r bb_batch_process.jsx

#target photoshop

var sourceFolder = new Folder("/path/to/source-images");
var outputFolder = new Folder("/path/to/processed");

if (!outputFolder.exists) outputFolder.create();

var skuFolders = sourceFolder.getFiles(function(f) { return f instanceof Folder; });

for (var i = 0; i < skuFolders.length; i++) {
    var skuFolder = skuFolders[i];
    var sku = skuFolder.name;
    var outDir = new Folder(outputFolder + "/" + sku);
    if (!outDir.exists) outDir.create();
    
    var images = skuFolder.getFiles(/\.(png|jpg|jpeg|tif|tiff|psd)$/i);
    
    for (var j = 0; j < images.length; j++) {
        var doc = app.open(images[j]);
        
        // Background removal (Select Subject)
        try {
            var idSelectSubject = stringIDToTypeID("autoCutout");
            var desc = new ActionDescriptor();
            desc.putInteger(stringIDToTypeID("sampleAllLayers"), 0);
            executeAction(idSelectSubject, desc, DialogModes.NO);
            
            // Inverse selection and delete
            app.activeDocument.selection.invert();
            app.activeDocument.selection.clear();
            app.activeDocument.selection.deselect();
        } catch(e) {
            // Select Subject not available, skip bg removal
        }
        
        // Resize canvas to 600x1063
        var targetW = 600;
        var targetH = 1063;
        doc.resizeImage(
            UnitValue(Math.min(doc.width.as("px"), 570), "px"),
            undefined,
            undefined,
            ResampleMethod.BICUBICSHARPER
        );
        doc.resizeCanvas(
            UnitValue(targetW, "px"),
            UnitValue(targetH, "px"),
            AnchorPosition.MIDDLECENTER
        );
        
        // Export as PNG
        var pngOpts = new PNGSaveOptions();
        pngOpts.compression = 6;
        pngOpts.interlaced = false;
        
        var outFile = new File(outDir + "/" + sku + "-layer" + j + ".png");
        doc.saveAs(outFile, pngOpts, true, Extension.LOWERCASE);
        doc.close(SaveOptions.DONOTSAVECHANGES);
    }
}

alert("Batch processing complete: " + skuFolders.length + " SKU folders processed.");
```

---

## When to Use Photoshop vs Python Pipeline

| Scenario | Use Python | Use Photoshop |
|----------|-----------|---------------|
| Bulk processing (>100 products) | Yes | No (too slow) |
| Glass transparency edge cases | First pass | Corrections |
| Complex/lifestyle backgrounds | No | Yes |
| Images flagged by QA audit | No | Yes |
| Composite shots needing manual separation | No | Yes |
| Re-exporting from original PSDs with adjustments | Either | Preferred |

The recommended workflow is Python first (handles 90%+), then Photoshop for
the ~10% of images that get flagged in the QA report.

---

## Photoshop MCP Note

As of March 2026, there is no official Photoshop MCP server for Claude integration.
Adobe's UXP plugin API (Photoshop 2024+) could theoretically be wrapped as an MCP
server, but this would require custom development. For the Best Bottles project,
the ExtendScript batch approach above is more practical and battle-tested.

If an official Adobe MCP server becomes available, the integration point would be
replacing the ExtendScript batch with MCP tool calls from Claude Code, where Claude
could orchestrate Photoshop operations programmatically through the conversation.
