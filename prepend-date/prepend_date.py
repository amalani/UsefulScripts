#!/usr/bin/env python3
"""
prepend_date.py — Prepend YYYYMMDD_ (modification date) to filenames in a folder.

Usage:
    python prepend_date.py /path/to/folder           # dry run (preview only)
    python prepend_date.py /path/to/folder --apply   # actually rename files
    python prepend_date.py /path/to/folder --apply --recursive   # include subfolders
    python prepend_date.py /path/to/folder --apply --use-ctime   # use creation date*

* On Linux, "creation time" isn't reliably stored; ctime is the metadata-change time.
  On macOS, --use-ctime uses the true birth time via st_birthtime.
"""

import os
import sys
import argparse
from datetime import datetime
from pathlib import Path


def get_date_prefix(path: Path, use_ctime: bool) -> str:
    stat = path.stat()
    if use_ctime:
        # macOS exposes true birth time via st_birthtime; Linux falls back to ctime
        ts = getattr(stat, "st_birthtime", stat.st_ctime)
    else:
        ts = stat.st_mtime
    return datetime.fromtimestamp(ts).strftime("%Y%m%d")


def already_prefixed(name: str) -> bool:
    """Return True if filename already starts with YYYYMMDD_."""
    parts = name.split("_", 1)
    return len(parts) == 2 and len(parts[0]) == 8 and parts[0].isdigit()


def collect_files(folder: Path, recursive: bool):
    this_script = Path(__file__).resolve()
    if recursive:
        return [p for p in folder.rglob("*") if p.is_file() and p.resolve() != this_script]
    else:
        return [p for p in folder.iterdir() if p.is_file() and p.resolve() != this_script]


def rename_files(folder: Path, apply: bool, recursive: bool, use_ctime: bool):
    files = collect_files(folder, recursive)

    if not files:
        print("No files found.")
        return

    skipped, renamed, would_rename = [], [], []

    for file in sorted(files):
        if already_prefixed(file.name):
            skipped.append(file)
            continue

        prefix = get_date_prefix(file, use_ctime)
        new_name = f"{prefix}_{file.name}"
        new_path = file.parent / new_name

        if apply:
            file.rename(new_path)
            renamed.append((file, new_path))
        else:
            would_rename.append((file, new_path))

    # --- Report ---
    if apply:
        print(f"\n✅ Renamed {len(renamed)} file(s):\n")
        for old, new in renamed:
            print(f"  {old.name}")
            print(f"  → {new.name}\n")
    else:
        print(f"\n🔍 DRY RUN — {len(would_rename)} file(s) would be renamed:\n")
        for old, new in would_rename:
            print(f"  {old.name}")
            print(f"  → {new.name}\n")
        if would_rename:
            print("Run with --apply to rename.\n")

    if skipped:
        print(f"⏭  Skipped {len(skipped)} already-prefixed file(s):")
        for f in skipped:
            print(f"  {f.name}")


def main():
    parser = argparse.ArgumentParser(
        description="Prepend YYYYMMDD_ modification date to filenames."
    )
    parser.add_argument("folder", help="Target folder path")
    parser.add_argument(
        "--apply", action="store_true", help="Actually rename files (default: dry run)"
    )
    parser.add_argument(
        "--recursive", action="store_true", help="Process subfolders recursively"
    )
    parser.add_argument(
        "--use-ctime",
        action="store_true",
        help="Use creation/birth time instead of modification time",
    )
    args = parser.parse_args()

    folder = Path(args.folder).expanduser().resolve()
    if not folder.is_dir():
        print(f"Error: '{folder}' is not a directory.")
        sys.exit(1)

    print(f"Folder   : {folder}")
    print(f"Date from: {'creation/birth time' if args.use_ctime else 'modification time'}")
    print(f"Recursive: {args.recursive}")
    print(f"Mode     : {'APPLY' if args.apply else 'DRY RUN'}")

    rename_files(folder, apply=args.apply, recursive=args.recursive, use_ctime=args.use_ctime)


if __name__ == "__main__":
    main()
