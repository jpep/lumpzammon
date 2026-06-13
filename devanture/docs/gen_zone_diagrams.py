#!/usr/bin/env python3
"""Generate annotated SVG zone diagrams for the background advertising protocol.

The geometry mirrors devanture/sketch.js computeGeometry() + dice.js getDiePos():
  - board is 13a x 13a, centred in the viewport (bx, by)
  - landscape: dice column on the left at cx = bx - 2.75r, NAMES_W_A=6 side gutters
  - portrait:  dice above/below the board, top/bottom info bands

Output: two standalone SVGs (no external deps) showing the play-safe exclusion
zone, the UI keep-out clusters, the advertising-safe zones and the sponsor
button anchor. These are documentation aids, not runtime assets.
"""

# ---- palette -------------------------------------------------------------
C_BG      = "#11151c"   # canvas backdrop (stands in for the photo)
C_BOARD   = "#1f6f4a"   # play field
C_BOARD_E = "#2e9d6b"
C_EXCL    = "#e8c33a"   # exclusion outline (calm core / no brand content)
C_UI      = "#c0563b"   # UI keep-out blocks
C_AD      = "#3f7fd6"   # advertising-safe zone
C_BTN     = "#f4f4f0"   # sponsor button
C_TXT     = "#eef1f4"
C_DIM     = "#9aa4b0"


def rect(x, y, w, h, fill, stroke=None, sw=2, dash=None, opacity=1.0, rx=0):
    s = f'<rect x="{x:.1f}" y="{y:.1f}" width="{w:.1f}" height="{h:.1f}" '
    s += f'fill="{fill}" fill-opacity="{opacity}" '
    if stroke:
        s += f'stroke="{stroke}" stroke-width="{sw}" '
        if dash:
            s += f'stroke-dasharray="{dash}" '
    if rx:
        s += f'rx="{rx}" '
    return s + "/>"


def label(x, y, txt, size=15, fill=C_TXT, anchor="start", weight="normal"):
    return (f'<text x="{x:.1f}" y="{y:.1f}" font-family="Helvetica,Arial,sans-serif" '
            f'font-size="{size}" font-weight="{weight}" fill="{fill}" '
            f'text-anchor="{anchor}">{txt}</text>')


def legend(x, y, items):
    out = []
    dy = 0
    for col, txt in items:
        out.append(f'<rect x="{x}" y="{y+dy-11}" width="16" height="12" fill="{col}" rx="2"/>')
        out.append(label(x + 24, y + dy, txt, size=13, fill=C_DIM))
        dy += 22
    return "\n".join(out)


