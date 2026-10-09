import os
import sys

def format_size(bytes_val):
    for unit in ['B', 'KB', 'MB', 'GB', 'TB']:
        if bytes_val < 1024.0:
            return f"{bytes_val:.2f} {unit}"
        bytes_val /= 1024.0
    return f"{bytes_val:.2f} PB"

def analyze_paths(paths):
    total_pairs = 0
    total_heic_savings = 0
    total_jpg_savings = 0

    # Avoid scanning the same canonical folder twice if nested or duplicated
    seen_files = set()

    for target in paths:
        if not os.path.isdir(target):
            print(f"Skipping (not a directory): {target}", file=sys.stderr)
            continue

        for root, _, files in os.walk(target):
            entries = {}
            for f in files:
                stem, ext = os.path.splitext(f)
                ext_lower = ext.lower()
                if ext_lower in ['.heic', '.jpg', '.jpeg']:
                    full_path = os.path.abspath(os.path.join(root, f))
                    if full_path in seen_files:
                        continue
                    seen_files.add(full_path)

                    try:
                        size = os.path.getsize(full_path)
                        entries.setdefault(stem.lower(), {})[ext_lower] = size
                    except OSError:
                        continue

            for stem, exts in entries.items():
                has_heic = '.heic' in exts
                jpg_ext = '.jpg' if '.jpg' in exts else ('.jpeg' if '.jpeg' in exts else None)

                if has_heic and jpg_ext:
                    total_pairs += 1
                    total_heic_savings += exts['.heic']
                    total_jpg_savings += exts[jpg_ext]

    print(f"Duplicate pairs found: {total_pairs:,}")
    print(f"Space reclaimed if removing JPGs  : {format_size(total_jpg_savings)} ({total_jpg_savings:,} bytes)")
    print(f"Space reclaimed if removing HEICs : {format_size(total_heic_savings)} ({total_heic_savings:,} bytes)")

if __name__ == '__main__':
    target_dirs = sys.argv[1:] if len(sys.argv) > 1 else ['.']
    analyze_paths(target_dirs)
