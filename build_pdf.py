# -*- coding: utf-8 -*-
from reportlab.lib.pagesizes import LETTER
from reportlab.lib.units import inch
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_CENTER
from reportlab.platypus import (SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
                                 PageBreak, Image, HRFlowable, KeepTogether, ListFlowable, ListItem)
from svglib.svglib import svg2rlg
from reportlab.graphics import renderPDF

BG = colors.HexColor("#0b0e17")
PANEL = colors.HexColor("#131722")
BORDER = colors.HexColor("#252b3b")
TEXT = colors.HexColor("#1a1f2e")
MUTED = colors.HexColor("#5b6377")
ACCENT = colors.HexColor("#6366f1")
ACCENT2 = colors.HexColor("#4f46e5")
GREEN = colors.HexColor("#0e9f6e")
AMBER = colors.HexColor("#b8860b")
WHITE = colors.white

styles = getSampleStyleSheet()

title_style = ParagraphStyle("TitleBig", parent=styles["Title"], fontSize=27, leading=32,
                              textColor=ACCENT2, spaceAfter=6, fontName="Helvetica-Bold")
subtitle_style = ParagraphStyle("Subtitle", parent=styles["Normal"], fontSize=13, leading=18,
                                 textColor=MUTED, spaceAfter=4)
h1 = ParagraphStyle("H1", parent=styles["Heading1"], fontSize=17, leading=21, textColor=ACCENT2,
                     spaceBefore=18, spaceAfter=10, fontName="Helvetica-Bold")
h2 = ParagraphStyle("H2", parent=styles["Heading2"], fontSize=13, leading=17, textColor=TEXT,
                     spaceBefore=10, spaceAfter=6, fontName="Helvetica-Bold")
body = ParagraphStyle("Body", parent=styles["Normal"], fontSize=10.3, leading=15, textColor=TEXT,
                       spaceAfter=6)
note = ParagraphStyle("Note", parent=styles["Normal"], fontSize=9.5, leading=13.5, textColor=MUTED,
                       spaceAfter=6, leftIndent=10)
answer_style = ParagraphStyle("Answer", parent=styles["Normal"], fontSize=11.5, leading=16.5,
                               textColor=colors.HexColor("#0b0e17"), spaceAfter=6)
caption = ParagraphStyle("Caption", parent=styles["Normal"], fontSize=9, leading=12,
                          textColor=MUTED, alignment=TA_CENTER, spaceAfter=14, spaceBefore=4,
                          fontName="Helvetica-Oblique")

def code_block(lines, note_lines=None):
    """Terminal-style dark box. lines: list of command strings (with optional leading '# comment')."""
    rows = []
    for ln in lines:
        color = "#7dd3fc" if ln.strip().startswith("#") else "#e6e9f2"
        prefix = "" if ln.strip().startswith("#") else "$ "
        rows.append('<font color="%s" face="Courier">%s%s</font>' % (color, prefix, ln))
    html = "<br/>".join(rows)
    p = Paragraph(html, ParagraphStyle("code", fontName="Courier", fontSize=9.3, leading=14,
                                        textColor=colors.HexColor("#e6e9f2")))
    t = Table([[p]], colWidths=[460])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#05060c")),
        ("BOX", (0, 0), (-1, -1), 1, BORDER),
        ("LEFTPADDING", (0, 0), (-1, -1), 12),
        ("RIGHTPADDING", (0, 0), (-1, -1), 12),
        ("TOPPADDING", (0, 0), (-1, -1), 10),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
    ]))
    out = [t]
    if note_lines:
        out.append(Spacer(1, 3))
        for n in note_lines:
            out.append(Paragraph(n, note))
    return out

def svg_image(path, max_width=460):
    d = svg2rlg(path)
    scale = max_width / d.width
    d.width *= scale
    d.height *= scale
    d.scale(scale, scale)
    return d

