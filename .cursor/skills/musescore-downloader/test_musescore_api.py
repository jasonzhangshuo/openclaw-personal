import re
import sys
import json
import requests
from playwright.sync_api import sync_playwright

def download_midi(url):
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        
        auth_token = None
        score_id = None
        
        # We need the score ID. It's usually the number at the end of the URL
        match = re.search(r'scores/(\d+)', url)
        if match:
            score_id = match.group(1)
        else:
            print("Could not find score ID in URL")
            return
            
        print(f"Target Score ID: {score_id}")

        def handle_request(request):
            nonlocal auth_token
            # print(f"Req: {request.url}")
            if "authorization" in request.headers:
                auth_token = request.headers["authorization"]

        page.on("request", handle_request)
        
        print("Loading page to capture API token...")
        page.goto(url, wait_until="domcontentloaded")
        page.wait_for_timeout(5000)
        
        page.screenshot(path="downloads/musescore/debug2.png")
        
        if not auth_token:
            print("Failed to capture Authorization token from the page.")
            return
            
        print("Token captured! Requesting MIDI file link...")
        
        # Now we mimic dl-librescore's API request to jmuse
        api_url = f"https://musescore.com/api/jmuse?id={score_id}&type=midi&index=0"
        headers = {
            "Authorization": auth_token,
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "application/json"
        }
        
        res = requests.get(api_url, headers=headers)
        if res.status_code != 200:
            print(f"API Error {res.status_code}: {res.text}")
            return
            
        data = res.json()
        print(f"API Response: {data}")
        
        if "info" in data and "url" in data["info"]:
            midi_url = data["info"]["url"]
            print(f"Found MIDI URL! Downloading from: {midi_url}")
            
            midi_res = requests.get(midi_url, headers=headers)
            with open(f"downloads/musescore/{score_id}.mid", "wb") as f:
                f.write(midi_res.content)
            print(f"✅ Success! Saved to downloads/musescore/{score_id}.mid")
        else:
            print("MIDI URL not found in the response.")
            
        browser.close()

if __name__ == "__main__":
    download_midi("https://musescore.com/user/34458986/scores/6581864")