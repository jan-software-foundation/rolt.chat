#!/bin/bash

echo "Downloading badges"

for file in public/assets/badges/*; do
    filename=$(basename $file)
    echo $filename
    curl "https://nightly.revolt.chat/assets/badges/$filename" -o "$file" --silent
done