def step_header(num, title):
    t = Table([[Paragraph('<font color="white"><b>%s</b></font>' % num, ParagraphStyle("n", fontSize=13, alignment=TA_CENTER)),
                Paragraph("<b>%s</b>" % title, h2)]], colWidths=[28, 420])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (0, 0), ACCENT),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("ALIGN", (0, 0), (0, 0), "CENTER"),
        ("TOPPADDING", (0,0), (-1,-1), 4), ("BOTTOMPADDING", (0,0), (-1,-1), 4),
        ("LEFTPADDING", (1,0), (1,0), 10),
        ("ROUNDEDCORNERS", [6,6,6,6]),
    ]))
    return t

story = []

# ---- Title page ----
story.append(Spacer(1, 60))
story.append(Paragraph("TradeHub", ParagraphStyle("brand", fontSize=15, textColor=MUTED,
                                                    fontName="Helvetica-Bold", spaceAfter=2)))
story.append(Paragraph("Deploying the 52-Week High Scanner Backend", title_style))
story.append(Paragraph("A step-by-step, illustrated guide to setting up the Supabase + GitHub "
                        "Actions pipeline that scans the full NSE daily.", subtitle_style))
story.append(Spacer(1, 18))
story.append(HRFlowable(width="100%", thickness=1, color=BORDER))
story.append(Spacer(1, 18))

answer_box = Table([[Paragraph(
    "<b>Short answer to “do I have to do this on my own computer?”</b><br/><br/>"
    "Yes, for the one-time setup (and any time you change the backend code) — the Supabase CLI "
    "commands (login, deploy, etc.) must run from a real terminal, which GitHub Pages cannot provide "
    "since it only serves static files. But that setup is one-time. After it's done, the "
    "<b>daily scan runs automatically on GitHub's own servers</b> via a scheduled GitHub Actions "
    "workflow — your computer does not need to be on, and you never touch a terminal again "
    "unless you change the code.", answer_style)]], colWidths=[460])
answer_box.setStyle(TableStyle([
    ("BACKGROUND", (0,0), (-1,-1), colors.HexColor("#eef2ff")),
    ("BOX", (0,0), (-1,-1), 1.2, ACCENT),
    ("LEFTPADDING", (0,0), (-1,-1), 16), ("RIGHTPADDING", (0,0), (-1,-1), 16),
    ("TOPPADDING", (0,0), (-1,-1), 14), ("BOTTOMPADDING", (0,0), (-1,-1), 14),
]))
story.append(answer_box)
story.append(PageBreak())

# ---- Overview / architecture ----
story.append(Paragraph("1. How the pieces fit together", h1))
story.append(Paragraph(
    "Four things are involved: your computer (used once, for setup), GitHub (hosts the site and "
    "runs the daily trigger), Supabase (stores results and runs the scanning code), and NSE's own "
    "website (the source of truth for new 52-week highs). The diagram below shows how data flows "
    "between them.", body))
story.append(Spacer(1, 8))
story.append(svg_image("/tmp/guide/svg/architecture.svg", 460))
story.append(Paragraph("Figure 1 — Data flow between your computer, GitHub, Supabase, NSE, and site visitors.", caption))

story.append(Paragraph("2. Who runs what, and when", h1))
story.append(Paragraph(
    "This is the part that answers “do I have to do this on my system” directly: only the "
    "left-hand column below happens on your computer, and only once.", body))
story.append(Spacer(1, 8))
story.append(svg_image("/tmp/guide/svg/where-it-runs.svg", 460))
story.append(Paragraph("Figure 2 — Setup happens on your computer once; the daily run happens on GitHub and Supabase's servers forever after.", caption))
story.append(PageBreak())

