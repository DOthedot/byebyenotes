# assets/ — sidebar wallpapers

Images offered by the `/settings → background` picker. Referenced from `WALLPAPERS`
in `app.js` by **absolute** path (`/assets/…`) so they also resolve on `/s/<id>`
tiny links — the same reason `index.html` loads its assets absolutely (issue #17).

| File | Source | Notes |
|------|--------|-------|
| `wall-glory.jpg` | [pin 849561917249296901](https://in.pinterest.com/pin/849561917249296901/) | Doré-style engraving, "GLORY". |
| `wall-coronation.jpg` | [pin 812055376594979509](https://in.pinterest.com/pin/812055376594979509/) | Baroque coronation scene. Visible `@amantefilosofico` TikTok watermark. |
| `wall-seraph.jpg` | [pin 1106548570970868557](https://in.pinterest.com/pin/1106548570970868557/) | Winged figure with a sword against a lit halo ring. |
| `wall-atlas.jpg` | [pin 1004302785630082731](https://in.pinterest.com/pin/1004302785630082731/) | Line-art figure lifting a sphere over a golden-ratio construction. |
| `wall-trust.jpg` | [pin 828099450280656655](https://in.pinterest.com/pin/828099450280656655/) | Vishnu on a lotus before mountains, overlaid "TRUST." |

All are downscaled to 900px tall, JPEG q70. Originals are kept locally in
`docs/assets/` (gitignored).

## ⚠️ Licensing — resolve before this reaches production

These were collected from Pinterest as **design references**. None is licensed for
redistribution, `wall-coronation.jpg` carries another account's watermark, and
`wall-trust.jpg` contains religious imagery. Merging this directory to `main` means
Vercel serves them publicly from `byebyenotes.vercel.app`.

Options, least to most infrastructure:

1. **Ship only generated CSS art.** The other eight presets in `WALLPAPERS` are
   gradients of ~200 bytes each — no rights question, no hosting, works offline.
2. **Let the user supply an image URL.** Any picture they want, one text field.
   Breaks when the remote host does, and leaks a request to a third party.
3. **Upload through `/api/img`.** Closest to the intended look, but that endpoint is
   currently unauthenticated, unbounded and permanent — see the open review finding
   in `docs/issues/`.

## Gotcha

`WALLPAPERS` entries use `url('…')` with **single** quotes. The `/settings` swatch
grid interpolates that string into a `style="…"` attribute, so a double quote there
truncates the attribute and the preview renders blank.
