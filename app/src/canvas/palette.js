// Monochrome palette derived from the dominant hue of the background image,
// ported verbatim from devanture/sketch.js extractDominantHue + buildPalette.
// The opacity (%) of each colour is fixed; only the hue follows the image.
//
// Parameterized: extractDominantHue takes a p5.Image and returns the hue;
// buildPalette takes (p, hue) and RETURNS the colour object C (instead of
// writing a module global). buildPalette flips colorMode to HSB to build the
// colours, then MUST restore RGB before returning — every later p.fill/p.color
// in the slice depends on RGB mode.

// Per-pixel circular-mean dominant hue (degrees 0..360). 0 = fallback for a
// washed-out image. Uses Math.* and only img.loadPixels()/img.pixels so it is
// independent of any p5 instance.
export function extractDominantHue(img) {
  img.loadPixels();
  const step = Math.max(1, Math.floor(img.width / 20));
  let sinSum = 0, cosSum = 0, count = 0;
  for (let y = 0; y < img.height; y += step) {
    for (let x = 0; x < img.width; x += step) {
      const i = (y * img.width + x) * 4;
      const pr = img.pixels[i] / 255;
      const pg = img.pixels[i + 1] / 255;
      const pb = img.pixels[i + 2] / 255;
      const mx = Math.max(pr, pg, pb);
      const mn = Math.min(pr, pg, pb);
      const d = mx - mn;
      const sat = mx > 0 ? d / mx : 0;
      if (sat < 0.15 || mx < 0.10 || mx > 0.92) continue;
      let h = 0;
      if (d > 0) {
        if (mx === pr) h = ((pg - pb) / d + 6) % 6;
        else if (mx === pg) h = (pb - pr) / d + 2;
        else h = (pr - pg) / d + 4;
        h = h * 60;
      }
      sinSum += Math.sin(h * Math.PI / 180);
      cosSum += Math.cos(h * Math.PI / 180);
      count++;
    }
  }
  if (count === 0) return 0;
  return (Math.atan2(sinSum / count, cosSum / count) * 180 / Math.PI + 360) % 360;
}

export function buildPalette(p, dominantHue) {
  // Steer hues in the violet band (270-330) away to deep red/magenta to avoid
  // odd chromatic renders on some backgrounds.
  let h = dominantHue;
  if (h >= 270 && h <= 330) h = (h < 300) ? 260 : 340;
  p.colorMode(p.HSB, 360, 100, 100, 255);
  const C = {
    bg: p.color(h, 22, 96, 255),
    board: p.color(h, 52, 62, 153),
    // Triangles: single dark colour (B=18 < board B=62), translucent. The
    // even/odd alpha difference (160 vs 110, ~20%) distinguishes the points.
    triA: p.color(h, 50, 18, 160),
    triB: p.color(h, 50, 18, 110),
    bar: p.color(h, 42, 52, 153),
    ivory: p.color(h, 8, 97, 255),
    ruby: p.color(h, 45, 20, 255),    // black checker
    offwhite: p.color(h, 12, 92, 255),
    numColor: p.color(h, 90, 10, 255),
  };
  p.colorMode(p.RGB, 255, 255, 255, 255); // CRITICAL: restore RGB
  return C;
}
