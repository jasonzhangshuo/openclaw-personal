#!/usr/bin/env python3
"""
Garmin Connect 一次性登录脚本
在你自己的终端运行，支持交互式输入邮箱验证码
登录成功后 token 缓存到 ~/.garth/，之后 garmin_fetch.py 无需再登录
"""
import os
import getpass
import sys

try:
    from garminconnect import (
        Garmin,
        GarminConnectAuthenticationError,
        GarminConnectConnectionError,
    )
except ImportError:
    print("请先安装：pip3 install garminconnect --break-system-packages")
    sys.exit(1)

TOKEN_DIR = os.path.expanduser("~/.garth")

def prompt_mfa():
    return input("请输入 Garmin 发到邮箱的验证码：").strip()

def main():
    print("=== Garmin Connect 登录 ===\n")
    email = input("邮箱：").strip()
    password = getpass.getpass("密码：")

    print("\n正在登录...")
    client = Garmin(email=email, password=password, is_cn=False, prompt_mfa=prompt_mfa)

    try:
        client.login()
    except GarminConnectAuthenticationError as e:
        print(f"账号或密码错误：{e}")
        sys.exit(1)
    except GarminConnectConnectionError as e:
        print(f"连接失败：{e}")
        print("确认 VPN 已开启，且能访问 connect.garmin.com")
        sys.exit(1)
    except Exception as e:
        print(f"登录失败：{e}")
        sys.exit(1)

    os.makedirs(TOKEN_DIR, exist_ok=True)
    client.garth.dump(TOKEN_DIR)

    profile = client.get_full_name()
    print(f"\n登录成功！欢迎，{profile}")
    print(f"Token 已缓存到 {TOKEN_DIR}")
    print("\n现在可以运行：")
    print("  python3 scripts/garmin_fetch.py --days 30")

if __name__ == "__main__":
    main()
