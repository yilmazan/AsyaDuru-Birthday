# Baskı araçları / Print tools

QR code, table cards, poster and the after-party photo book for Asya Duru's 4th birthday.
Everything renders from HTML with Chromium, so fonts (Pinyon Script, Yeseva One, Nunito, incl. Turkish
İ ı ş ğ ü ö ç) and colours match the web app.

## Setup (once)

```sh
cd tools
npm install
pip install zxing-cpp opencv-python-headless pypdf pillow --break-system-packages   # QR check, PDF boxes, sample images
```

Also needed: `pdftoppm` (poppler-utils) for PNG previews, `ffmpeg` only for the sample voice notes.
Chromium: uses `/opt/pw-browsers/...` here, otherwise a local Chrome/Chromium. Override with `CHROMIUM_PATH=/path/to/chrome`.
Google Fonts are fetched at render time, so render while online.

## 1. QR code + table cards (before the party)

```sh
node make-qr.mjs https://yilmazan.github.io/AsyaDuru-Birthday/ && node make-cards.mjs
```

Run the same two commands again whenever the site URL changes. Use the exact final URL, including case and trailing slash.

| Output | What it is |
| --- | --- |
| `print/qr.svg`, `print/qr.png` (2048 px) | Stylised QR, EC level H, crown on a plate covering ≤ 9 % of the symbol |
| `assets/img/qr.svg` | Same SVG, shown on the live wall |
| `print/table-card-A6.pdf` | **Print shop.** Table tent with two A6 faces (105×148 mm) on a 105×296 mm strip, 3 mm bleed, crop and fold marks, TrimBox/BleedBox set. Fold across the middle; the top face is printed upside down so both sides read upright. Use 250–300 g/m² card. |
| `print/table-card-A4-2up.pdf` | **Home printing.** Two tents on A4. Cut down the dashed middle line, then fold each strip across the middle. |
| `print/cards-A4-4up.pdf` | Four flat A6 cards on A4, with cut lines (for card holders or leaning on a glass) |
| `print/poster-A3.pdf` | A3 poster for the entrance or cake table, QR about 158 mm |
| `print/previews/*.png` | Previews rendered from the PDFs |

Scan checks run automatically:
- `make-qr` decodes `qr.png` at full size, 300 px, 200 px and 150 px with blur, using zxing-cpp and OpenCV. The decoded text must equal the URL exactly. If the styled code ever fails, it falls back to a plain QR without the crown and warns you.
- `make-cards` decodes every QR on every rendered sheet. It must find 2, 4, 4 and 1 codes respectively.

A non-zero exit code means "do not print".

Design notes:
- The finder squares are deliberately square-cornered. Rounded ones broke OpenCV at phone distance.
- The wax seal sits on the bottom-right corner, the only corner without a finder pattern. When it sat next to the top-right finder, zxing could not read the code.

Home printers usually leave a white border: print "borderless" if possible, or trim about 4 mm off the outer edges.

## 2. Photo book (after the party)

```sh
SUPABASE_OWNER_EMAIL=albüm-e-postan SUPABASE_OWNER_PASSWORD='…' node export.mjs
node make-book.mjs export/20261101-1030          # the folder export.mjs printed
```

**`export.mjs`**
- Signs in with the album.html account and downloads every **non-hidden** letter, oldest first, with all photos and voice notes, into `tools/export/<YYYYMMDD-HHMM>/` (`memories.json` plus `files/<id>/…`).
- To refresh or resume an existing export, pass that folder: `node export.mjs export/20261101-1030`. Files already downloaded are skipped.
- Letters hidden in the album are left out. Hide a letter in album.html, then re-export, to keep it out of the book.
- If it reports **zero letters**, the account is probably missing from `public.album_owners`: row-level security returns an empty list rather than an error.

**`make-book.mjs <exportDir>`** writes a 200×200 mm square book (pages 206×206 mm including 3 mm bleed; TrimBox/BleedBox set; text kept ≥ 10 mm inside the trim; page count padded to a multiple of 4):

| Output | What it is |
| --- | --- |
| `print/book/asya-duru-4-fotokitap.pdf` | The real book. **Private:** git-ignored, never publish it. |
| `print/book/previews-real/page-NN.png` | Previews of the real book |
| `<exportDir>/sesli-notlar/NN - Name.webm` | Voice notes, numbered by the **book page** the letter is on |

Voice notes cannot be printed. The book marks those letters with a small "Sesli not / Voice note" pill and the duration, and the audio files live in the export folder, both as originals under `files/` and renamed in `sesli-notlar/`. A nice keepsake option: put `sesli-notlar/` on a USB stick or in a private cloud folder with the book.

**Edit the dedication.** The family's words on page 2 (TR and EN), the place name and the time zone are constants at the top of `make-book.mjs`, marked `EDIT ME`.

How the layout works:
- **Order:** chronological.
- **Short letters without photos:** two share a page.
- **Photos:** become tilted polaroids, arranged by count and orientation.
- **Font size:** text is auto-sized from 16 pt (text only) or 12.5 pt (with photos) down to 11 pt.
- **Letters that won't fit one page comfortably:** get a spread, with photos on the left page and the letter facing them. A neighbouring single-page letter may swap one place so photos and words are never separated by a page turn.
- **Very long text:** continues on the next page.
- **Greetings:** "Sevgili Asya," / "Dear Asya," is printed unless the guest already greets Asya in their first words.
- **Padding:** spare pages become lined "Asya'ya notlar / Notes for Asya" pages for the family to write on.
- **Images:** embedded at full resolution, with no recompression.

Printing: ask the print shop for a 20×20 cm photo book, PDF with 3 mm bleed. Page 1 is the front cover and the last page is the back cover. The page count is always a multiple of 4.

## Sample book

```sh
python3 make-sample-export.py              # (re)creates sample-export/ (12 invented letters, pastel placeholder images)
node make-book.mjs sample-export           # → print/book/asya-duru-4-fotokitap-ornek-sample.pdf + print/book/previews/
```

The sample is clearly marked: "Örnek kitap / Sample book" on the cover, a note on the back cover, and a label on every image.

## Files

```
make-qr.mjs           QR → print/qr.svg|png|json, assets/img/qr.svg (+ decode check)
make-cards.mjs        tent / 4-up / poster PDFs + previews (+ scan check)
export.mjs            Supabase → export/<stamp>/
make-book.mjs         export → photo book PDF, previews, voice-note folder
make-sample-export.py sample-export/ generator
verify-qr.py          decoder check for a single QR image
verify-scan.py        decoder check for whole rendered pages
lib/                  shared Chromium helpers, crown/seal/name artwork, QR renderer
```
