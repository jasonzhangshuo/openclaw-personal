import os
import sys
from playwright.sync_api import sync_playwright

def download_musescore_midi(url, output_dir="downloads/musescore"):
    os.makedirs(output_dir, exist_ok=True)
    
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()
        page = context.new_page()

        # Inject the userscript as an init script to mimic Tampermonkey
        script_path = os.path.join(os.path.dirname(__file__), "dl-librescore.user.js")
        with open(script_path, "r", encoding="utf-8") as f:
            userscript = f.read()

        page.add_init_script(userscript)
        
        print(f"Loading {url} ...")
        page.goto(url, wait_until="domcontentloaded", timeout=60000)
        
        # Wait a bit for the app to initialize
        page.wait_for_timeout(5000)

        page.screenshot(path="downloads/musescore/debug1.png")

        print("Waiting for download button to appear...")
        # The script creates a button with a specific SVG path (ICON.DOWNLOAD_TOP)
        # M9.479 4.225v7.073
        dl_btn_selector = 'button:has(svg path[d^="M9.479 4.225"])'
        
        try:
            dl_btn = page.wait_for_selector(dl_btn_selector, timeout=15000)
            print("Clicking main download button...")
            dl_btn.click()
            
            print("Waiting for MIDI option...")
            # After clicking, a menu pops up. We look for a button containing "MIDI"
            midi_btn = page.wait_for_selector('button:has-text("MIDI")', timeout=10000)
            
            print("Clicking MIDI download and waiting for file...")
            with page.expect_download(timeout=60000) as download_info:
                midi_btn.click()
                
            download = download_info.value
            filename = download.suggested_filename
            save_path = os.path.join(output_dir, filename)
            download.save_as(save_path)
            
            print(f"✅ Successfully downloaded: {save_path}")
            
        except Exception as e:
            print(f"❌ Failed during automation: {e}")
            
        finally:
            browser.close()

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python musescore_auto_downloader.py <URL>")
    else:
        download_musescore_midi(sys.argv[1])
