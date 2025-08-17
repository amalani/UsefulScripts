import os
import re
import shutil

# Get the current directory
directory = os.getcwd()

# List of month names to handle both cases (with capital first letter and all lower case)
months = [
    'January', 'February', 'March', 'April', 'May', 'June', 
    'July', 'August', 'September', 'October', 'November', 'December'
]

# Regular expression pattern to match "Year Month"
pattern = re.compile(r'^(\d{4}) (January|February|March|April|May|June|July|August|September|October|November|December)$')

# Iterate over all folders in the directory
for folder in os.listdir(directory):
    match = pattern.match(folder)
    if match:
        year, month = match.groups()
        year_folder = os.path.join(directory, year)
        
        # Create the year folder if it doesn't exist
        if not os.path.exists(year_folder):
            os.makedirs(year_folder)
        
        # Move all files from the "Year Month" folder to the "Year" folder
        source_folder = os.path.join(directory, folder)
        for file_name in os.listdir(source_folder):
            source_file = os.path.join(source_folder, file_name)
            destination_file = os.path.join(year_folder, file_name)
            shutil.move(source_file, destination_file)
            print(f'Moved "{file_name}" from "{folder}" to "{year}"')

        # Remove the now empty "Year Month" folder
        os.rmdir(source_folder)
        print(f'Removed empty folder "{folder}"')

print("Moving completed.")
