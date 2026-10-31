import os,time,subprocess
from pathlib import Path
r=Path(__file__).resolve().parents[1]
while True:
 try:os.kill(32627,0)
 except ProcessLookupError:break
 time.sleep(5)
for task in ['render-empire','render-variants']:
 with (r/'audit'/(task+'.log')).open('w') as f:
  result=subprocess.run(['/Applications/Blender.app/Contents/MacOS/Blender','-b','--factory-startup','--python',str(r/'scripts'/(task+'.py')),'--',str(r)],stdout=f,stderr=subprocess.STDOUT)
 print(task,result.returncode,flush=True)
