from __future__ import annotations

import html
import json
import math
import shutil
import sys
import traceback
import zipfile
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable, Sequence

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont


BRAND_NAME = "MAMA'S GARDEN"
TAGLINE = "NATURALEZA • CALIDAD • FUTURO"
CANVAS_SIZE = 1600
EXPORT_SIZE = 3000
OUTPUT_NAMES = (
    "logo_vector.svg",
    "logo_transparent.png",
    "logo_monochrome.png",
    "Brand_Manual.pdf",
)


@dataclass(frozen=True)
class BrandColor:
    rgb: tuple[int, int, int]
    hex: str
    cmyk: tuple[int, int, int, int]
    share: float

    def as_dict(self) -> dict[str, object]:
        return {
            "HEX": self.hex,
            "RGB": list(self.rgb),
            "CMYK_approx": list(self.cmyk),
            "share_percent": round(self.share * 100, 2),
        }


def rgb_to_hex(rgb: Sequence[int]) -> str:
    return "#" + "".join(f"{int(channel):02X}" for channel in rgb)


def rgb_to_cmyk(rgb: Sequence[int]) -> tuple[int, int, int, int]:
    r, g, b = (channel / 255.0 for channel in rgb)
    k = 1.0 - max(r, g, b)
    if math.isclose(k, 1.0):
        return 0, 0, 0, 100
    c = (1.0 - r - k) / (1.0 - k)
    m = (1.0 - g - k) / (1.0 - k)
    y = (1.0 - b - k) / (1.0 - k)
    return tuple(int(round(value * 100)) for value in (c, m, y, k))


def foreground_mask(rgb_array: np.ndarray) -> np.ndarray:
    """Remove near-neutral white/cream pixels while preserving colored artwork."""
    pixels = rgb_array.astype(np.int16)
    channel_max = pixels.max(axis=2)
    channel_min = pixels.min(axis=2)
    chroma = channel_max - channel_min
    luminance = pixels.mean(axis=2)
    warm_cream = (
        (pixels[:, :, 0] > 210)
        & (pixels[:, :, 1] > 204)
        & (pixels[:, :, 2] > 190)
        & (chroma < 48)
    )
    pale_neutral = (luminance > 184) & (chroma < 46)
    scan_border_black = channel_max < 16
    return ~(warm_cream | pale_neutral | scan_border_black)