# ---- Prerequisites ----
story.append(Paragraph("3. Before you start", h1))
story.append(Paragraph("You'll need:", body))
story.append(ListFlowable([
    ListItem(Paragraph("Node.js installed on your computer (the Supabase CLI installs via npm).", body)),
    ListItem(Paragraph("Your Supabase project already created — you have this: project ref <font face=\"Courier\">hhvtlzrvvarytohmxqld</font>.", body)),
    ListItem(Paragraph("The <font face=\"Courier\">supabase-scan52w/</font> folder from your TradeHub repo, checked out locally (or downloaded).", body)),
    ListItem(Paragraph("Admin access to your GitHub repo (to add a secret and a workflow file).", body)),
], bulletType="bullet", start="circle"))
story.append(Spacer(1, 6))

# ---- Steps ----
story.append(step_header(1, "Install the Supabase CLI"))
story.append(Spacer(1, 6))
story.extend(code_block([
    "# one-time install, run in any terminal on your computer",
    "npm install -g supabase",
    "supabase --version",
]))
story.append(Spacer(1, 10))

story.append(step_header(2, "Log in and link your project"))
story.append(Spacer(1, 6))
story.extend(code_block([
    "supabase login",
    "# opens a browser window to authorize the CLI -- approve it, then return to the terminal",
    "cd path/to/supabase-scan52w",
    "supabase link --project-ref hhvtlzrvvarytohmxqld",
], ["“link” just tells the CLI which of your Supabase projects to talk to. It doesn't change anything yet."]))
story.append(Spacer(1, 10))
story.append(PageBreak())

story.append(step_header(3, "Create the scan_results table"))
story.append(Spacer(1, 6))
story.append(Paragraph(
    "Open the Supabase dashboard in your browser, go to SQL Editor → New query, paste the full "
    "contents of <font face=\"Courier\">supabase-scan52w/migrations/0001_scan52w_schema.sql</font>, "
    "and click Run. This creates the table the scanner writes into and the app reads from.", body))
story.append(Spacer(1, 6))
story.append(svg_image("/tmp/guide/svg/sql-editor.svg", 440))
story.append(Paragraph("Figure 3 — Illustrative mockup of the Supabase SQL Editor (not a literal screenshot).", caption))
story.append(Spacer(1, 8))

story.append(step_header(4, "Set the scan secret"))
story.append(Spacer(1, 6))
story.extend(code_block([
    "# pick any long random string -- this protects your function from being triggered by strangers",
    "supabase secrets set SCAN_SECRET=your-own-long-random-string-here",
]))
story.append(Spacer(1, 10))

story.append(step_header(5, "Deploy the Edge Function"))
story.append(Spacer(1, 6))
story.extend(code_block([
    "supabase functions deploy scan-52w-high --no-verify-jwt",
], ["This uploads functions/scan-52w-high/index.ts to Supabase's servers, where it will live and run from now on — you don't redeploy this again unless you edit the code."]))
story.append(Spacer(1, 10))
story.append(PageBreak())

story.append(step_header(6, "Test it once"))
story.append(Spacer(1, 6))
story.append(Paragraph(
    "Open this URL in your browser (with your real project ref and secret filled in) to trigger one "
    "scan manually and confirm it works before automating it:", body))
story.extend(code_block([
    "https://hhvtlzrvvarytohmxqld.supabase.co/functions/v1/scan-52w-high?secret=your-secret-here",
], ["A successful response looks like <font face=\"Courier\">{\"ok\":true,\"scan\":{\"scanned\":123,...}}</font>. Check the scan_results table in Table Editor to confirm rows appeared."]))
story.append(Spacer(1, 12))

story.append(step_header(7, "Automate the daily run with GitHub Actions"))
story.append(Spacer(1, 6))
story.append(Paragraph(
    "This is the step that moves the daily trigger off your computer entirely. Add your function URL "
    "and secret as GitHub repo secrets:", body))
