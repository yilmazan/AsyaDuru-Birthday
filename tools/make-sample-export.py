#!/usr/bin/env python3
"""Builds tools/sample-export/: a realistic SAMPLE export (12 letters) with pastel placeholder
illustrations, so `node make-book.mjs sample-export` renders a full sample photo book.

All content is invented sample content. Images carry an "Örnek fotoğraf / Sample photo" label.
usage: python3 make-sample-export.py        (needs Pillow; ffmpeg optional for the voice notes)
"""
import json
import math
import random
import shutil
import subprocess
from datetime import datetime, timedelta, timezone
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

OUT = Path(__file__).resolve().parent / 'sample-export'
FONT = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'

PAL = {
    'petal': (251, 228, 232), 'petal_deep': (245, 204, 214), 'lilac': (220, 203, 240), 'lilac_deep': (155, 127, 196),
    'wax': (184, 50, 95), 'wax_glow': (231, 121, 156), 'gold': (201, 161, 59), 'gold_light': (240, 216, 142),
    'mint': (190, 228, 210), 'sky': (214, 232, 247), 'cream': (255, 250, 247), 'ink': (94, 24, 56), 'peach': (252, 214, 190),
}
SS = 2  # supersampling


def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))


def gradient(w, h, top, bottom):
    im = Image.new('RGB', (w, h))
    d = ImageDraw.Draw(im)
    for y in range(h):
        d.line([(0, y), (w, y)], fill=lerp(top, bottom, y / max(1, h - 1)))
    return im


def confetti(d, w, h, rnd, n=90):
    cols = [PAL['wax_glow'], PAL['gold'], PAL['lilac_deep'], PAL['mint'], PAL['gold_light']]
    for _ in range(n):
        x, y, s = rnd.uniform(0, w), rnd.uniform(0, h), rnd.uniform(6, 16) * SS
        c = rnd.choice(cols)
        if rnd.random() < .5:
            d.ellipse([x, y, x + s, y + s], fill=c)
        else:
            a = rnd.uniform(0, math.pi)
            pts = [(x + math.cos(a + k * math.pi / 2) * s, y + math.sin(a + k * math.pi / 2) * s * .45) for k in range(4)]
            d.polygon(pts, fill=c)


def balloon(d, cx, cy, r, col, rnd):
    d.line([(cx, cy + r * 1.15), (cx + rnd.uniform(-1, 1) * r * .6, cy + r * 3.4)], fill=(150, 120, 140), width=3 * SS)
    d.ellipse([cx - r, cy - r * 1.18, cx + r, cy + r * 1.12], fill=col)
    d.polygon([(cx - r * .12, cy + r * 1.22), (cx + r * .12, cy + r * 1.22), (cx, cy + r * 1.08)], fill=col)
    hl = lerp(col, (255, 255, 255), .55)
    d.ellipse([cx - r * .55, cy - r * .8, cx - r * .2, cy - r * .3], fill=hl)


def crown(d, cx, cy, s, jewel=PAL['wax']):
    g, gd = PAL['gold'], (150, 113, 30)
    pts = [(cx - s, cy + s * .5), (cx - s * 1.1, cy - s * .55), (cx - s * .5, cy - s * .05), (cx, cy - s * .85),
           (cx + s * .5, cy - s * .05), (cx + s * 1.1, cy - s * .55), (cx + s, cy + s * .5)]
    d.polygon(pts, fill=g, outline=gd, width=3 * SS)
    d.rounded_rectangle([cx - s * 1.05, cy + s * .45, cx + s * 1.05, cy + s * .8], radius=s * .1, fill=PAL['gold_light'], outline=gd, width=3 * SS)
    for x in (cx - s * 1.1, cx, cx + s * 1.1):
        y = cy - s * .85 if x == cx else cy - s * .55
        d.ellipse([x - s * .12, y - s * .12, x + s * .12, y + s * .12], fill=PAL['gold_light'], outline=gd, width=2 * SS)
    for x, c in ((cx - s * .5, PAL['lilac_deep']), (cx, jewel), (cx + s * .5, PAL['lilac_deep'])):
        d.ellipse([x - s * .09, cy + s * .54, x + s * .09, cy + s * .72], fill=c)


