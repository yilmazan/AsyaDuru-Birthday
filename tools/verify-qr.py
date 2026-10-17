#!/usr/bin/env python3
"""Decode a QR PNG at several sizes and check it equals the expected text.

usage: python3 verify-qr.py <qr.png> <expected-url>
Decoders: zxing-cpp (pip install zxing-cpp) and/or OpenCV (pip install opencv-python-headless).
Exit code 0 = every available decoder read the exact URL at every size.
"""
import sys

from PIL import Image, ImageFilter

png, expected = sys.argv[1], sys.argv[2]
src = Image.open(png).convert('RGB')

decoders = {}
try:
    import zxingcpp

    def dz(img):
        res = zxingcpp.read_barcodes(img)
        return res[0].text if res else None
    decoders['zxing-cpp'] = dz
except ImportError:
    pass
try:
    import cv2
    import numpy as np

    dets = [cv2.QRCodeDetector()]
    if hasattr(cv2, 'QRCodeDetectorAruco'):
        dets.append(cv2.QRCodeDetectorAruco())

    def dc(img):
        arr = cv2.cvtColor(np.array(img), cv2.COLOR_RGB2BGR)
        for det in dets:  # classic + aruco detector; either one reading it counts
            txt, _, _ = det.detectAndDecode(arr)
            if txt:
                return txt
        return None
    decoders['opencv'] = dc
except ImportError:
    pass

if not decoders:
    print('  ! no QR decoder installed: pip install zxing-cpp --break-system-packages')
    sys.exit(3)


def framed(img, size, pad=0.25, blur=0.0):
    """Resize, put on a pink 'card' background with margin (like a photo of the table card)."""
    im = img.resize((size, size), Image.LANCZOS)
    if blur:
        im = im.filter(ImageFilter.GaussianBlur(blur))
    m = int(size * pad)
    bg = Image.new('RGB', (size + 2 * m, size + 2 * m), (251, 228, 232))
    bg.paste(im, (m, m))
    return bg


cases = [
    ('full 2048 px', framed(src, src.width, 0.05)),
    ('300 px', framed(src, 300)),
    ('200 px', framed(src, 200)),
    ('150 px + blur', framed(src, 150, blur=0.6)),
]
ok = True
for label, img in cases:
    for name, fn in decoders.items():
        try:
            got = fn(img)
        except Exception as e:  # noqa: BLE001
            got = f'<error {e}>'
        good = got == expected
        ok &= good
        print(f'  {"OK " if good else "FAIL"} {name:9s} {label:14s} -> {got!r}')
sys.exit(0 if ok else 1)
