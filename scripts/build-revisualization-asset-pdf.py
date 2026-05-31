#!/usr/bin/env python3
"""
build-revisualization-asset-pdf.py — compile the F3/F6 internal-revisualization
asset-generation briefs into one paste-ready PDF:
  • F3 Tjau breathing chamber — Flow ambient-video prompt (paste into Flow)
  • F6 Hesi voice demo — ElevenLabs generation brief (generate the audio asset)

Renders each brief faithfully (titles bold-gold, ─── lines as rules, ═══ section
headers bold), prose wraps so it copies clean. Each brief starts on its own page.

Re-run after editing either .txt:  python3 scripts/build-revisualization-asset-pdf.py
"""
import os
import re
from xml.sax.saxutils import escape
from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.colors import HexColor
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, PageBreak, HRFlowable,
)
from reportlab.lib.styles import ParagraphStyle

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PROMPT_DIR = os.path.join(REPO, "videos", "senebty-foundations")
OUT = os.path.join(REPO, "docs", "superpowers", "specs",
                   "2026-05-29-foundation-revisualization-flow-prompts.pdf")

# (file, kebab caption shown under the title)
BRIEFS = [
    ("tjau-breath-ambient.prompt.txt",
     "F3 TJAU — breathing chamber · FLOW ambient video → videos/senebty-foundations/tjau-breath-ambient.mp4"),
    ("hesi-voice-demo.elevenlabs.txt",
     "F6 HESI — voice demo · ELEVENLABS audio → public/audio/senebty/hesi-voice-demo.mp3"),
]

DIVIDER_RE = re.compile(r'^[─—_=\-]{6,}$')          # full-width box rules
SECTION_RE = re.compile(r'^[═]{2,}.*[═]{2,}$|^═══')  # ═══ SHOT/SECTION ═══


def main():
    title_style = ParagraphStyle(
        "title", fontName="Helvetica-Bold", fontSize=13, leading=16,
        textColor=HexColor("#8a6d1f"), alignment=TA_LEFT, spaceAfter=2)
    caption_style = ParagraphStyle(
        "caption", fontName="Helvetica-Oblique", fontSize=8.5, leading=11,
        textColor=HexColor("#555555"), alignment=TA_LEFT, spaceAfter=8)
    section_style = ParagraphStyle(
        "section", fontName="Helvetica-Bold", fontSize=9.8, leading=13,
        textColor=HexColor("#8a6d1f"), alignment=TA_LEFT,
        spaceBefore=6, spaceAfter=3)
    body_style = ParagraphStyle(
        "body", fontName="Helvetica", fontSize=9.6, leading=13.2,
        alignment=TA_LEFT, spaceAfter=3.5)

    doc = SimpleDocTemplate(
        OUT, pagesize=letter,
        leftMargin=0.6 * inch, rightMargin=0.6 * inch,
        topMargin=0.55 * inch, bottomMargin=0.55 * inch,
        title="Foundation re-visualization — F3/F6 asset briefs",
        author="Per Ankh Reader")

    story = []
    for idx, (fname, caption) in enumerate(BRIEFS):
        path = os.path.join(PROMPT_DIR, fname)
        if not os.path.exists(path):
            raise SystemExit(f"missing brief: {path}")
        with open(path, encoding="utf-8") as f:
            lines = [ln.rstrip("\n") for ln in f]

        title = lines[0].strip() if lines else fname
        story.append(Paragraph(escape(title), title_style))
        story.append(Paragraph(escape(caption), caption_style))
        story.append(HRFlowable(width="100%", thickness=0.8,
                                 color=HexColor("#d8c79a"), spaceAfter=8))

        for ln in lines[1:]:
            s = ln.strip()
            if not s:
                story.append(Spacer(1, 5))
            elif DIVIDER_RE.match(s):
                story.append(HRFlowable(width="100%", thickness=0.5,
                                        color=HexColor("#d8c79a"),
                                        spaceBefore=3, spaceAfter=3))
            elif SECTION_RE.match(s):
                story.append(Paragraph(escape(s.strip("═ ")), section_style))
            else:
                story.append(Paragraph(escape(ln), body_style))

        if idx != len(BRIEFS) - 1:
            story.append(PageBreak())

    doc.build(story)
    print(f"✓ wrote {OUT}")
    print(f"  briefs: {len(BRIEFS)}")


if __name__ == "__main__":
    main()
