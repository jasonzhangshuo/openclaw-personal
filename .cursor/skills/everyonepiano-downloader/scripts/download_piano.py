import os
import re
import sys
import requests
from bs4 import BeautifulSoup
from urllib.parse import urljoin

def download_piano_score(url, save_dir="downloads"):
    """
    抓取人人钢琴网的乐谱图片
    :param url: 例如 https://www.everyonepiano.cn/Stave-12882-1.html
    :param save_dir: 保存目录
    """
    # 提取曲目ID
    match = re.search(r'Stave-(\d+)', url)
    if not match:
        print("❌ URL格式错误，应包含类似 Stave-12882 的标识。")
        return
    music_id = match.group(1)
    
    # 确保保存目录存在
    target_dir = os.path.join(save_dir, music_id)
    os.makedirs(target_dir, exist_ok=True)
    
    headers = {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': url
    }
    
    # 获取总页数
    print(f"正在分析乐谱: {music_id} ...")
    try:
        response = requests.get(url, headers=headers, timeout=20)
        response.raise_for_status()
        soup = BeautifulSoup(response.text, 'html.parser')
        
        # 寻找所有页面的链接: href="/Stave-12882-1.html"
        page_links = soup.find_all('a', href=re.compile(fr'/Stave-{music_id}-\d+\.html'))
        if not page_links:
            print("未找到分页链接，可能只有一张谱子或页面结构变更。")
            pages = 1
        else:
            # 提取最大页码
            page_numbers = []
            for a in page_links:
                m = re.search(r'Stave-\d+-(\d+)\.html', a['href'])
                if m:
                    page_numbers.append(int(m.group(1)))
            pages = max(page_numbers) if page_numbers else 1
            
        print(f"✅ 发现共 {pages} 页乐谱，准备开始下载...")
        
        # 循环下载每一页
        for page in range(1, pages + 1):
            page_url = f"https://www.everyonepiano.cn/Stave-{music_id}-{page}.html"
            res = requests.get(page_url, headers=headers, timeout=20)
            res.raise_for_status()
            page_soup = BeautifulSoup(res.text, 'html.parser')
            
            # 找到大图 <img class="img-responsive DownMusicPNG">
            img_tag = page_soup.find('img', class_='DownMusicPNG')
            if not img_tag or not img_tag.get('src'):
                # fallback 找包含 music_id 的大图
                img_tag = page_soup.find('img', src=re.compile(r'/pianomusic/.*\.png'))
            
            if img_tag and img_tag.get('src'):
                img_url = urljoin("https://www.everyonepiano.cn", img_tag['src'])
                img_name = os.path.basename(img_url)
                save_path = os.path.join(target_dir, img_name)
                
                print(f"⬇️ 正在下载第 {page} 页: {img_name}")
                img_res = requests.get(img_url, headers=headers, timeout=15)
                img_res.raise_for_status()
                
                with open(save_path, 'wb') as f:
                    f.write(img_res.content)
                print(f"✅ 保存成功: {save_path}")
            else:
                print(f"⚠️ 第 {page} 页未找到乐谱图片。")
                
        print(f"\n🎉 乐谱 {music_id} 下载完成！保存在目录: {target_dir}")
        
    except Exception as e:
        print(f"❌ 抓取过程中发生错误: {e}")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("用法: python download_piano.py <人人钢琴网五线谱页面URL>")
        print("例如: python download_piano.py https://www.everyonepiano.cn/Stave-12882-2.html")
    else:
        download_piano_score(sys.argv[1])