def cake(d, cx, base, w, rnd):
    tiers = [(w, w * .32, PAL['petal_deep']), (w * .74, w * .28, PAL['cream']), (w * .5, w * .24, PAL['lilac'])]
    y = base
    d.ellipse([cx - w * .75, base - w * .08, cx + w * .75, base + w * .1], fill=(236, 236, 240))
    for tw, th, col in tiers:
        d.rounded_rectangle([cx - tw / 2, y - th, cx + tw / 2, y], radius=th * .18, fill=col)
        for i in range(9):  # frosting drips
            x = cx - tw / 2 + (i + .5) * tw / 9
            d.ellipse([x - tw / 22, y - th - tw / 40, x + tw / 22, y - th + rnd.uniform(.25, .45) * th], fill=(255, 255, 255))
        d.rectangle([cx - tw / 2, y - th - 4, cx + tw / 2, y - th + th * .14], fill=(255, 255, 255))
        y -= th
    # a big "4" candle
    font = ImageFont.truetype(FONT, int(w * .3))
    d.text((cx, y - w * .02), '4', font=font, fill=PAL['wax_glow'], anchor='ms', stroke_width=3 * SS, stroke_fill=PAL['wax'])
    fy = y - w * .3
    d.ellipse([cx - w * .03, fy - w * .08, cx + w * .03, fy], fill=(255, 196, 80))


def castle(d, w, h):
    base, col, roof = h * .82, (238, 222, 245), PAL['wax_glow']
    for (x0, x1, top) in ((.18, .32, .42), (.68, .82, .42), (.36, .64, .3)):
        d.rectangle([w * x0, h * top, w * x1, base], fill=col)
        d.polygon([(w * (x0 - .02), h * top), (w * (x0 + x1) / 2, h * (top - .17)), (w * (x1 + .02), h * top)], fill=roof)
    d.rectangle([w * .26, h * .55, w * .74, base], fill=col)
    d.rounded_rectangle([w * .45, h * .64, w * .55, base], radius=w * .05, fill=PAL['lilac_deep'])
    for x in (.25, .75, .5):
        d.ellipse([w * x - w * .015, h * .5, w * x + w * .015, h * .55], fill=PAL['gold'])


def stars(d, w, h, rnd, n=40):
    for _ in range(n):
        x, y, r = rnd.uniform(0, w), rnd.uniform(0, h * .7), rnd.uniform(4, 12) * SS
        pts = []
        for k in range(10):
            a = k * math.pi / 5 - math.pi / 2
            rr = r if k % 2 == 0 else r * .45
            pts.append((x + math.cos(a) * rr, y + math.sin(a) * rr))
        d.polygon(pts, fill=PAL['gold_light'])


