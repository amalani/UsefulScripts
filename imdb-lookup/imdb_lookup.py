#!/usr/bin/env python3
"""
Look up a movie file's title on OMDb and open its IMDb page.
Falls back to an IMDb search if no confident match is found.

Usage: imdb_lookup.py "file1.mkv" "file2.mp4" ...
"""

import sys
import os
import re
import json
import urllib.request
import urllib.parse
import webbrowser

# ---- Config ----
CONFIG_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "config.json")


def load_api_key():
    """Read the OMDb API key from config.json (kept out of version control)."""
    try:
        with open(CONFIG_PATH) as f:
            return json.load(f).get("api_key")
    except FileNotFoundError:
        print(f"Config not found: {CONFIG_PATH} (see config.example.json)", file=sys.stderr)
    except (json.JSONDecodeError, OSError) as e:
        print(f"Could not read {CONFIG_PATH}: {e}", file=sys.stderr)
    return None


API_KEY = load_api_key()
OMDB_URL = "https://www.omdbapi.com/"

RELEASE_TAGS = re.compile(
    r"\b(1080p|720p|2160p|4k|bluray|brrip|webrip|web-dl|web dl|hdrip|"
    r"dvdrip|x264|x265|hevc|aac|yify|rarbg|extended|remastered|proper|repack)\b",
    re.IGNORECASE,
)


def sanitize_filename(filepath):
    """Strip extension, delimiters, and release tags; try to isolate title + year."""
    name = os.path.splitext(os.path.basename(filepath))[0]
    name = re.sub(r"[._-]+", " ", name)

    year_match = re.search(r"(19|20)\d{2}", name)
    year = year_match.group(0) if year_match else None

    if year_match:
        # keep only the part before the year as the title candidate
        title = name[: year_match.start()]
    else:
        title = name

    title = RELEASE_TAGS.sub("", title)
    title = re.sub(r"\s+", " ", title).strip()

    return title, year


def omdb_lookup(title, year):
    params = {"apikey": API_KEY, "t": title, "type": "movie"}
    if year:
        params["y"] = year

    url = OMDB_URL + "?" + urllib.parse.urlencode(params)
    try:
        with urllib.request.urlopen(url, timeout=6) as resp:
            data = json.loads(resp.read().decode())
    except Exception as e:
        print(f"OMDb request failed: {e}", file=sys.stderr)
        return None

    if data.get("Response") == "True" and data.get("imdbID"):
        return data["imdbID"]
    return None


def open_imdb_for_file(filepath):
    title, year = sanitize_filename(filepath)

    if not API_KEY or API_KEY == "YOUR_OMDB_API_KEY_HERE":
        print("No API key set, falling back to search.", file=sys.stderr)
        imdb_id = None
    else:
        imdb_id = omdb_lookup(title, year)

    if imdb_id:
        webbrowser.open(f"https://www.imdb.com/title/{imdb_id}/")
    else:
        query = urllib.parse.quote(title)
        webbrowser.open(f"https://www.imdb.com/find/?q={query}")


def main():
    if len(sys.argv) < 2:
        print("Usage: imdb_lookup.py <file1> [file2 ...]", file=sys.stderr)
        sys.exit(1)

    for filepath in sys.argv[1:]:
        open_imdb_for_file(filepath)


if __name__ == "__main__":
    main()
