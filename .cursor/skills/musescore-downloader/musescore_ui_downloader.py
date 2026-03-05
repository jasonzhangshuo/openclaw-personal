import os
import sys
import time
from playwright.sync_api import sync_playwright

def download_musescore(url=None, output_dir="downloads/musescore"):
    os.makedirs(output_dir, exist_ok=True)
    user_data_dir = os.path.join(os.path.dirname(__file__), "browser_data")
    
    with sync_playwright() as p:
        # 使用持久化上下文，这样可以保存你的登录状态和 Cookie
        context = p.chromium.launch_persistent_context(
            user_data_dir,
            headless=False,
            viewport={"width": 1280, "height": 800}
        )
        page = context.pages[0] if context.pages else context.new_page()

        if url:
            print(f"正在加载 {url} ...")
            page.goto(url, wait_until="domcontentloaded", timeout=60000)
        else:
            print("正在打开 MuseScore 首页...")
            page.goto("https://musescore.com/", wait_until="domcontentloaded", timeout=60000)
        
        print("=========================================================")
        print("👉 请在弹出的浏览器中操作：")
        print("1. 如果遇到验证码，请打勾。")
        print("2. 如果你还没有登录，请先登录（已为你保存登录状态，下次免登）。")
        print("3. 你可以自由搜索你想找的歌曲（例如：周华健 朋友）。")
        print("4. 当你进入任意一个曲谱的最终页面时，代码会自动检测并开始破解！")
        print("=========================================================")
        
        # 循环检测当前网址是否是具体的谱子页面
        while True:
            current_url = page.url
            if "/scores/" in current_url:
                print(f"✅ 检测到已进入曲谱页面: {current_url}")
                break
            time.sleep(2)

        # 稍微等几秒让 React 页面渲染完毕
        time.sleep(3)

        # 读取并注入 LibreScore 油猴脚本
        script_path = os.path.join(os.path.dirname(__file__), "dl-librescore.user.js")
        if not os.path.exists(script_path):
            print(f"❌ 找不到脚本文件: {script_path}")
            return

        with open(script_path, "r", encoding="utf-8") as f:
            userscript = f.read()

        print("💉 正在向网页注入 LibreScore 破解脚本...")
        page.evaluate(userscript)

        print("🔍 正在寻找 LibreScore 生成的下载按钮...")
        # LibreScore 生成的下载按钮包含一个特定的 SVG 图标
        dl_btn_selector = 'button:has(svg path[d^="M9.479 4.225"])'
        
        try:
            dl_btn = page.wait_for_selector(dl_btn_selector, timeout=20000)
            print("👆 找到主下载按钮，自动点击...")
            dl_btn.click()
            
            print("🔍 等待菜单中的 MIDI 选项...")
            midi_btn = page.wait_for_selector('button:has-text("MIDI")', timeout=10000)
            
            print("👆 自动点击 MIDI... (此时后台正在破解 token，请耐心等待)")
            with page.expect_download(timeout=120000) as download_info:
                midi_btn.click()
                
            download = download_info.value
            filename = download.suggested_filename
            save_path = os.path.join(output_dir, filename)
            download.save_as(save_path)
            
            print(f"\n🎉 抓取成功！文件已保存至: {save_path}")
            time.sleep(3)
            
        except Exception as e:
            print(f"\n❌ 自动化点击失败或超时: {e}")
            print("💡 你现在可以直接在弹出的浏览器窗口中**手动点击**那个新增的下载按钮！")
            print("浏览器将保持打开 600 秒供你手动操作...")
            time.sleep(600)
            
        finally:
            print("正在关闭浏览器...")
            context.close()

if __name__ == "__main__":
    url = sys.argv[1] if len(sys.argv) > 1 else None
    download_musescore(url)
