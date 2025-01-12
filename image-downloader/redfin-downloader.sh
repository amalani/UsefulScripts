#!/bin/bash

# Redfin url parser for image downloading

# Check if two URLs were passed as arguments
if [ -z "$1" ] || [ -z "$2" ]; then
    # Prompt user for input if arguments are missing
    echo "Enter the first URL: (example: https://www.redfin.com/WA/Kirkland/14816-116th-Pl-NE-98034/home/455138)"
    read -r URL1
    echo "Enter the second URL: (example: https://ssl.cdn-redfin.com/photo/1/bigphoto/441/2308441_2_0.jpg)"
    read -r URL2
else
    # Use arguments as URLs if provided
    URL1=$1
    URL2=$2
fi


# Function to parse the Redfin URL and return parts as a string
parse_redfin_url() {
    local URL=$1

    # Extract parts of the URL
    local PROTOCOL=$(echo "$URL" | awk -F'://' '{print $1}')
    local DOMAIN=$(echo "$URL" | awk -F'/' '{print $3}')
    local STATE=$(echo "$URL" | awk -F'/' '{print $4}')
    local CITY=$(echo "$URL" | awk -F'/' '{print $5}')
    local ADDRESS=$(echo "$URL" | awk -F'/' '{print $6}')
    local HOME_ID=$(echo "$URL" | awk -F'/' '{print $8}')

    # Return parts as a single string
    echo "$PROTOCOL $DOMAIN $STATE $CITY $ADDRESS $HOME_ID"
}

# Function to parse the Redfin image URL and return base URL, ID, and other parts
parse_redfin_image_url() {
    local URL=$1

    # Extract the base URL (everything up to the last '/')
    local BASE_URL=$(echo "$URL" | sed 's|\(.*\)/.*|\1/|')

    # Extract the filename and remove the extension
    local FILENAME=$(basename "$URL")
    local BASENAME="${FILENAME%.*}"

    # Split the BASENAME (e.g., 2308441_2_0) into parts by '_'
    local ID=$(echo "$BASENAME" | cut -d'_' -f1)_
    
    local PART2=$(echo "$BASENAME" | cut -d'_' -f2)
    local PART3=$(echo "$BASENAME" | cut -d'_' -f3)

    # Return parts as a single string
    echo "$BASE_URL $ID $PART2 $PART3"
}

# Call the function and capture returned values
RESULT=$(parse_redfin_url "$URL1")
# Read the returned values into separate variables
read -r PROTOCOL DOMAIN STATE CITY ADDRESS HOME_ID <<< "$RESULT"

# echo "Protocol: $PROTOCOL"
# echo "Domain: $DOMAIN"
# echo "State: $STATE"
# echo "City: $CITY"
echo "Address: $ADDRESS"
echo "Home ID: $HOME_ID"

RESULT=$(parse_redfin_image_url "$URL2")
read -r BASE_URL ID PART2 PART3 <<< "$RESULT"

# Output each part
echo "Base URL: $BASE_URL"
echo "ID: $ID"
# echo "Part 2: $PART2"
# echo "Part 3: $PART3"

LIMIT=50

# ./image-downloader.sh -u https://ssl.cdn-redfin.com/photo/1/bigphoto/441/ -d 14816-116th-Pl-NE-98034 -t 2308441_ -s _0
# Execute 
# Download first image
echo "Downloading first image"
./image-downloader.sh -r ../../../redfin-houses -d $ADDRESS -u $BASE_URL  -t $ID 
# big photo
echo "Downloading big photos"
./image-downloader.sh -m continue -l $LIMIT -r ../../../redfin-houses -d $ADDRESS -u $BASE_URL  -t $ID -s _0 
./image-downloader.sh -m continue -l $LIMIT -r ../../../redfin-houses -d $ADDRESS -u $BASE_URL  -t $ID -s _1
./image-downloader.sh -m continue -l $LIMIT  -r ../../../redfin-houses -d $ADDRESS -u $BASE_URL  -t $ID -s _2 
./image-downloader.sh -m continue -l $LIMIT  -r ../../../redfin-houses -d $ADDRESS -u $BASE_URL  -t $ID -s _3
./image-downloader.sh -m continue -l $LIMIT  -r ../../../redfin-houses -d $ADDRESS -u $BASE_URL  -t $ID -s _4
./image-downloader.sh -m continue -l $LIMIT  -r ../../../redfin-houses -d $ADDRESS -u $BASE_URL  -t $ID -s _5




# medium photo
# https://ssl.cdn-redfin.com/photo/1/mbpaddedwide/011/genMid.2308011_7_2.jpg
echo "Downloading medium photos"
./image-downloader.sh -m continue -l $LIMIT -r ../../../redfin-houses -d $ADDRESS -u https://ssl.cdn-redfin.com/photo/1/mbpaddedwide/011/genMid. -t  $ID -s _2



# parse_url() {
#     local URL=$1
#     local PROTOCOL=$(echo "$URL" | awk -F'://' '{print $1}')
#     local DOMAIN=$(echo "$URL" | awk -F'/' '{print $3}')
#     local PATH=$(echo "$URL" | awk -F'/' '{for (i=4; i<NF; i++) printf "%s/", $i; print $(NF-1)"/"$NF}')
#     local FILENAME=$(basename "$URL")
#     local BASENAME="${FILENAME%.*}"
#     local EXTENSION="${FILENAME##*.}"

#     # Split "2308441_2_0" into individual parts
#     IFS='_' read -r PART1 PART2 PART3 <<< "$BASENAME"

#     # Output each part
#     echo "URL: $URL"
#     echo "Protocol: $PROTOCOL"
#     echo "Domain: $DOMAIN"
#     echo "Path: $PATH"
#     echo "Filename: $FILENAME"
#     echo "Basename: $BASENAME"
#     echo "Extension: $EXTENSION"
#     echo "Part 1: $PART1"
#     echo "Part 2: $PART2"
#     echo "Part 3: $PART3"
#     echo
# }

