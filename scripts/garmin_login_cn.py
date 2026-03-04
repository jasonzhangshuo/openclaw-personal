#!/usr/bin/env python3
"""
Garmin Connect 中国版（connect.garmin.cn）一次性登录脚本
在你自己的终端运行，支持交互式输入验证码
登录成功后 token 缓存到 ~/.garth_cn/，之后无需再登录
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

TOKEN_DIR = os.path.expanduser("~/.garth_cn")


def prompt_mfa():
    return input("请输入佳明发到手机/邮箱的验证码：").strip()


def main():
    print("=== 佳明中国版登录（connect.garmin.cn）===\n")
    email = input("账号（手机号或邮箱）：").strip()
    password = getpass.getpass("密码：")

    print("\n正在登录佳明中国版...")
    client = Garmin(email=email, password=password, is_cn=True, prompt_mfa=prompt_mfa)

    try:
        client.login()
    except GarminConnectAuthenticationError as e:
        print(f"账号或密码错误：{e}")
        sys.exit(1)
    except GarminConnectConnectionError as e:
        print(f"连接失败：{e}")
        sys.exit(1)
    except Exception as e:
        print(f"登录失败：{e}")
        sys.exit(1)

    os.makedirs(TOKEN_DIR, exist_ok=True)
    client.garth.dump(TOKEN_DIR)

    try:
        name = client.get_full_name()
        print(f"\n登录成功！欢迎，{name}")
    except Exception:
        print("\n登录成功！")

    print(f"Token 已缓存到 {TOKEN_DIR}")
    print("\n现在可以运行：")
    print("  python3 scripts/garmin_fetch.py --days 30 --cn")


if __name__ == "__main__":
    main()
