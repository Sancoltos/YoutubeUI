import os
import sys
import json
import platform
import ssl
import urllib.request
import zipfile
import tarfile
import shutil
import subprocess
import argparse
from yt_dlp import YoutubeDL


def update_yt_dlp():
    result = subprocess.run(
        ["pip", "install", "-U", "yt-dlp", "-q"],
        capture_output=True, text=True
    )
    if result.returncode == 0:
        import yt_dlp
        print(json.dumps({"type": "log", "msg": f"yt-dlp version: {yt_dlp.version.__version__}"}))
    else:
        print(json.dumps({"type": "log", "msg": f"Warning: could not update yt-dlp"}))
    sys.stdout.flush()


def check_ffmpeg():
    base_path = os.path.dirname(os.path.abspath(__file__))
    ffmpeg_dir = os.path.join(base_path, "ffmpeg", "bin")
    os.makedirs(ffmpeg_dir, exist_ok=True)

    system = platform.system()
    exe = "ffmpeg.exe" if system == "Windows" else "ffmpeg"
    ffmpeg_path = os.path.join(ffmpeg_dir, exe)

    if os.path.exists(ffmpeg_path):
        print(json.dumps({"type": "log", "msg": "FFmpeg ready."}))
        sys.stdout.flush()
        return ffmpeg_path

    print(json.dumps({"type": "log", "msg": "Installing FFmpeg..."}))
    sys.stdout.flush()

    try:
        ssl.create_default_context()
    except ssl.SSLError:
        ssl._create_default_https_context = ssl._create_unverified_context

    try:
        if system == "Windows":
            url = "https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip"
            zip_path = os.path.join(base_path, "ffmpeg.zip")
            urllib.request.urlretrieve(url, zip_path)
            with zipfile.ZipFile(zip_path, "r") as zip_ref:
                for member in zip_ref.namelist():
                    if member.endswith("ffmpeg.exe"):
                        zip_ref.extract(member, ffmpeg_dir)
                        shutil.move(os.path.join(ffmpeg_dir, member), ffmpeg_path)
                        break
            os.remove(zip_path)

        elif system == "Darwin":
            url = "https://evermeet.cx/ffmpeg/ffmpeg-6.1.zip"
            zip_path = os.path.join(base_path, "ffmpeg.zip")
            urllib.request.urlretrieve(url, zip_path)
            with zipfile.ZipFile(zip_path, "r") as zip_ref:
                for member in zip_ref.namelist():
                    if member.endswith("ffmpeg"):
                        zip_ref.extract(member, ffmpeg_dir)
                        shutil.move(os.path.join(ffmpeg_dir, member), ffmpeg_path)
                        break
            os.chmod(ffmpeg_path, 0o755)
            os.remove(zip_path)

        else:
            url = "https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz"
            tar_path = os.path.join(base_path, "ffmpeg.tar.xz")
            urllib.request.urlretrieve(url, tar_path)
            with tarfile.open(tar_path, "r:xz") as tar_ref:
                for member in tar_ref.getmembers():
                    if member.name.endswith("/ffmpeg"):
                        tar_ref.extract(member, ffmpeg_dir)
                        shutil.move(os.path.join(ffmpeg_dir, os.path.basename(member.name)), ffmpeg_path)
                        break
            os.chmod(ffmpeg_path, 0o755)
            os.remove(tar_path)

        print(json.dumps({"type": "log", "msg": "FFmpeg installed."}))
        sys.stdout.flush()
        return ffmpeg_path

    except Exception as e:
        print(json.dumps({"type": "error", "msg": f"FFmpeg install failed: {e}"}))
        sys.stdout.flush()
        raise


def progress_hook(d):
    if d["status"] == "downloading":
        percent_str = d.get("_percent_str", "0%").strip().replace("%", "")
        try:
            percent = float(percent_str)
        except ValueError:
            percent = 0
        print(json.dumps({
            "type": "progress",
            "percent": percent,
            "speed": d.get("_speed_str", "").strip(),
            "eta": d.get("_eta_str", "").strip(),
            "downloaded": d.get("_downloaded_bytes_str", "").strip(),
            "total": d.get("_total_bytes_str", d.get("_total_bytes_estimate_str", "")).strip(),
        }))
        sys.stdout.flush()
    elif d["status"] == "finished":
        print(json.dumps({"type": "finished", "msg": f"Done: {os.path.basename(d['filename'])}"}))
        sys.stdout.flush()


def download_video(url, output_folder):
    ffmpeg_path = check_ffmpeg()

    ydl_opts = {
        "format": "bestvideo+bestaudio/best",
        "outtmpl": os.path.join(output_folder, "%(title)s.%(ext)s"),
        "ffmpeg_location": os.path.dirname(ffmpeg_path),
        "progress_hooks": [progress_hook],
        "quiet": True,
        "no_warnings": True,
    }

    with YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info(url, download=False)
        title = info.get("title", "Unknown")
        print(json.dumps({"type": "info", "title": title, "duration": info.get("duration", 0)}))
        sys.stdout.flush()
        ydl.download([url])

    print(json.dumps({"type": "done", "msg": "Download complete!"}))
    sys.stdout.flush()


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--url", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--update", action="store_true")
    args = parser.parse_args()

    if args.update:
        update_yt_dlp()

    try:
        download_video(args.url, args.output)
    except Exception as e:
        print(json.dumps({"type": "error", "msg": str(e)}))
        sys.stdout.flush()
        sys.exit(1)
