#!/usr/bin/env bash

# this script will take bundle from fontello.com and put all the files from there where they need to be
# to get such bundle, go to fontello.com and upload file fontello/config.json
# then add/remove icons as you like
# and then download the bundle, and run this script like this:
# scripts/use_fontello_bundle.sh ~/Downloads/fontello_bundle.zip
# or something like that.
# and after next rebuild new icons will be available to the page

# css/fontello-codes.css
# fonts/fontello.eot/ttf/woff/woff2
# config.json
# demo.html

set -e
cd `dirname "$0"`
cd ..

RAW_BUNDLE_PATH=$1

BUNDLE_FILENAME=`basename "$RAW_BUNDLE_PATH"`
BUNDLE_DIRNAME=`echo "$BUNDLE_FILENAME" | sed s/.zip$//g`

cd ./fontello
unzip "$RAW_BUNDLE_PATH"
mv "$BUNDLE_DIRNAME/css/fontello-codes.css" "./fontello-codes.css"
mv "$BUNDLE_DIRNAME/config.json" "./config.json"
mv "$BUNDLE_DIRNAME/demo.html" "./demo.html"
mv "$BUNDLE_DIRNAME/font/fontello.eot" "../static/font/fontello.eot"
mv "$BUNDLE_DIRNAME/font/fontello.ttf" "../static/font/fontello.ttf"
mv "$BUNDLE_DIRNAME/font/fontello.woff" "../static/font/fontello.woff"
mv "$BUNDLE_DIRNAME/font/fontello.woff2" "../static/font/fontello.woff2"
rm -rf "$BUNDLE_DIRNAME"
echo "Done!"