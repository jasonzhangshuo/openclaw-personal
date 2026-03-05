---
name: everyonepiano-downloader
description: Download high-resolution sheet music (PNGs) from EveryonePiano (人人钢琴网). Use when the user provides a link to an EveryonePiano score.
---

# EveryonePiano Downloader Skill

Use this skill when the user wants to download sheet music (images) from EveryonePiano (人人钢琴网).

## What it does
It uses a built-in Python script (`scripts/download_piano.py`) to automatically parse the total number of pages for a given piano score and downloads all the high-resolution PNG images to a `downloads/` folder in the current working directory.

## Prerequisites
Ensure that a Python environment is available and the required dependencies are installed:
```bash
pip install requests beautifulsoup4
```
*(If the user prefers using a `.venv`, activate it first).*

## How to use
When a user provides a link to an EveryonePiano score (e.g., `https://www.everyonepiano.cn/Stave-12882-1.html`), run the following command using the Shell tool. 

Notice that the script is located inside this skill's folder. Assuming the user's skill folder is `.cursor/skills/everyonepiano-downloader`:

```bash
python .cursor/skills/everyonepiano-downloader/scripts/download_piano.py <URL>
```
*(If the user installed this skill globally, the path would be `~/.cursor/skills/everyonepiano-downloader/scripts/download_piano.py`)*

Example:
```bash
python .cursor/skills/everyonepiano-downloader/scripts/download_piano.py https://www.everyonepiano.cn/Stave-12882-2.html
```

## Post-Execution
- Let the user know the images have been successfully downloaded to `downloads/<MUSIC_ID>/` in their current project.
- If the user wants to combine these PNGs into a PDF, you can offer to use the `fpdf` or `Pillow` library to convert them.