def build(vw, vh, orientation):
    parts = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {vw} {vh}" '
             f'width="{vw}" height="{vh}">']
    parts.append(rect(0, 0, vw, vh, C_BG))

    if orientation == "landscape":
        # a = min(vw/25, vh/15) (NAMES_W_A=6 -> totalA=25 ; totalH=15)
        a = min(vw / 25, vh / 15)
    else:
        a = min((vw - 16) / 13, vh / 22)
    r = a / 2
    bx = (vw - 13 * a) / 2
    by = (vh - 13 * a) / 2
    bw = 13 * a

    # ---- advertising-safe zones (drawn first, behind everything) ----------
    if orientation == "landscape":
        # left gutter outer + right gutter outer + thin top/bottom strips
        ad_zones = [
            (8, 8, bx - 16, by - 16, "ambient brand\n(left gutter)"),
            (bx + bw + 8, 8, vw - (bx + bw) - 16, by - 16, "ambient brand\n(right gutter)"),
        ]
    else:
        ad_zones = [
            (8, 8, vw - 16, by - 8 - 96, "TOP BANNER (best zone)"),
            (8, by + bw + 8 + 96, vw - 16, vh - (by + bw) - 16 - 96, "bottom banner"),
        ]
    for (x, y, w, h, _t) in ad_zones:
        if w > 0 and h > 0:
            parts.append(rect(x, y, w, h, C_AD, opacity=0.18, rx=6))
            parts.append(rect(x, y, w, h, "none", stroke=C_AD, sw=2, dash="7 5", rx=6))

    # ---- board (play field) ----------------------------------------------
    parts.append(rect(bx, by, bw, bw, C_BOARD, rx=4))
    # a few triangles for readability
    tri_w = a
    for i in range(13):
        xx = bx + i * a
        col = C_BOARD_E if i % 2 == 0 else C_BOARD
        parts.append(f'<polygon points="{xx:.1f},{by:.1f} {xx+tri_w:.1f},{by:.1f} '
                     f'{xx+tri_w/2:.1f},{by+bw*0.38:.1f}" fill="{col}" fill-opacity="0.5"/>')
        parts.append(f'<polygon points="{xx:.1f},{by+bw:.1f} {xx+tri_w:.1f},{by+bw:.1f} '
                     f'{xx+tri_w/2:.1f},{by+bw*0.62:.1f}" fill="{col}" fill-opacity="0.5"/>')
    parts.append(label(bx + bw / 2, by + bw / 2, "BOARD", size=22, fill=C_TXT,
                       anchor="middle", weight="bold"))
    parts.append(label(bx + bw / 2, by + bw / 2 + 22, "(checkers · dice · pip · timers)",
                       size=12, fill="#cfe9da", anchor="middle"))

    # ---- UI keep-out clusters --------------------------------------------
    ds = 3.5 * r
    if orientation == "landscape":
        # dice column on the LEFT (mirror mode can place it on the right too)
        cx = bx - 2.75 * r
        parts.append(rect(cx - ds / 2, by, ds, bw, C_UI, opacity=0.5, rx=4))
        parts.append(rect(cx - ds / 2, by, ds, bw, "none", stroke=C_UI, sw=2, rx=4))
        parts.append(label(cx, by + bw / 2, "DICE", size=12, fill=C_TXT, anchor="middle"))
        # mirror image of the dice column (mirror mode)
        mcx = vw - cx
        parts.append(rect(mcx - ds / 2, by, ds, bw, C_UI, opacity=0.18, rx=4))
        parts.append(rect(mcx - ds / 2, by, ds, bw, "none", stroke=C_UI, sw=1.5,
                          dash="4 4", rx=4))
        parts.append(label(mcx, by + bw + 16, "dice (mirror)", size=10, fill=C_DIM,
                           anchor="middle"))
        # flag / exit / cube stack, left external margin ~2r from edge
        parts.append(rect(2 * r - 8, by + bw * 0.3, 1.8 * r, 3 * 3 * r, C_UI, opacity=0.5, rx=4))
        parts.append(label(2 * r - 8 + 0.9 * r, by + bw * 0.3 - 8, "flag", size=10,
                           fill=C_DIM, anchor="middle"))
        parts.append(label(2 * r - 8 + 0.9 * r, by + bw * 0.3 + 3 * 3 * r + 14, "exit/cube",
                           size=10, fill=C_DIM, anchor="middle"))
        # right info column (player names / scores, NAMES_W_A reserve)
        parts.append(rect(bx + bw + 6, by + bw * 0.36, vw - (bx + bw) - 12, bw * 0.28,
                          C_UI, opacity=0.32, rx=4))
        parts.append(label(bx + bw + (vw - (bx + bw)) / 2, by + bw * 0.5,
                           "names / scores", size=11, fill=C_TXT, anchor="middle"))
    else:
        # dice top + bottom, name blocks beside them
        x_dice = bx
        w_dice = 2 * ds + 0.5 * r
        y_black = by - ds - 1.6 * r
        y_white = by + bw + 1.6 * r
        for (yy, who) in [(y_black, "DICE (black)"), (y_white, "DICE (white)")]:
            parts.append(rect(x_dice, yy, w_dice, ds, C_UI, opacity=0.5, rx=4))
            parts.append(label(x_dice + w_dice / 2, yy + ds / 2 + 4, who, size=11,
                               fill=C_TXT, anchor="middle"))
        # name/score blocks beside dice
        for yy in [y_black, y_white]:
            parts.append(rect(x_dice + w_dice + 6, yy, bw - w_dice - 12, ds,
                              C_UI, opacity=0.3, rx=4))
            parts.append(label(x_dice + w_dice + 6 + (bw - w_dice) / 2, yy + ds / 2 + 4,
                               "name / pip / score", size=11, fill=C_TXT, anchor="middle"))
        # top-right flag/cube corner
        parts.append(rect(bx + bw - 1.8 * r, r, 1.8 * r, 5.7 * r, C_UI, opacity=0.5, rx=4))
        parts.append(label(bx + bw - 0.9 * r, r - 6, "flag/cube", size=10, fill=C_DIM,
                           anchor="middle"))

    # ---- exclusion zone (calm core, no brand/CTA content) -----------------
    if orientation == "landscape":
        ex_x = (bx - 2.75 * r) - ds / 2 - 6
        ex_w = (vw - ex_x * 2)  # symmetric (mirror safe)
        ex_y = by - 6
        ex_h = bw + 12
    else:
        ex_x = bx - 6
        ex_w = bw + 12
        ex_y = (by - ds - 1.6 * r) - 6
        ex_h = (by + bw + 1.6 * r + ds) - ex_y + 6
    parts.append(rect(ex_x, ex_y, ex_w, ex_h, "none", stroke=C_EXCL, sw=3, dash="2 6", rx=8))
    parts.append(label(ex_x + ex_w / 2, ex_y - 8,
                       "EXCLUSION ZONE — keep image calm, no faces / text / logos / CTA",
                       size=12, fill=C_EXCL, anchor="middle"))

    # ---- sponsor button anchor -------------------------------------------
    if orientation == "landscape":
        bxn, byn, bwn, bhn = vw - 8 - 150, vh - 8 - 30, 150, 30
    else:
        bxn, byn, bwn, bhn = 12, 12, 150, 30
    parts.append(rect(bxn, byn, bwn, bhn, C_BTN, opacity=0.85, rx=15))
    parts.append(label(bxn + bwn / 2, byn + bhn / 2 + 4, "◆ visit sponsor", size=13,
                       fill="#11151c", anchor="middle", weight="bold"))

    # ---- title + legend ---------------------------------------------------
    parts.append(label(14, 26, f"Lumpzammon — background ad zones · {orientation.upper()} "
                               f"({vw}×{vh}, a={a:.0f}px)", size=15, fill=C_TXT,
                       weight="bold"))
    leg_x = vw - 215
    leg_y = vh - 132 if orientation == "landscape" else vh - 150
    parts.append(rect(leg_x - 10, leg_y - 24, 210, 122, "#0c0f14", opacity=0.7, rx=6))
    parts.append(legend(leg_x, leg_y, [
        (C_BOARD, "Board / play field"),
        (C_EXCL, "Exclusion (calm) zone"),
        (C_UI, "UI keep-out clusters"),
        (C_AD, "Advertising-safe zone"),
        (C_BTN, "Sponsor button (app-drawn)"),
    ]))

    parts.append("</svg>")
    return "\n".join(parts)


if __name__ == "__main__":
    import os
    here = os.path.dirname(os.path.abspath(__file__))
    with open(os.path.join(here, "zones_landscape.svg"), "w") as f:
        f.write(build(1280, 720, "landscape"))
    with open(os.path.join(here, "zones_portrait.svg"), "w") as f:
        f.write(build(720, 1280, "portrait"))
    print("wrote zones_landscape.svg and zones_portrait.svg")
