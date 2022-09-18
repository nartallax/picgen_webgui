#!/usr/bin/env bash

set -e
cd `dirname "$0"`
cd ..

scripts/build.sh release

mkdir _static
mv target/* _static/
mv _static target/static
cd target
mv static/server.js ./server.js
cp ../picture_generator_example.js ./
cp ../config.example.json ./
cp ../shape_tags.json ./
cp ../content_tags.json ./
cp ../README.md ./
cp ../package.json ./
cp ../package-lock.json ./

ARCHIVE_NAME=picgen_webgui.zip
zip -r "$ARCHIVE_NAME" ./*
echo "Completed! Output file is $ARCHIVE_NAME."