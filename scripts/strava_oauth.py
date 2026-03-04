#!/usr/bin/env python3
"""
Strava OAuth 一次性授权脚本
运行后会自动打开浏览器，授权完成后自动捕获 token。
"""
import http.server
import threading
import webbrowser
import urllib.parse
import json
import sys
import os
import requests

# 从命令行或环境变量读取
CLIENT_ID = os.getenv("STRAVA_CLIENT_ID") or (sys.argv[1] if len(sys.argv) > 1 else "")
CLIENT_SECRET = os.getenv("STRAVA_CLIENT_SECRET") or (sys.argv[2] if len(sys.argv) > 2 else "")

if not CLIENT_ID or not CLIENT_SECRET:
    print("用法：")
    print("  STRAVA_CLIENT_ID=xxx STRAVA_CLIENT_SECRET=yyy python3 scripts/strava_oauth.py")
    print("  或：python3 scripts/strava_oauth.py <client_id> <client_secret>")
    sys.exit(1)

PORT = 8765
REDIRECT_URI = f"http://localhost:{PORT}/callback"
SCOPE = "read,activity:read_all,profile:read_all"

auth_code = None
server_done = threading.Event()


class CallbackHandler(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        global auth_code
        parsed = urllib.parse.urlparse(self.path)
        params = urllib.parse.parse_qs(parsed.query)

        if "code" in params:
            auth_code = params["code"][0]
            self.send_response(200)
            self.send_header("Content-type", "text/html; charset=utf-8")
            self.end_headers()
            self.wfile.write(b"<h2>&#x6388;&#x6743;&#x6210;&#x529f;&#xFF01;&#x53EF;&#x4EE5;&#x5173;&#x95ED;&#x6B64;&#x9875;&#x9762;&#x3002;</h2>")
            server_done.set()
        elif "error" in params:
            self.send_response(400)
            self.send_header("Content-type", "text/html; charset=utf-8")
            self.end_headers()
            err = params.get("error", ["unknown"])[0]
            self.wfile.write(f"<h2>授权失败: {err}</h2>".encode())
            server_done.set()

    def log_message(self, format, *args):
        pass  # 静默日志


def exchange_code(code):
    resp = requests.post("https://www.strava.com/oauth/token", data={
        "client_id": CLIENT_ID,
        "client_secret": CLIENT_SECRET,
        "code": code,
        "grant_type": "authorization_code",
    })
    resp.raise_for_status()
    return resp.json()


def main():
    auth_url = (
        f"https://www.strava.com/oauth/authorize"
        f"?client_id={CLIENT_ID}"
        f"&response_type=code"
        f"&redirect_uri={urllib.parse.quote(REDIRECT_URI)}"
        f"&approval_prompt=force"
        f"&scope={urllib.parse.quote(SCOPE)}"
    )

    server = http.server.HTTPServer(("localhost", PORT), CallbackHandler)
    t = threading.Thread(target=server.serve_forever)
    t.daemon = True
    t.start()

    print(f"\n正在打开浏览器进行 Strava 授权...")
    print(f"如果浏览器没有自动打开，请手动访问：\n{auth_url}\n")
    webbrowser.open(auth_url)

    server_done.wait(timeout=120)
    server.shutdown()

    if not auth_code:
        print("授权超时或失败，请重试。")
        sys.exit(1)

    print("获取到授权码，正在换取 token...")
    token_data = exchange_code(auth_code)

    print("\n=== 授权成功！请将以下内容追加到 .env 文件 ===\n")
    print(f"STRAVA_CLIENT_ID={CLIENT_ID}")
    print(f"STRAVA_CLIENT_SECRET={CLIENT_SECRET}")
    print(f"STRAVA_ACCESS_TOKEN={token_data['access_token']}")
    print(f"STRAVA_REFRESH_TOKEN={token_data['refresh_token']}")
    print(f"STRAVA_TOKEN_EXPIRES_AT={token_data['expires_at']}")
    print(f"STRAVA_ATHLETE_ID={token_data['athlete']['id']}")
    print()
    print("运动员信息：")
    athlete = token_data["athlete"]
    print(f"  姓名：{athlete.get('firstname', '')} {athlete.get('lastname', '')}")
    print(f"  ID：{athlete['id']}")
    print()

    # 自动写入 .env
    env_path = os.path.join(os.path.dirname(__file__), "..", ".env")
    env_path = os.path.normpath(env_path)
    env_lines = []
    if os.path.exists(env_path):
        with open(env_path) as f:
            existing = f.read()
        # 移除旧的 STRAVA_ 行
        env_lines = [l for l in existing.splitlines() if not l.startswith("STRAVA_")]
    else:
        existing = ""

    env_lines += [
        "# Strava API (Garmin 数据来源)",
        f"STRAVA_CLIENT_ID={CLIENT_ID}",
        f"STRAVA_CLIENT_SECRET={CLIENT_SECRET}",
        f"STRAVA_ACCESS_TOKEN={token_data['access_token']}",
        f"STRAVA_REFRESH_TOKEN={token_data['refresh_token']}",
        f"STRAVA_TOKEN_EXPIRES_AT={token_data['expires_at']}",
        f"STRAVA_ATHLETE_ID={token_data['athlete']['id']}",
    ]

    with open(env_path, "w") as f:
        f.write("\n".join(env_lines) + "\n")

    print(f"已自动写入 {env_path}")
    print("下一步：python3 scripts/strava_fetch.py")


if __name__ == "__main__":
    main()
