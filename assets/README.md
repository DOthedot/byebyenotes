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
| `wall-storm.jpg` | [pin 9148005521163522](https://in.pinterest.com/pin/9148005521163522/) | Rembrandt, *Christ in the Storm on the Sea of Galilee*. |
| `wall-ruins.jpg` | [pin 14777505023608143](https://in.pinterest.com/pin/14777505023608143/) | Capriccio of classical ruins with an obelisk, Hubert Robert style. |
| `wall-knight.jpg` | [pin 58054282693877426](https://in.pinterest.com/pin/58054282693877426/) | Armoured knight resting in a meadow. Grainy source — q55, not q70. |
| `wall-apotheosis.jpg` | [pin 128352658135925084](https://in.pinterest.com/pin/128352658135925084/) | Baroque oval ceiling apotheosis. |
| `wall-barberini.jpg` | [pin 72550243989491600](https://in.pinterest.com/pin/72550243989491600/) | Pietro da Cortona, Barberini ceiling. |
| `wall-vortex.jpg` | [pin 93871973478393363](https://in.pinterest.com/pin/93871973478393363/) | Surreal baroque hall, winged figure in a cloud vortex. Likely AI-generated. |
| `wall-vishnu.jpg` | [pin 965670345127726267](https://in.pinterest.com/pin/965670345127726267/) | Venkateswara against deep blue, with an Om. Religious imagery. |
| `wall-valley.jpg` | [pin 797700152797705538](https://in.pinterest.com/pin/797700152797705538/) | Bright Ghibli-style alpine valley. The only light image in the set — the useful one for testing whether text stays legible over a background. |

All are downscaled to 900px tall, JPEG q70 (q55 where noted). Originals are kept locally in
`docs/assets/` (gitignored).

## ⚠️ Licensing — resolve before this reaches production

These were collected from Pinterest as **design references**. None is licensed for
redistribution, `wall-coronation.jpg` carries another account's watermark, and
`wall-trust.jpg` / `wall-vishnu.jpg` contain religious imagery.

**This is no longer hypothetical.** These files are on `main` and are served publicly
by the Railway deployment. The paintings themselves are old enough to be out of
copyright (Rembrandt, Cortona, Robert), but the *photographs and scans* of them are
generally not, and the modern pieces (`wall-knight`, `wall-vortex`) have identifiable
authorship regardless of how they were made. Nothing here has been cleared.

Options, least to most infrastructure:

1. **Ship only generated CSS art.** `terminal` and `starfield` in `WALLPAPERS` are
   pure CSS of ~200 bytes each — no rights question, no hosting, works offline.
   (The five colour-wash gradients that used to sit alongside them — dusk, aurora,
   sakura, ember, deep sea — were removed at the user's request.)
2. **Let the user supply an image URL.** Any picture they want, one text field.
   Breaks when the remote host does, and leaks a request to a third party.
3. **Upload through `/api/img`.** Closest to the intended look, but that endpoint is
   currently unauthenticated, unbounded and permanent — see the open review finding
   in `docs/issues/`.

## Gotcha

`WALLPAPERS` entries use `url('…')` with **single** quotes. The `/settings` swatch
grid interpolates that string into a `style="…"` attribute, so a double quote there
truncates the attribute and the preview renders blank.
