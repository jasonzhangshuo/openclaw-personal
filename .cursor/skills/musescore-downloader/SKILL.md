---
name: musescore-downloader
description: Download sheet music, MIDI, MP3, and PDF files from MuseScore.com. Use when the user provides a link to a MuseScore score or wants to download MuseScore files.
---

# MuseScore Downloader Skill

Use this skill when the user wants to download music files (PDF, MIDI, MP3) from MuseScore (`musescore.com`).

## What it does
Due to MuseScore's strict Cloudflare protections in 2025/2026, pure headless requests no longer work reliably. This skill uses a **Playwright UI Script** (`musescore_ui_downloader.py`) that:
1. Opens a visible Chrome browser.
2. Allows the user to manually pass the Cloudflare human-verification if it appears.
3. Automatically injects the latest `dl-librescore.user.js` userscript.
4. Simulates clicks to download the MIDI file, saving it locally.

## Prerequisites
Ensure Python environment is active and `playwright` is installed:
```bash
source .venv/bin/activate
pip install playwright
playwright install chromium
```

## How to use
When a user provides a link to a MuseScore score (e.g., `https://musescore.com/user/123/scores/456`), run the following command using the Shell tool:

```bash
source .venv/bin/activate
python .cursor/skills/musescore-downloader/musescore_ui_downloader.py "<URL>"
```

Example:
```bash
source .venv/bin/activate
python .cursor/skills/musescore-downloader/musescore_ui_downloader.py "https://musescore.com/user/34458986/scores/6581864"
```

## Post-Execution
- Let the user know the script will pop up a browser window.
- Tell them to click the Cloudflare checkbox if it asks them to verify they are human.
- After verification, the script will handle the rest and download the MIDI file to `downloads/musescore/`.
- If the auto-click fails, remind them they have 60 seconds to manually click the newly injected download button in the browser window before it closes.