"""Regression tests for publication detectors and dynamic UI copy boundaries."""
from pathlib import Path
import runpy
ROOT=Path(__file__).resolve().parents[1]
gate=runpy.run_path(str(ROOT/'scripts/check-build-business-facts.py'))
check=gate['violations']; warn=gate['warnings']
assert check('Our 5-year structural warranty')
assert not check('Manufacturer product information: 25-year structural warranty')
assert check('Contractors are certified installers for Permacon')
assert check('We will lock to ±5% after measurement')
assert not check('Request current documentation and written project terms.')
# 2026-09-27 hardening: phrasings that slipped past the original regexes.
assert check('The company holds WSIB certification, $5M commercial liability coverage, and a five-star score on Google.')
assert check('Locally owned, Barrie-based. 5-star rated. Book your free Alliston consultation today.')
assert check('Book your free Innisfil consultation today')
assert check('ICPI-rated 80mm pavers')
assert check('We are a Techo-Pro contractor') and check('proud member of Landscape Ontario') and check('CMHA Certified Concrete Paver Installer')
# Register-aware credentials: allowed only while that exact fact is confirmed (canPublish).
assert not check('We are a Techo-Pro contractor', frozenset({'credentials.techoPro'}))
assert check('We are a Techo-Pro contractor', frozenset({'memberships.landscapeOntario'}))
assert not check('proud member of Landscape Ontario', frozenset({'memberships.landscapeOntario'}))
assert not check('CMHA Certified Concrete Paver Installer', frozenset({'credentials.cmhaPaverInstaller'}))
assert check('5.0 Google rating', frozenset({'credentials.cmhaPaverInstaller','credentials.techoPro','memberships.landscapeOntario'}))
# Negative controls: ordinary construction language must not trip the new patterns.
assert not check('free-draining clear stone keeps water moving through the base')
assert not check('Use the cost estimator for a free estimate range, then book a site visit.')
assert not check('a star-shaped paver inlay')
# Warn tier reports universal base depths without failing the build.
assert warn('a 12-16 inch compacted clear stone base') and not check('a 12-16 inch compacted clear stone base')
for name in ['Estimator','ChatWidget']:
    text=(ROOT/f'src/components/{name}.tsx').read_text(encoding='utf-8')
    forbidden=['We handle the engineering','lock to ±5%','Real Carr Landscape Depot pricing','We serve Barrie, Innisfil']
    assert not any(s in text for s in forbidden),f'Dynamic copy bypass in {name}'
print('Publication detector and dynamic-source regression: PASS')