def label(im):
    d = ImageDraw.Draw(im)
    f = ImageFont.truetype(FONT, max(14, im.width // 60))
    txt = 'Örnek fotoğraf / Sample photo'
    x, y = im.width * .03, im.height * .965
    d.text((x, y), txt, font=f, fill=(255, 255, 255), anchor='ls', stroke_width=2, stroke_fill=(150, 110, 130))


def scene(kind, w, h, seed):
    rnd = random.Random(seed)
    W, H = w * SS, h * SS
    if kind == 'balloons':
        im = gradient(W, H, PAL['sky'], PAL['petal']); d = ImageDraw.Draw(im)
        confetti(d, W, H, rnd, 40)
        cols = [PAL['wax_glow'], PAL['lilac_deep'], PAL['gold'], PAL['mint'], PAL['wax']]
        for i in range(rnd.randint(4, 6)):
            balloon(d, rnd.uniform(.15, .85) * W, rnd.uniform(.2, .55) * H, rnd.uniform(.08, .13) * min(W, H) * 1.3, rnd.choice(cols), rnd)
    elif kind == 'cake':
        im = gradient(W, H, PAL['petal'], PAL['peach']); d = ImageDraw.Draw(im)
        confetti(d, W, H * .5, rnd, 60)
        d.rectangle([0, H * .78, W, H], fill=(246, 222, 228))
        cake(d, W / 2, H * .8, min(W, H) * .55, rnd)
    elif kind == 'crown':
        im = gradient(W, H, PAL['lilac'], PAL['petal']); d = ImageDraw.Draw(im)
        stars(d, W, H, rnd, 50)
        crown(d, W / 2, H * .52, min(W, H) * .26)
    elif kind == 'castle':
        im = gradient(W, H, (63, 35, 82), (231, 160, 190)); d = ImageDraw.Draw(im)
        stars(d, W, H, rnd, 70)
        d.ellipse([W * .72, H * .08, W * .84, H * .08 + W * .12], fill=PAL['gold_light'])
        castle(d, W, H)
        d.rectangle([0, H * .82, W, H], fill=(150, 110, 160))
    elif kind == 'garden':
        im = gradient(W, H, PAL['sky'], PAL['mint']); d = ImageDraw.Draw(im)
        for _ in range(60):
            x, y, r = rnd.uniform(0, W), rnd.uniform(H * .55, H), rnd.uniform(10, 26) * SS
            c = rnd.choice([PAL['wax_glow'], PAL['lilac_deep'], PAL['gold_light'], (255, 255, 255)])
            for k in range(5):
                a = k * 2 * math.pi / 5
                d.ellipse([x + math.cos(a) * r * .6 - r * .45, y + math.sin(a) * r * .6 - r * .45,
                           x + math.cos(a) * r * .6 + r * .45, y + math.sin(a) * r * .6 + r * .45], fill=c)
            d.ellipse([x - r * .3, y - r * .3, x + r * .3, y + r * .3], fill=PAL['gold'])
        balloon(d, W * .7, H * .3, min(W, H) * .1, PAL['wax_glow'], rnd)
    else:  # 'four'
        im = gradient(W, H, PAL['petal'], PAL['lilac']); d = ImageDraw.Draw(im)
        confetti(d, W, H, rnd, 120)
        f = ImageFont.truetype(FONT, int(min(W, H) * .55))
        d.text((W / 2, H * .55), '4', font=f, fill=PAL['gold'], anchor='mm', stroke_width=6 * SS, stroke_fill=(150, 113, 30))
    im = im.filter(ImageFilter.GaussianBlur(.6)).resize((w, h), Image.LANCZOS)
    label(im)
    return im


P, L, Q, WIDE = (1200, 1600), (1600, 1200), (1400, 1400), (1600, 900)

LETTERS = [
    dict(lang='tr', name='Elif Teyze', t='15:12',
         wish='Bugün dört yaşına girdin ve bütün salonu kahkahalarınla doldurdun. Dilerim hep böyle meraklı, böyle cesur ve böyle neşeli kalırsın. Seni çok seviyoruz, minik prenses!',
         memory='Geçen yaz bahçede kelebek kovaladığımız günü hiç unutmayacağım. Bir tanesi parmağına konmuştu, nefesini tutup bana bakmıştın.',
         photos=[('balloons', P), ('garden', L)]),
    dict(lang='en', name='Aunt Sarah', t='15:20',
         wish='Happy 4th birthday, sweet Asya! May every year bring you as much sparkle as this party did today.',
         memory='', photos=[('cake', L)]),
    dict(lang='tr', name='Mert, Zeynep ve Can', t='15:41',
         wish='Sevgili Asya, dört yaşın sana bol oyun, bol masal ve bol sarılma getirsin. Büyüdüğünde bu mektubu okurken bugünkü pastanın tadını hatırlamanı isteriz!',
         memory='Can, senin tacını takmak için sıraya girdi. Sonunda ikiniz birden prenses oldunuz.',
         photos=[('crown', P), ('four', Q), ('cake', L)], audio=23),
    dict(lang='en', name=None, t='15:58',
         wish='Dear Asya, keep dancing like nobody is watching. Happy birthday!', memory='', photos=[]),
    dict(lang='tr', name=None, t='16:03',
         wish='İyi ki doğdun Asya! Gülüşün hiç eksik olmasın.', memory='', photos=[]),
    dict(lang='tr', name='Babaanne Nur', t='16:17',
         wish=('Canım torunum Asya Duru, sen doğduğun gün hastanenin penceresinden sabah güneşi giriyordu ve ben o an '
               'hayatımın en güzel sabahını yaşadığımı düşündüm. Şimdi dört yaşındasın; konuşuyorsun, şarkı söylüyorsun, '
               'bana masallar anlatıyorsun. Senin için dileğim çok basit ama çok büyük: Kalbin hep bu kadar sıcak, '
               'merakın hep bu kadar canlı olsun. Okula başladığında, ilk arkadaşlarını edindiğinde, ilk kez bisiklete '
               'bindiğinde, düştüğünde ve kalktığında biz hep yanında olacağız. Dünyayı tanırken acele etme; çiçekleri '
               'kokla, bulutlara isim ver, sorularını hiç bırakma. Sana öğrettiğim o küçük ninniyi büyüyünce kendi '
               'çocuklarına da söylersen, ben hep orada, sesinin içinde olacağım. Annenle babanın gözlerindeki ışığı her '
               'gördüğümde, bu aileye ne kadar büyük bir mutluluk getirdiğini bir kez daha anlıyorum. Bu sayfayı her '
               'açtığında bizi hatırla. Seni dünyalar kadar seviyorum. '
               'Doğum günün kutlu olsun, prensesim; nice mutlu, sağlıklı ve sevgi dolu yıllara.'),
         memory='Her pazar sabahı birlikte yaptığımız pankekler: sen unu, ben sabrı getiriyorum.',
         photos=[('garden', P)]),
    dict(lang='en', name='The Al Mansoori family', t='16:30', wish='', memory='',
         photos=[('castle', L), ('balloons', P), ('crown', Q)]),
    dict(lang='tr', name='Selin ve Arda', t='16:52',
         wish='Asya’cım, dört yaşın kutlu olsun! Sana sesimizle de bir şarkı bıraktık, büyüyünce dinlersin.',
         memory='', photos=[('four', P)], audio=41),
    dict(lang='en', name='Grandpa Mike', t='17:05',
         wish='To my favourite little explorer: four is a wonderful age for big questions. Never stop asking them.',
         memory=('Last spring you insisted on carrying the watering can all by yourself, the whole way round the garden. '
                 'It was nearly as big as you, and you did not spill a single drop on the tulips. You told me the flowers were thirsty, '
                 'and that a princess has to look after her kingdom.'),
         photos=[('garden', P), ('crown', P)]),
    dict(lang='tr', name='Ayşe Öğretmen', t='17:26',
         wish=('Sevgili Asya, sınıfımızın en güleç yüzü sensin. İlk günü hatırlıyor musun? Çantanı sıkıca tutmuş, '
               'kapıda biraz çekingen durmuştun. Şimdi ise her sabah koşarak gelip bize günaydın diyorsun. Dört yaşında '
               'öğrenmeye, oynamaya ve paylaşmaya devam et. Işığın hiç sönmesin!'),
         memory='', photos=[]),
    dict(lang='en', name='Leo (age 6)', t='17:44',
         wish='Happy birthday Asya! You can have my blue crayon 🖍️💙', memory='', photos=[('balloons', WIDE)]),
    dict(lang='tr', name='Kuzen İpek', t='18:10',
         wish='Asya, iyi ki varsın! Bir sonraki doğum gününde de seninle dans etmek için sabırsızlanıyorum.',
         memory='Yılbaşında üç saat boyunca saklambaç oynamıştık; her seferinde aynı perdenin arkasına saklanıyordun ve hep çok şaşırıyordun.',
         photos=[('castle', L), ('cake', L)]),
]


def main():
    if OUT.exists():
        shutil.rmtree(OUT)
    (OUT / 'files').mkdir(parents=True)
    rnd = random.Random(2026)
    memories = []
    has_ffmpeg = shutil.which('ffmpeg') is not None
    for i, L_ in enumerate(LETTERS):
        mid = '%08x-%04x-4%03x-a%03x-%012x' % (rnd.getrandbits(32), rnd.getrandbits(16), rnd.getrandbits(12), rnd.getrandbits(12), rnd.getrandbits(48))
        hh, mm = map(int, L_['t'].split(':'))
        local = datetime(2026, 10, 31, hh, mm, rnd.randint(0, 59), tzinfo=timezone(timedelta(hours=4)))
        folder = OUT / 'files' / mid
        if L_['photos'] or L_.get('audio'):
            folder.mkdir()
        photos, paths = [], []
        for k, (kind, size) in enumerate(L_['photos'], 1):
            im = scene(kind, *size, seed=i * 10 + k)
            fn = folder / f'photo-{k}.jpg'
            im.save(fn, 'JPEG', quality=86)
            photos.append(f'files/{mid}/photo-{k}.jpg')
            paths.append(f'{mid}/photo-{k}.jpg')
        audio_rel, audio_path, secs = None, None, L_.get('audio')
        if secs:
            fn = folder / 'audio.webm'
            if has_ffmpeg:
                # a gentle two-note chime loop as a stand-in for a recorded voice note
                subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'lavfi', '-i',
                                f'sine=frequency=523:duration={secs}', '-f', 'lavfi', '-i', f'sine=frequency=659:duration={secs}',
                                '-filter_complex', 'amix=inputs=2,volume=0.25', '-c:a', 'libopus', '-b:a', '16k', str(fn)], check=True)
            else:
                fn.write_bytes(b'')
            audio_rel, audio_path = f'files/{mid}/audio.webm', f'{mid}/audio.webm'
        memories.append(dict(
            id=mid, created_at=local.astimezone(timezone.utc).isoformat().replace('+00:00', 'Z'), lang=L_['lang'],
            guest_name=L_['name'], wish=L_['wish'], memory=L_['memory'], photo_paths=paths,
            audio_path=audio_path, audio_seconds=secs, favorite=False, hidden=False,
            files=dict(photos=photos, audio=audio_rel)))
    data = dict(source='sample', sample=True, note='SAMPLE CONTENT: invented letters and placeholder illustrations for previewing the photo book.',
                exported_at=datetime.now(timezone.utc).isoformat(), count=len(memories), memories=memories)
    (OUT / 'memories.json').write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(f'Wrote {len(memories)} sample letters to {OUT}')


if __name__ == '__main__':
    main()
