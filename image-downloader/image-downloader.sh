#!/bin/bash

# chmod +755 image-downloader.sh

# Function to display usage information
usage() {
    echo "Usage: $0 -u base_url [-p padded_digits] [-d directory] [-t filename_text] [-s filename_suffix] [-e file_extension] [-m mode] [-l upper_limit]"
    echo "  -u  Base URL (required)"
    echo "  -p  Number of padded digits (optional, default: no padding)"
    echo "  -d  Directory to save files (optional, default: current directory)"
    echo "  -t  Custom text to add to filenames (optional)"
    echo "  -s  Custom filename suffix to add to filenames (optional)"
    echo "  -e  File extension (optional, default: jpg)"
    echo "  -m  Mode (optional, 'stop' or 'continue', default: stop)"
    echo "  -l  Upper limit for file counter (optional, required in 'continue' mode)"
    exit 1
}

# Initialize variables
base_url=""
padded_digits=0
directory="."
filename_text=""
filename_suffix=""
file_extension="jpg"
mode="stop"
upper_limit=0

# Parse command-line options
while getopts "u:p:d:t:s:e:m:l:" opt; do
    case $opt in
        u) base_url=$OPTARG ;;
        p) padded_digits=$OPTARG ;;
        d) directory=$OPTARG ;;
        t) filename_text=$OPTARG ;;
        s) filename_suffix=$OPTARG ;;
        e) file_extension=$OPTARG ;;
        m) mode=$OPTARG ;;
        l) upper_limit=$OPTARG ;;
        *) usage ;;
    esac
done

# Check if base_url is set
if [ -z "$base_url" ]; then
    usage
fi

# Validate mode and upper limit
if [ "$mode" == "continue" ] && [ "$upper_limit" -le 0 ]; then
    echo "Error: Upper limit must be specified and greater than 0 in 'continue' mode."
    exit 1
fi

# Create directory if it doesn't exist
mkdir -p "$directory"

# Initialize the counter
i=0

# Start the loop
while true; do
    # Stop if the counter exceeds the upper limit in 'continue' mode
    if [ "$mode" == "continue" ] && [ "$i" -gt "$upper_limit" ]; then
        break
    fi

    # Construct the filename and URL with or without padded digits and custom text
    if [ $padded_digits -gt 0 ]; then
        filename=$(printf "%s%0${padded_digits}d%s.%s" "$filename_text" $i "$filename_suffix" "$file_extension")
    else
        filename="${filename_text}${i}${filename_suffix}.${file_extension}"
    fi
    url="${base_url}${filename}"

    # Check if the file already exists in the directory
    if [ -f "${directory}/${filename}" ]; then
        echo "File already exists: ${directory}/${filename}"
    else
        # Check if the file exists on the server using wget --spider
        if wget --spider "$url" 2>&1 | grep -qE '404 Not Found|403 Forbidden'; then
            echo "File not found: $url"
            if [ "$mode" == "stop" ]; then
                break
            else
                i=$((i + 1))
                continue
            fi
        fi

        # Download the file to the specified directory
        echo "Downloading: $url"
        wget -q --show-progress -c -O "${directory}/${filename}" "$url"
    fi

    i=$((i + 1))
done
