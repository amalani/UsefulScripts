#!/bin/bash

# chmod +755 image-downloader.sh

# Function to display usage information
usage() {
    echo "Usage: $0 -u base_url [-p padded_digits] [-d directory] [-t filename_text] [-s filename_suffix] [-e file_extension]"
    echo "  -u  Base URL (required)"
    echo "  -p  Number of padded digits (optional, default: no padding)"
    echo "  -d  Directory to save files (optional, default: current directory)"
    echo "  -t  Custom text to add to filenames (optional)"
    echo "  -s  Custom filename suffix to add to filenames (optional)"
    echo "  -e  File extension (optional, default: jpg)"
    exit 1
}

# Initialize variables
base_url=""
padded_digits=0
directory="."
filename_text=""
filename_suffix=""
file_extension="jpg"

# Parse command-line options
while getopts "u:p:d:t:s:e:" opt; do
    case $opt in
        u) base_url=$OPTARG ;;
        p) padded_digits=$OPTARG ;;
        d) directory=$OPTARG ;;
        t) filename_text=$OPTARG ;;
        s) filename_suffix=$OPTARG ;;
        e) file_extension=$OPTARG ;;
        *) usage ;;
    esac
done

# Check if base_url is set
if [ -z "$base_url" ]; then
    usage
fi

# Create directory if it doesn't exist
mkdir -p "$directory"

# Initialize the counter
i=1

# Start the loop
while true; do
    # Construct the filename and URL with or without padded digits and custom text
    if [ $padded_digits -gt 0 ]; then
        filename=$(printf "%s%0${padded_digits}d.%s" "$filename_text" $i "$filename_suffix" "$file_extension")
    else
        filename="${filename_text}${i}${filename_suffix}.${file_extension}"
    fi
    url="${base_url}${filename}"

    # echo $url
    # break

    # Check if the file already exists in the directory
    if [ -f "${directory}/${filename}" ]; then
        # Get the size of the local file
        local_size=$(stat -f%z "${directory}/${filename}")

        # Get the size of the remote file
        remote_size=$(wget --spider "$url" 2>&1 | grep 'Length:' | awk '{print $2}')
        
        if [ "$local_size" -eq "$remote_size" ]; then
            echo "File already exists and is the same size: ${directory}/${filename}"
        else
            echo "File size differs, downloading again: ${directory}/${filename}"
            wget -q --show-progress -c -O "${directory}/${filename}" "$url"
        fi
    else
        # Check if the file exists on the server using wget --spider
        if wget --spider "$url" 2>&1 | grep -qE '404 Not Found|403 Forbidden'; then
            echo "File not found: $url"
            break
        fi

        echo "tring to download"
        # Download the file to the specified directory
        wget -q --show-progress -c -O "${directory}/${filename}" "$url"
    fi

    i=$((i + 1))
done