story.append(Spacer(1, 6))
story.append(svg_image("/tmp/guide/svg/github-secret.svg", 440))
story.append(Paragraph("Figure 4 — GitHub → Settings → Secrets and variables → Actions (illustrative).", caption))
story.append(Spacer(1, 6))
story.append(Paragraph(
    "Then commit a workflow file at <font face=\"Courier\">.github/workflows/scan-52w.yml</font>:", body))
story.extend(code_block([
    "name: Daily 52-week-high scan",
    "on:",
    "  schedule:",
    "    - cron: '30 3 * * *'   # ~9:00am IST daily; adjust as needed",
    "  workflow_dispatch: {}     # lets you also trigger it manually from the Actions tab",
    "jobs:",
    "  scan:",
    "    runs-on: ubuntu-latest",
    "    steps:",
    "      - run: curl \"${{ secrets.SUPABASE_FUNCTION_URL }}?secret=${{ secrets.SCAN_SECRET }}\"",
], ["Once this file is pushed, GitHub runs it every day on its own servers — no CLI, no terminal, no computer of yours involved."]))
story.append(PageBreak())

story.append(step_header(8, "Verify on the live site"))
story.append(Spacer(1, 6))
story.append(Paragraph(
    "Visit <font face=\"Courier\">https://gstrain-source.github.io/tradehub/</font>, open the "
    "52-Week High page, and switch to the “Full NSE” tab. It reads directly from the "
    "scan_results table, so once a scan has run you should see today's NSE-confirmed new highs there.", body))
story.append(Spacer(1, 14))

# ---- Troubleshooting ----
story.append(Paragraph("Troubleshooting", h1))
tt_data = [
    [Paragraph("<b>Symptom</b>", body), Paragraph("<b>Likely cause / fix</b>", body)],
    [Paragraph("Full NSE tab shows “not configured”", body),
     Paragraph("Check <font face=\"Courier\">auth-config.js</font> has your real Supabase URL and anon key (not a placeholder).", body)],
    [Paragraph("Full NSE tab loads but is empty", body),
     Paragraph("The daily function hasn't run yet, or ran and found 0 new highs that day. Trigger Step 6's URL manually to check.", body)],
    [Paragraph("Test URL in Step 6 returns an error", body),
     Paragraph("Confirm the secret in the URL matches what you set with <font face=\"Courier\">supabase secrets set</font>, and that the function deployed without errors.", body)],
    [Paragraph("GitHub Actions run shows a failure", body),
     Paragraph("Open the failed run's log in the Actions tab — usually a missing/mismatched repo secret name.", body)],
    [Paragraph("Need to update the scanning logic later", body),
     Paragraph("Edit <font face=\"Courier\">functions/scan-52w-high/index.ts</font> locally, then re-run just Step 5 (deploy) — the rest stays as-is.", body)],
]
tt = Table(tt_data, colWidths=[165, 300])
tt.setStyle(TableStyle([
    ("BACKGROUND", (0,0), (-1,0), colors.HexColor("#eef2ff")),
    ("GRID", (0,0), (-1,-1), 0.6, BORDER),
    ("VALIGN", (0,0), (-1,-1), "TOP"),
    ("LEFTPADDING", (0,0), (-1,-1), 8), ("RIGHTPADDING", (0,0), (-1,-1), 8),
    ("TOPPADDING", (0,0), (-1,-1), 7), ("BOTTOMPADDING", (0,0), (-1,-1), 7),
]))
story.append(tt)
story.append(Spacer(1, 14))
story.append(Paragraph(
    "Full command reference and known limitations are also documented in "
    "<font face=\"Courier\">supabase-scan52w/README.md</font> in the repo.", note))

doc = SimpleDocTemplate("/tmp/guide/TradeHub-Backend-Deployment-Guide.pdf", pagesize=LETTER,
                         topMargin=0.55*inch, bottomMargin=0.6*inch,
                         leftMargin=0.7*inch, rightMargin=0.7*inch,
                         title="TradeHub Backend Deployment Guide")
doc.build(story)
print("PDF built")
