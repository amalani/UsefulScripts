#!/bin/bash

# rename_sequential.sh
# Renames files in a folder sequentially (01, 02, ...) sorted by download order (birth time).
# Usage:
#   ./rename_sequential.sh             → renames files in current directory, number only (e.g. 01.jpg)
#   ./rename_sequential.sh -k          → keeps original name (e.g. 01_photo.jpg)
#   ./rename_sequential.sh /path/to/folder
#   ./rename_sequential.sh /path/to/folder -k

KEEP_NAME=false
TARGET_DIR="."
SCRIPT_NAME="$(basename "$0")"

# Parse arguments
for arg in "$@"; do
  case "$arg" in
    -k|--keep-name) KEEP_NAME=true ;;
    -*) echo "Unknown option: $arg"; exit 1 ;;
    *) TARGET_DIR="$arg" ;;
  esac
done

if [ ! -d "$TARGET_DIR" ]; then
  echo "Error: '$TARGET_DIR' is not a valid directory."
  exit 1
fi

cd "$TARGET_DIR" || exit 1

# Collect files sorted by birth time (creation/download time), excluding this script
mapfile -d '' FILES < <(
  find . -maxdepth 1 -type f ! -name "$SCRIPT_NAME" -print0 \
  | xargs -0 stat -f '%DB %N' \
  | sort -n \
  | awk '{$1=""; print substr($0,2)}' \
  | tr '\n' '\0'
)

TOTAL=${#FILES[@]}

if [ "$TOTAL" -eq 0 ]; then
  echo "No files found in '$TARGET_DIR'."
  exit 0
fi

echo "Found $TOTAL file(s) to rename in '$TARGET_DIR'."
echo "Mode: $([ "$KEEP_NAME" = true ] && echo 'number + original name' || echo 'number only')"
echo ""

COUNTER=1
for FILEPATH in "${FILES[@]}"; do
  # Strip leading ./
  FILENAME="${FILEPATH#./}"
  EXT="${FILENAME##*.}"
  BASENAME="${FILENAME%.*}"

  # Handle files with no extension
  if [ "$FILENAME" = "$EXT" ]; then
    EXT=""
  fi

  NUM=$(printf "%02d" "$COUNTER")

  if [ "$KEEP_NAME" = true ]; then
    if [ -n "$EXT" ]; then
      NEW_NAME="${NUM}_${BASENAME}.${EXT}"
    else
      NEW_NAME="${NUM}_${BASENAME}"
    fi
  else
    if [ -n "$EXT" ]; then
      NEW_NAME="${NUM}.${EXT}"
    else
      NEW_NAME="${NUM}"
    fi
  fi

  if [ "$FILENAME" = "$NEW_NAME" ]; then
    echo "  [skip]    $FILENAME (already named correctly)"
  else
    mv -- "$FILENAME" "$NEW_NAME"
    echo "  [renamed] $FILENAME → $NEW_NAME"
  fi

  COUNTER=$((COUNTER + 1))
done

echo ""
echo "Done. $TOTAL file(s) processed."
