set -e
cd "$(dirname "$0")/src"
cat game.ts audio.ts app.ts > all.ts
../node_modules/.bin/tsc --noEmit --strict --target es2020 --lib es2020,dom all.ts
../node_modules/.bin/esbuild all.ts --bundle --target=es2019 --minify-whitespace --outfile=bundle.js 2>&1 | tail -1
python3 - <<'PY'
js=open('bundle.js').read()
assert '</script' not in js
open('../index.html','w').write('<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>坦克大战 · 萌萌对战</title></head><body><script>\n'+js+'\n</script></body></html>')
PY
ls -l ../index.html
