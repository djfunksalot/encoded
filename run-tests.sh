#!/bin/bash

if [ "$1" == "npm" ]; then
    npm test
    exit
fi

if [ -z "$1" ]; then
    bin/test -s -vv -m "not bdd" -k 'not test_indexing'
    exit
fi

if [ "$1" == "indexing" ]; then
    bin/test -s -vv -m "not bdd" -k test_indexing
    exit
fi

if [ "$1" == "bdd" ]; then
    bin/test -v -v --timeout=300 -m "bdd" --tb=short --splinter-implicit-wait 10 --splinter-webdriver chrome --splinter-socket-timeout 300 --chrome-options "--headless --disable-gpu --no-sandbox --disable-dev-shm-usage --disable-extensions --whitelisted-ips --window-size=1920,1080"
    exit
fi

if [ "$1" == "all" ]; then
    npm test
    bin/test -s -vv -m "not bdd" -k 'not test_indexing'
    bin/test -s -vv -m "not bdd" -k test_indexing
    bin/test -v -v --timeout=300 -m "bdd" --tb=short --splinter-implicit-wait 10 --splinter-webdriver chrome --splinter-socket-timeout 300 --chrome-options "--headless --disable-gpu --no-sandbox --disable-dev-shm-usage --disable-extensions --whitelisted-ips"
    exit
fi

