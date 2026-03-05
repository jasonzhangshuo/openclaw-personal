# Free Sheet Music Downloader Collection 🎹

这个仓库收集了目前（2026年）最有效的免费下载乐谱方案，帮助你轻松获取高质量的五线谱和 MIDI 源文件。目前支持 **人人钢琴网 (EveryonePiano)** 和 **MuseScore** 两个平台。

---

## 方案一：人人钢琴网 (EveryonePiano) 自动下载器

由于人人钢琴网的防爬机制较弱，我们可以直接使用 Python 脚本进行全自动批量下载高清乐谱图片，并可结合光学乐谱识别（OMR）转化为机器文件。

### 1. 自动抓取乐谱图片

这是一个轻量级的 Python 脚本，专门用于从人人钢琴网下载高清五线谱图片（PNG）。

**安装依赖**：
```bash
# 推荐使用虚拟环境
python3 -m venv .venv
source .venv/bin/activate
pip install requests beautifulsoup4
```

**使用方法**：
运行 `scripts/download_piano.py` 脚本，并传入人人钢琴网的五线谱页面 URL：
```bash
python scripts/download_piano.py https://www.everyonepiano.cn/Stave-14747-1.html
```
所有图片将自动保存到运行目录下的 `downloads/<MUSIC_ID>/` 文件夹中。

### 2. 进阶玩法：将图片转换为可播放的 MusicXML (配合 homr)

下载好图片后，如果你想让乐谱“发出声音”或者在打谱软件里编辑它，可以使用开源 OMR 工具 [liebharc/homr](https://github.com/liebharc/homr)。

**使用步骤**：
1. `git clone https://github.com/liebharc/homr.git` 并进入目录。
2. 安装依赖：`poetry install --only main` (如果有显卡可加 `,gpu`)。
3. 转换文件：`poetry run homr /你的路径/downloads/14747/0014747-w-b-1.png`
4. 转换完成后，同级目录下会生成一个 `.musicxml` 文件。你可以把它拖进免费的 **MuseScore 客户端** 里，它就能发声播放了！

---

## 方案二：MuseScore (Musescore.com) 终极下载法 破解VIP

**⚠️ 核心必读**：由于 2025/2026 年 MuseScore 官方接入了变态级的 Cloudflare 真人防机器盾，**任何纯代码爬虫或自动化浏览器都会被无限验证码拦截（Score not found）**。目前唯一也是最强大的解决思路是回归你的**个人常用浏览器**，配合油猴脚本进行“浏览器内注入破解”。

### 终极抓取步骤（100% 成功率）：

本方案基于开源神器 [LibreScore](https://github.com/LibreScore/dl-librescore)。

**第 1 步：安装环境**
1. 在你的常用浏览器（Chrome / Edge）安装扩展：**Tampermonkey（油猴）**。
2. 打开油猴扩展管理页，确保右上角开启了 **开发者模式 (Developer mode)**，并在油猴扩展详情里开启 **"允许用户脚本" (Allow user scripts)**。

**第 2 步：安装破解脚本**
1. 点击此链接安装破解核心：👉 **[安装 dl-librescore 脚本](https://msdl.librescore.org/install.user.js)**。
2. 在弹出的油猴界面点击“安装”。

**第 3 步：享受免费下载**
1. 在你的浏览器打开 MuseScore 官网并**正常登录你的免费账号**。
2. 自由搜索你想要的歌曲（如：周杰伦、周华健 朋友）。
3. 点进任意一个需要付费才能下载的高级乐谱页面。
4. **见证奇迹**：等待几秒网页加载后，原本官方的 "Download" 或 "Print" 按钮区域，会被替换/增加一个由 LibreScore 提供的**全新下载菜单**。
5. 在这个菜单里，你可以直接免费下载高分辨率的 PDF、或者多轨道的 **MIDI** 文件！

> **💡 练琴/Solo 小技巧**：
> 拿到 MIDI 文件后，不用花钱买 PRO 会员。你可以把它拖进任意音乐软件（比如 GarageBand、Logic，或者免费的 MuseScore 电脑版），所有乐器和左右手都会变成独立的轨道。你可以随心所欲地 Solo（独奏）任何一条轨道、或者把它静音，这比网页版自带的练习功能还要好用！
