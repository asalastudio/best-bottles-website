"""Prepare a separate backend deployment workspace. No network calls or deploys."""
from pathlib import Path
import json,shutil,tempfile,subprocess
root=Path.cwd()
stage=Path(tempfile.mkdtemp(prefix='bb-isolated-backend-'))
for folder in ['convex','src','preview-backend']:
    shutil.copytree(root/folder,stage/folder)
for filename in ['package.json','package-lock.json','tsconfig.json','next-env.d.ts']:
    shutil.copy2(root/filename,stage/filename)
(stage/'node_modules').symlink_to(root/'node_modules',target_is_directory=True)
(stage/'convex.json').write_text(json.dumps({'functions':'preview-backend/convex/'}))
(stage/'preview.env').write_text('CONVEX_DEPLOYMENT=dev:beloved-wildcat-265\nNEXT_PUBLIC_CONVEX_URL=https://beloved-wildcat-265.convex.cloud\n')
# Preserve the actual source commit for the deployment receipt.
commit=subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip()
(stage/'source-commit.txt').write_text(commit+'\n')
print(stage)
