import os
import shutil
import sys

MacDevtools = os.path.join(os.path.expanduser("~"), "Library/Application Support/微信开发者工具/50a7d9210159a32f006158795f893857/WeappPlugin/inspector") 
WinDevtools = ""
def copy(src_dir, dst_dir):
    try:
        # 递归拷贝目录树
        shutil.copytree(src_dir, dst_dir, ignore=shutil.ignore_patterns("manifest.json", ".git", "replace.py"), dirs_exist_ok=True)
        print(f"成功将 {src_dir} 拷贝到 {dst_dir}")
    except Exception as e:
        print(f"拷贝目录时出错: {e}")

# 使用示例
if __name__ == "__main__":
    print(os.path.dirname(os.path.abspath(__file__)))
    print (f"MacDevtools: {MacDevtools}")
    if not os.path.exists(MacDevtools):
        sys.exit("微信开发者工具目录不存在，请检查路径")

    copy(os.path.dirname(os.path.abspath(__file__)), MacDevtools)
