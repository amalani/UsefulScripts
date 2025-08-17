import os
import re

# Get the current directory
directory = os.getcwd()

# List of month names to handle both cases (with capital first letter and all lower case)
months = [
    'January', 'February', 'March', 'April', 'May', 'June', 
    'July', 'August', 'September', 'October', 'November', 'December'
]

# Regular expression pattern to match "Month Year"
pattern = re.compile(r'^(January|February|March|April|May|June|July|August|September|October|November|December) (\d{4})$')

# Iterate over all folders in the directory
for folder in os.listdir(directory):
    match = pattern.match(folder)
    if match:
        month, year = match.groups()
        new_folder_name = f"{year} {month}"
        os.rename(folder, new_folder_name)
        print(f'Renamed "{folder}" to "{new_folder_name}"')

print("Renaming completed.")
