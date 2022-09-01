#!/usr/bin/env bash

set -e
cd `dirname "$0"`
cd ..

BUILD_MODE="$1"

if [ ! -d "./node_modules" ] ; then
    npm install
    ./node_modules/.bin/package_syncer --remember
else
    ./node_modules/.bin/package_syncer
fi

rm -rf ./target
mkdir target
./node_modules/.bin/sass src/client/style_root.scss --style=compressed --no-source-map > ./target/style.css
if [ "$BUILD_MODE" == "release" ]; then
    ./node_modules/.bin/imploder --tsconfig tsconfig.json --profile client_release
else
    ./node_modules/.bin/imploder --tsconfig tsconfig.json --profile client_dev
fi

./node_modules/.bin/imploder --tsconfig tsconfig.json --profile server
cp -r static/* target/