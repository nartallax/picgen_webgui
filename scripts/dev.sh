#!/usr/bin/env bash

set -e
cd `dirname "$0"`
cd ..

scripts/build.sh development

node target/server.js --http-root ./target/ --config config.example.json