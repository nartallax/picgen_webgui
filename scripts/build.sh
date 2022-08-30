#!/usr/bin/env bash

set -e
cd `dirname "$0"`
cd ..

if [ ! -d "./node_modules" ] ; then
    npm install
    ./node_modules/.bin/package_syncer --remember
else
    ./node_modules/.bin/package_syncer
fi

rm -rf ./target
./node_modules/.bin/imploder --tsconfig tsconfig.json --profile server
./node_modules/.bin/imploder --tsconfig tsconfig.json --profile client
cp -r static/* target/