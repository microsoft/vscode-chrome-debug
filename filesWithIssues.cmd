@echo off
cls && npm run build | sed -e 's/ .*//g' | grep ^src | sed -e 's/(.*//g' | uniq | sed -e 's/src/code -g src/g'
