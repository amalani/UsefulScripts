import os

def format_size(bytes_val):
    for unit in ['B', 'KB', 'MB', 'GB', 'TB']:
        if bytes_val < 1024.0:
            return f"{bytes_val:.2f} {unit}"
        bytes_val /= 1024.0
    return f"{bytes_val:.2f} PB"

total_pairs = 0
total_heic_savings = 0
total_jpg_savings = 0

for root, _, files in os.walk('.'):
    # Group file extensions by lowercase stem per directory
    entries = {}
    for f in files:
        stem, ext = os.path.splitext(f)
        ext_lower = ext.lower()
        if ext_lower in ['.heic', '.jpg', '.jpeg']:
            path = os.path.join(root, f)
            try:
                size = os.path.getsize(path)
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
