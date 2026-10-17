#!/usr/bin/env python3
"""Find and decode the QR inside rendered card/poster previews (whole page, as a phone would see it).

usage: python3 verify-scan.py <expected-url> <preview.png[:expected-count]> [...]
Checks each image as-is and downscaled to 900 px wide. Exit 0 if every image decodes to the URL.
"""
import sys

from PIL import Image

expected, files = sys.argv[1], sys.argv[2:]
try:
    import zxingcpp
except ImportError:
    print('  ! zxing-cpp missing: pip install zxing-cpp --break-system-packages')
    sys.exit(3)

ok = True
for arg in files:
    f, _, n = arg.rpartition(':') if arg.rsplit(':', 1)[-1].isdigit() else (arg, '', '1')
    want = int(n)
    im = Image.open(f).convert('RGB')
    small = im.resize((1100, round(im.height * 1100 / im.width)), Image.LANCZOS)
    for label, img in (('as rendered', im), ('1100 px wide', small)):
        found = [r.text for r in zxingcpp.read_barcodes(img)]
        good = len(found) == want and all(t == expected for t in found)
        ok &= good
        print(f'  {"OK " if good else "FAIL"} {f.split("/")[-1]:24s} {label:12s} {len(found)}/{want} code(s) -> {found[:1]!r}')
sys.exit(0 if ok else 1)
