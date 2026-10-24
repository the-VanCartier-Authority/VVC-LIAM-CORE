import json, subprocess
from pathlib import Path

root = Path('/workspace/vvc-consolidation')
out = Path('/workspace/vvc-consolidation-evidence')
proposals = [
 (3,'0be6e86a0099c2c6f4947695b69522a2ba5e864f'),
 (5,'d9df435f0afc34f6064223f962df4858616a2cf0'),
 (7,'7f0cffdd39a95eda359b0aebe670ba7405f0955e'),
 (9,'f5362170157dd102f890d3378450c7afd46733c9'),
 (11,'6f94b7c61cf45536fd99cbecc8bed5ffcb8fa7af'),
 (13,'2740edda574a6823496b5dd28cd167cde0c44ffa'),
 (15,'72be2a188bade2258ed80305dcc96ef8d1c265e5'),
 (17,'5202f8edc04cbabc8d60a9e33a96b1c07795c924'),
 (19,'2957d6cc56612cec33b68e2de3915781de3fb269'),
 (21,'34ce45da31590a8745418ff493d6cd3cd265f536'),
 (23,'710426df0168aa427e50d4420815a282783cf9d4'),
 (27,'d5dfa0d9c4a06b20682fc82bf842123f0000db4e'),
 (29,'947e0357c56fa66a502bf44248b3afc8f24f174a'),
 (25,'2b6cad2c0b287f8d4ac13f400258c924e9bb898e'),
 (32,'159817d7eb49b3b8e88256c501097655ed805b23'),
 (34,'2e256477e02e255c6664ed660ff055054c7458f9'),
 (36,'7ab086e878e27e53fd58ef0b1280bbcd264deb3d'),
 (38,'a462cfbdee3bda796bb8dca7e65a64f5d3637eae'),
 (40,'5934384efab7010bd0d436bb9234df64f1960551'),
]
def git(*args):
 return subprocess.run(['git',*args],cwd=root,text=True,capture_output=True)
for pr,sha in proposals:
 if git('merge-base','--is-ancestor',sha,'HEAD').returncode == 0:
  continue
 before=git('rev-parse','HEAD').stdout.strip()
 r=git('merge','--no-ff','-m',f'verify: combine PR #{pr} at {sha} without merging its GitHub PR',sha)
 (out/f'merge-pr{pr}.txt').write_text(r.stdout+r.stderr)
 conflicts=git('diff','--name-only','--diff-filter=U').stdout.strip().splitlines()
 with (out/'merge-sequence.jsonl').open('a') as f:
  f.write(json.dumps({'pr':pr,'sha':sha,'before':before,'exit':r.returncode,'conflicts':conflicts})+'\n')
 print(json.dumps({'pr':pr,'exit':r.returncode,'conflicts':conflicts}),flush=True)
 if r.returncode:
  raise SystemExit(r.returncode)
