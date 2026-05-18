#!/usr/bin/env python3
"""
rename_sequential.py
Renames files in a folder sequentially (01, 02, ...) sorted by download order (birth time).

Usage:
  python rename_sequential.py                      # current dir, number only (e.g. 01.jpg)
  python rename_sequential.py -k                   # keep original name (e.g. 01_photo.jpg)
  python rename_sequential.py /path/to/folder
  python rename_sequential.py /path/to/folder -k
"""

import os
import sys
import argparse
from pathlib import Path


def get_birth_time(path: Path) -> float:
    """Return the birth time (creation time) of a file on macOS."""
    return path.stat().st_birthtime


def rename_files(target_dir: Path, keep_name: bool) -> None:
    script_name = Path(__file__).name

    # Collect all files (not dirs), excluding this script
    files = [
        f for f in target_dir.iterdir()
        if f.is_file() and f.name != script_name
    ]

    if not files:
        print(f"No files found in '{target_dir}'.")
        return

    # Sort by birth time (download order)
    files.sort(key=get_birth_time)

    print(f"Found {len(files)} file(s) in '{target_dir}'.")
    print(f"Mode: {'number + original name' if keep_name else 'number only'}\n")

    for counter, filepath in enumerate(files, start=1):
        num = f"{counter:02d}"
        suffix = filepath.suffix  # includes the dot, e.g. '.jpg', or '' if none

        if keep_name:
            stem = filepath.stem
            new_name = f"{num}_{stem}{suffix}" if suffix else f"{num}_{stem}"
        else:
            new_name = f"{num}{suffix}" if suffix else num

        new_path = target_dir / new_name

        if filepath.name == new_name:
            print(f"  [skip]    {filepath.name}  (already named correctly)")
        else:
            filepath.rename(new_path)
            print(f"  [renamed] {filepath.name} → {new_name}")

    print(f"\nDone. {len(files)} file(s) processed.")


def main():
    parser = argparse.ArgumentParser(
        description="Rename files sequentially by download (birth) time."
    )
    parser.add_argument(
        "directory",
        nargs="?",
        default=".",
        help="Target directory (default: current directory)",
    )
    parser.add_argument(
        "-k", "--keep-name",
        action="store_true",
        help="Keep original filename after the number (e.g. 01_photo.jpg)",
    )
    args = parser.parse_args()

    target_dir = Path(args.directory).resolve()
    if not target_dir.is_dir():
        print(f"Error: '{target_dir}' is not a valid directory.")
        sys.exit(1)

    rename_files(target_dir, keep_name=args.keep_name)


if __name__ == "__main__":
    main()
