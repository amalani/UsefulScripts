import os
import sys

def format_size(bytes_val):
    for unit in ['B', 'KB', 'MB', 'GB', 'TB']:
        if bytes_val < 1024.0:
            return f"{bytes_val:.2f} {unit}"
        bytes_val /= 1024.0
    return f"{bytes_val:.2f} PB"

def scan_target(target_path, global_seen):
    folder_pairs = 0
    folder_heic = 0
    folder_jpg = 0

    for root, _, files in os.walk(target_path):
        entries = {}
        for f in files:
            stem, ext = os.path.splitext(f)
            ext_lower = ext.lower()
            if ext_lower in ['.heic', '.jpg', '.jpeg']:
                full_path = os.path.abspath(os.path.join(root, f))
                if full_path in global_seen:
                    continue
                global_seen.add(full_path)

                try:
                    size = os.path.getsize(full_path)
                    entries.setdefault(stem.lower(), {})[ext_lower] = size
                except OSError:
                    continue

        for stem, exts in entries.items():
            has_heic = '.heic' in exts
            jpg_ext = '.jpg' if '.jpg' in exts else ('.jpeg' if '.jpeg' in exts else None)

            if has_heic and jpg_ext:
                folder_pairs += 1
                folder_heic += exts['.heic']
                folder_jpg += exts[jpg_ext]

    return folder_pairs, folder_heic, folder_jpg

def main():
    target_dirs = sys.argv[1:] if len(sys.argv) > 1 else ['.']
    global_seen = set()
    results = []

    print("=" * 70)
    print("SCANNING TARGET DIRECTORIES")
    print("=" * 70)

    for path in target_dirs:
        norm_path = os.path.abspath(path)
        if not os.path.isdir(norm_path):
            print(f"\n[SKIP] Not a valid directory: {path}")
            continue

        print(f"\nScanning: {norm_path} ...", flush=True)
        pairs, heic_bytes, jpg_bytes = scan_target(norm_path, global_seen)

        print(f"  Pairs found      : {pairs:,}")
        print(f"  Remove JPGs frees : {format_size(jpg_bytes)} ({jpg_bytes:,} bytes)")
        print(f"  Remove HEICs frees: {format_size(heic_bytes)} ({heic_bytes:,} bytes)")

        results.append({
            'path': path,
            'pairs': pairs,
            'heic_bytes': heic_bytes,
            'jpg_bytes': jpg_bytes
        })

    # Summary section
    total_pairs = sum(r['pairs'] for r in results)
    total_heic = sum(r['heic_bytes'] for r in results)
    total_jpg = sum(r['jpg_bytes'] for r in results)

    print("\n" + "=" * 70)
    print("AGGREGATED SUMMARY")
    print("=" * 70)
    print(f"{'Target Folder':<32} {'Pairs':<10} {'JPG Savings':<14} {'HEIC Savings':<14}")
    print("-" * 70)
    for r in results:
        disp_name = r['path'] if len(r['path']) <= 30 else "..." + r['path'][-27:]
        print(f"{disp_name:<32} {r['pairs']:<10,d} {format_size(r['jpg_bytes']):<14} {format_size(r['heic_bytes']):<14}")
    print("-" * 70)
    print(f"{'TOTAL':<32} {total_pairs:<10,d} {format_size(total_jpg):<14} {format_size(total_heic):<14}")
    print("=" * 70)

if __name__ == '__main__':
    main()