def extract_palette(image: Image.Image, color_count: int = 4) -> list[BrandColor]:
    try:
        from sklearn.cluster import KMeans

        rgb = np.asarray(image.convert("RGB"))
        mask = foreground_mask(rgb)
        # Ignore the JPEG's outer scan/crop boundary, which is not part of the mark.
        edge = max(4, min(rgb.shape[:2]) // 120)
        mask[:edge, :] = False
        mask[-edge:, :] = False
        mask[:, :edge] = False
        mask[:, -edge:] = False
        samples = rgb[mask]
        if samples.shape[0] < color_count:
            raise ValueError("No hay suficientes píxeles de primer plano para K-Means.")

        # Deterministic, evenly distributed sample for a fast but stable fit.
        if samples.shape[0] > 180_000:
            rng = np.random.default_rng(42)
            samples = samples[rng.choice(samples.shape[0], 180_000, replace=False)]

        model = KMeans(n_clusters=color_count, random_state=42, n_init=12)
        labels = model.fit_predict(samples)
        centers = np.clip(np.rint(model.cluster_centers_), 0, 255).astype(np.uint8)
        counts = np.bincount(labels, minlength=color_count)
        order = np.argsort(counts)[::-1]

        palette: list[BrandColor] = []
        for index in order:
            rgb_value = tuple(int(value) for value in centers[index])
            palette.append(
                BrandColor(
                    rgb=rgb_value,
                    hex=rgb_to_hex(rgb_value),
                    cmyk=rgb_to_cmyk(rgb_value),
                    share=float(counts[index] / counts.sum()),
                )
            )
        return palette
    except Exception as exc:
        raise RuntimeError(f"Falló la extracción de paleta por K-Means: {exc}") from exc


def _nearest_palette_labels(rgb_array: np.ndarray, palette: Sequence[BrandColor]) -> np.ndarray:
    flat = rgb_array.reshape(-1, 3).astype(np.int16)
    centers = np.array([color.rgb for color in palette], dtype=np.int16)
    distances = ((flat[:, None, :] - centers[None, :, :]) ** 2).sum(axis=2)
    return distances.argmin(axis=1).reshape(rgb_array.shape[:2])


def _path_from_points(points: np.ndarray) -> str:
    if points.shape[0] < 3:
        return ""
    coords = [f"{points[0, 1]:.2f},{points[0, 0]:.2f}"]
    coords.extend(f"{point[1]:.2f},{point[0]:.2f}" for point in points[1:])
    return "M " + " L ".join(coords) + " Z"


def _polygon_area(points: np.ndarray) -> float:
    x = points[:, 1]
    y = points[:, 0]
    return abs(float(np.dot(x, np.roll(y, 1)) - np.dot(y, np.roll(x, 1)))) / 2.0


def trace_mask_to_paths(mask: np.ndarray, minimum_area: float = 14.0) -> list[str]:
    """Trace a binary mask; prefer OpenCV, then fall back to Pillow + skimage."""
    try:
        import cv2  # type: ignore

        binary = (mask.astype(np.uint8) * 255)
        contours, _ = cv2.findContours(binary, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_SIMPLE)
        paths: list[str] = []
        for contour in contours:
            if abs(cv2.contourArea(contour)) < minimum_area:
                continue
            approximation = cv2.approxPolyDP(contour, 1.2, True)
            points = approximation[:, 0, :]
            if len(points) >= 3:
                commands = [f"M {points[0, 0]:.2f},{points[0, 1]:.2f}"]
                commands.extend(f"L {x:.2f},{y:.2f}" for x, y in points[1:])
                paths.append(" ".join(commands) + " Z")
        return paths
    except Exception:
        # Native image cleanup keeps the fallback independent of cv2.
        from skimage import measure

        cleaned = Image.fromarray(mask.astype(np.uint8) * 255, mode="L")
        cleaned = cleaned.filter(ImageFilter.MedianFilter(size=3))
        binary = np.asarray(cleaned) > 127
        contours = measure.find_contours(binary.astype(np.uint8), level=0.5)
        paths = []
        for contour in contours:
            if _polygon_area(contour) < minimum_area:
                continue
            simplified = measure.approximate_polygon(contour, tolerance=1.15)
            path = _path_from_points(simplified)
            if path:
                paths.append(path)
        return paths


def vectorize_isotype(image: Image.Image, palette: Sequence[BrandColor]) -> tuple[list[list[str]], int, int]:
    rgb = np.asarray(image.convert("RGB"))
    crop_height = rgb.shape[0] // 2
    upper = rgb[:crop_height, :, :]
    foreground = foreground_mask(upper)
    # The source wordmark begins a few pixels before the mathematical midpoint.
    # Remove that narrow overlap so only the botanical isotype is traced.
    foreground[max(0, crop_height - 36) :, :] = False
    labels = _nearest_palette_labels(upper, palette)

    traced: list[list[str]] = []
    for color_index in range(len(palette)):
        color_mask = foreground & (labels == color_index)
        traced.append(trace_mask_to_paths(color_mask))
    return traced, upper.shape[1], upper.shape[0]


def build_svg(
    output_path: Path,
    paths_by_color: Sequence[Sequence[str]],
    palette: Sequence[BrandColor],
    source_width: int,
    source_height: int,
) -> None:
    try:
        icon_x, icon_y = 110.0, 70.0
        icon_width, icon_height = 1380.0, 760.0
        scale_x = icon_width / source_width
        scale_y = icon_height / source_height
        group_markup: list[str] = []
        for color, paths in zip(palette, paths_by_color):
            compound = " ".join(paths)
            if compound:
                group_markup.append(
                    f'<path d="{compound}" fill="{color.hex}" fill-rule="evenodd"/>'
                )

        primary = html.escape(BRAND_NAME)
        tagline = html.escape(TAGLINE)
        accent = palette[0].hex
        svg = f'''<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1600" viewBox="0 0 1600 1600" role="img" aria-labelledby="title desc">
  <title id="title">Mama's Garden - logotipo editable</title>
  <desc id="desc">Isologo botánico vectorial con tipografía serif nativa.</desc>
  <g id="isotipo" transform="translate({icon_x:.2f} {icon_y:.2f}) scale({scale_x:.6f} {scale_y:.6f})">
    {''.join(group_markup)}
  </g>
  <g id="tipografia" fill="{accent}" text-anchor="middle">
    <text x="800" y="1125" font-family="Georgia, 'Times New Roman', serif" font-size="150" font-weight="700" letter-spacing="7">{primary}</text>
    <line x1="270" y1="1195" x2="1330" y2="1195" stroke="{accent}" stroke-width="5"/>
    <text x="800" y="1300" font-family="Georgia, 'Times New Roman', serif" font-size="48" font-weight="400" letter-spacing="7">{tagline}</text>
  </g>
</svg>
'''
        output_path.write_text(svg, encoding="utf-8")
    except Exception as exc:
        raise RuntimeError(f"Falló la generación de SVG: {exc}") from exc


def _font_path(bold: bool) -> Path | None:
    windows_fonts = Path("C:/Windows/Fonts")
    candidates = [
        windows_fonts / ("georgiab.ttf" if bold else "georgia.ttf"),
        windows_fonts / ("timesbd.ttf" if bold else "times.ttf"),
        Path("C:/Users/Kevin/.cache/codex-runtimes/codex-primary-runtime/dependencies/fonts")
        / ("DejaVuSerif-Bold.ttf" if bold else "DejaVuSerif.ttf"),
    ]
    return next((path for path in candidates if path.exists()), None)


def _draw_centered_with_tracking(
    draw: ImageDraw.ImageDraw,
    text: str,
    center_x: int,
    y: int,
    font: ImageFont.FreeTypeFont | ImageFont.ImageFont,
    fill: tuple[int, int, int, int],
    tracking: int,
) -> None:
    widths = [draw.textlength(character, font=font) for character in text]
    total = sum(widths) + tracking * max(0, len(text) - 1)
    x = center_x - total / 2
    for character, width in zip(text, widths):
        draw.text((x, y), character, font=font, fill=fill, anchor="la")
        x += width + tracking


def _fallback_render_png(
    image: Image.Image,
    palette: Sequence[BrandColor],
    output_path: Path,
    monochrome: bool,
) -> None:
    scale = EXPORT_SIZE / CANVAS_SIZE
    canvas = Image.new("RGBA", (EXPORT_SIZE, EXPORT_SIZE), (0, 0, 0, 0))
    source = np.asarray(image.convert("RGB"))
    upper = source[: source.shape[0] // 2, :, :]
    mask = foreground_mask(upper)
    mask[max(0, upper.shape[0] - 36) :, :] = False
    if monochrome:
        rendered = np.zeros((*upper.shape[:2], 4), dtype=np.uint8)
        rendered[:, :, 3] = mask.astype(np.uint8) * 255
    else:
        labels = _nearest_palette_labels(upper, palette)
        rendered = np.zeros((*upper.shape[:2], 4), dtype=np.uint8)
        for index, color in enumerate(palette):
            rendered[labels == index, :3] = color.rgb
        rendered[:, :, 3] = mask.astype(np.uint8) * 255

    icon = Image.fromarray(rendered, "RGBA").resize((int(1380 * scale), int(760 * scale)), Image.Resampling.LANCZOS)
    canvas.alpha_composite(icon, (int(110 * scale), int(70 * scale)))
    draw = ImageDraw.Draw(canvas)
    ink = (0, 0, 0, 255) if monochrome else (*palette[0].rgb, 255)
    bold_path = _font_path(True)
    regular_path = _font_path(False)
    primary_font = ImageFont.truetype(str(bold_path), int(150 * scale)) if bold_path else ImageFont.load_default()
    tagline_font = ImageFont.truetype(str(regular_path), int(48 * scale)) if regular_path else ImageFont.load_default()
    _draw_centered_with_tracking(draw, BRAND_NAME, EXPORT_SIZE // 2, int(960 * scale), primary_font, ink, int(7 * scale))
    draw.line((int(270 * scale), int(1195 * scale), int(1330 * scale), int(1195 * scale)), fill=ink, width=max(1, int(5 * scale)))
    _draw_centered_with_tracking(draw, TAGLINE, EXPORT_SIZE // 2, int(1240 * scale), tagline_font, ink, int(7 * scale))
    canvas.save(output_path, format="PNG", dpi=(300, 300), optimize=True)


def export_pngs(
    svg_path: Path,
    image: Image.Image,
    palette: Sequence[BrandColor],
    transparent_path: Path,
    monochrome_path: Path,
) -> None:
    try:
        import cairosvg

        cairosvg.svg2png(
            url=str(svg_path),
            write_to=str(transparent_path),
            output_width=EXPORT_SIZE,
            output_height=EXPORT_SIZE,
        )
        with Image.open(transparent_path).convert("RGBA") as rendered:
            rendered.save(transparent_path, dpi=(300, 300), optimize=True)

        with Image.open(transparent_path).convert("RGBA") as rendered:
            pixels = np.asarray(rendered).copy()
            pixels[:, :, :3] = 0
            mono = Image.fromarray(pixels, "RGBA")
            mono.save(monochrome_path, dpi=(300, 300), optimize=True)
    except Exception as exc:
        print(f"[AVISO] CairoSVG no disponible o falló ({exc}); usando fallback Pillow.")
        _fallback_render_png(image, palette, transparent_path, monochrome=False)
        _fallback_render_png(image, palette, monochrome_path, monochrome=True)


def _register_pdf_fonts() -> tuple[str, str]:
    from reportlab.pdfbase import pdfmetrics
    from reportlab.pdfbase.ttfonts import TTFont

    regular = _font_path(False)
    bold = _font_path(True)
    if regular and bold:
        try:
            pdfmetrics.registerFont(TTFont("BrandSerif", str(regular)))
            pdfmetrics.registerFont(TTFont("BrandSerifBold", str(bold)))
            return "BrandSerif", "BrandSerifBold"
        except Exception:
            pass
    return "Times-Roman", "Times-Bold"


def create_brand_manual(
    output_path: Path,
    logo_path: Path,
    palette: Sequence[BrandColor],
) -> None:
    try:
        from reportlab.lib.pagesizes import A4, landscape
        from reportlab.lib.utils import ImageReader
        from reportlab.pdfgen import canvas

        regular_font, bold_font = _register_pdf_fonts()
        page_w, page_h = landscape(A4)
        pdf = canvas.Canvas(str(output_path), pagesize=(page_w, page_h), pageCompression=1)
        pdf.setTitle("Mama's Garden - Manual de Marca")
        pdf.setAuthor("Mama's Garden")

        pdf.setFillColorRGB(0.973, 0.961, 0.925)
        pdf.rect(0, 0, page_w, page_h, fill=1, stroke=0)
        pdf.setFillColorRGB(0.16, 0.20, 0.11)
        pdf.setFont(bold_font, 25)
        pdf.drawCentredString(page_w / 2, page_h - 36, "MAMA'S GARDEN")
        pdf.setFont(regular_font, 10)
        pdf.drawCentredString(page_w / 2, page_h - 53, "MANUAL DE MARCA - EDICION ESENCIAL")

        logo_size = 224
        pdf.drawImage(
            ImageReader(str(logo_path)),
            (page_w - logo_size) / 2,
            300,
            width=logo_size,
            height=logo_size,
            preserveAspectRatio=True,
            mask="auto",
        )

        pdf.setFont(bold_font, 11)
        pdf.drawString(42, 278, "PALETA PRINCIPAL")
        gap = 12
        card_w = (page_w - 84 - gap * 3) / 4
        card_y, color_h, info_h = 178, 47, 45
        for index, color in enumerate(palette):
            x = 42 + index * (card_w + gap)
            r, g, b = (component / 255.0 for component in color.rgb)
            pdf.setFillColorRGB(r, g, b)
            pdf.roundRect(x, card_y + info_h, card_w, color_h, 6, fill=1, stroke=0)
            pdf.setFillColorRGB(1, 1, 1)
            pdf.setFont(bold_font, 12)
            pdf.drawString(x + 10, card_y + info_h + 17, color.hex)
            pdf.setFillColorRGB(1, 1, 1)
            pdf.setStrokeColorRGB(0.86, 0.84, 0.77)
            pdf.roundRect(x, card_y, card_w, info_h, 6, fill=1, stroke=1)
            pdf.setFillColorRGB(0.18, 0.18, 0.15)
            pdf.setFont("Helvetica", 7.5)
            pdf.drawString(x + 9, card_y + 27, f"RGB  {color.rgb[0]} / {color.rgb[1]} / {color.rgb[2]}")
            c, m, y, k = color.cmyk
            pdf.drawString(x + 9, card_y + 13, f"CMYK  {c} / {m} / {y} / {k}  (aprox.)")

        panel_x, panel_y, panel_w, panel_h = 42, 42, page_w - 84, 104
        pdf.setFillColorRGB(1, 1, 1)
        pdf.setStrokeColorRGB(0.86, 0.84, 0.77)
        pdf.roundRect(panel_x, panel_y, panel_w, panel_h, 8, fill=1, stroke=1)
        pdf.setFillColorRGB(0.16, 0.20, 0.11)
        pdf.setFont(bold_font, 11)
        pdf.drawString(panel_x + 16, panel_y + panel_h - 22, "SISTEMA TIPOGRAFICO")
        pdf.setFont(bold_font, 20)
        pdf.drawString(panel_x + 16, panel_y + 47, "Georgia Bold")
        pdf.setFont("Helvetica", 8)
        pdf.drawString(panel_x + 16, panel_y + 27, "Marca principal - mayusculas - espaciado amplio")
        pdf.setFont(regular_font, 16)
        pdf.drawString(panel_x + 330, panel_y + 49, "Georgia Regular")
        pdf.setFont("Helvetica", 8)
        pdf.drawString(panel_x + 330, panel_y + 27, "Lema y textos editoriales - fallback: Times New Roman / serif")
        pdf.setFont("Helvetica", 7)
        pdf.setFillColorRGB(0.38, 0.38, 0.34)
        pdf.drawRightString(page_w - 42, 21, "Version 1.0 | 300 DPI | SVG con texto editable")
        pdf.showPage()
        pdf.save()
    except Exception as exc:
        raise RuntimeError(f"Falló la creación del manual PDF: {exc}") from exc


def validate_outputs(staging_dir: Path) -> None:
    try:
        from pypdf import PdfReader

        svg_text = (staging_dir / "logo_vector.svg").read_text(encoding="utf-8")
        if "<path" not in svg_text or "<text" not in svg_text:
            raise ValueError("El SVG no contiene paths y texto nativo.")
        if BRAND_NAME not in html.unescape(svg_text) or TAGLINE not in html.unescape(svg_text):
            raise ValueError("El SVG no conserva los textos de marca.")

        for png_name in ("logo_transparent.png", "logo_monochrome.png"):
            with Image.open(staging_dir / png_name) as png:
                if png.mode != "RGBA" or png.size != (EXPORT_SIZE, EXPORT_SIZE):
                    raise ValueError(f"{png_name} no cumple RGBA {EXPORT_SIZE}x{EXPORT_SIZE}.")
                if png.getchannel("A").getextrema()[0] != 0:
                    raise ValueError(f"{png_name} no contiene transparencia real.")

        with Image.open(staging_dir / "logo_monochrome.png") as mono:
            data = np.asarray(mono.convert("RGBA"))
            opaque_rgb = data[:, :, :3][data[:, :, 3] > 0]
            if opaque_rgb.size and np.any(opaque_rgb != 0):
                raise ValueError("La versión monocroma contiene colores distintos de negro puro.")

        reader = PdfReader(str(staging_dir / "Brand_Manual.pdf"))
        if len(reader.pages) != 1:
            raise ValueError("El manual de marca debe tener exactamente una página.")
        text_content = reader.pages[0].extract_text() or ""
        if "PALETA PRINCIPAL" not in text_content or "SISTEMA TIPOGRAFICO" not in text_content:
            raise ValueError("El PDF no contiene todas las secciones requeridas.")
    except Exception as exc:
        raise RuntimeError(f"Falló la validación de artefactos: {exc}") from exc


def package_outputs(staging_dir: Path, zip_path: Path) -> None:
    try:
        if zip_path.exists():
            zip_path.unlink()
        with zipfile.ZipFile(zip_path, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
            for name in OUTPUT_NAMES:
                file_path = staging_dir / name
                archive.write(file_path, arcname=str(Path(staging_dir.name) / name))
    except Exception as exc:
        raise RuntimeError(f"Falló el empaquetado ZIP: {exc}") from exc


def prepare_staging(staging_dir: Path) -> None:
    staging_dir.mkdir(parents=True, exist_ok=True)
    for name in OUTPUT_NAMES:
        target = staging_dir / name
        if target.exists() and target.is_file():
            target.unlink()


def run_pipeline(source_path: Path, output_root: Path) -> tuple[list[BrandColor], Path]:
    staging_dir = output_root / "Mama_Garden_Brand_Kit"
    zip_path = output_root / "Mama_Garden_Brand_Kit.zip"
    prepare_staging(staging_dir)

    try:
        with Image.open(source_path) as opened:
            image = opened.convert("RGB")
    except Exception as exc:
        raise RuntimeError(f"No se pudo cargar {source_path}: {exc}") from exc

    palette = extract_palette(image, color_count=4)
    paths_by_color, source_width, source_height = vectorize_isotype(image, palette)
    svg_path = staging_dir / "logo_vector.svg"
    transparent_path = staging_dir / "logo_transparent.png"
    monochrome_path = staging_dir / "logo_monochrome.png"
    manual_path = staging_dir / "Brand_Manual.pdf"

    build_svg(svg_path, paths_by_color, palette, source_width, source_height)
    export_pngs(svg_path, image, palette, transparent_path, monochrome_path)
    create_brand_manual(manual_path, transparent_path, palette)
    validate_outputs(staging_dir)
    package_outputs(staging_dir, zip_path)
    return palette, zip_path


def main() -> int:
    source = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else Path("logo.jpeg").resolve()
    output_root = Path.cwd().resolve()
    try:
        palette, zip_path = run_pipeline(source, output_root)
        payload = {f"color_{index + 1}": color.as_dict() for index, color in enumerate(palette)}
        print("PALETA_EXTRAIDA=")
        print(json.dumps(payload, ensure_ascii=False, indent=2))
        print(f"ZIP={zip_path}")
        return 0
    except Exception as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        traceback.print_exc()
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
