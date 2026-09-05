"""Regression tests for publication detectors and dynamic UI copy boundaries."""
from pathlib import Path
import runpy
ROOT=Path(__file__).resolve().parents[1]
check=runpy.run_path(str(ROOT/'scripts/check-build-business-facts.py'))['violations']
assert check('Our 5-year structural warranty')
assert not check('Manufacturer product information: 25-year structural warranty')
assert check('Contractors are certified installers for Permacon')
assert check('We will lock to ±5% after measurement')
assert not check('Request current documentation and written project terms.')
for name in ['Estimator','ChatWidget']:
    text=(ROOT/f'src/components/{name}.tsx').read_text(encoding='utf-8')
    forbidden=['We handle the engineering','lock to ±5%','Real Carr Landscape Depot pricing','We serve Barrie, Innisfil']
    assert not any(s in text for s in forbidden),f'Dynamic copy bypass in {name}'
print('Publication detector and dynamic-source regression: PASS')
