"""Test actual browser scripts and local API without changing managed browser policy.

Start PORT=8765 python app.py first. Requires Playwright + Chromium for tests only.
The bridge is necessary when browser policy blocks direct localhost navigation.
"""
import base64
import http.cookiejar
import json
import os
from pathlib import Path
import urllib.error
import urllib.request
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'tests/artifacts'
OUT.mkdir(exist_ok=True)
API = os.getenv('TEST_API', 'http://127.0.0.1:8765')

def html_for_test():
    html = (ROOT / 'public/index.html').read_text()
    for name in ('style.css', 'office.css'):
        html = html.replace(f'<link rel="stylesheet" href="{name}">', '<style>'+(ROOT/'public'/name).read_text()+'</style>')
    bridge = '''<script>window.fetch=async(url,options={})=>{const r=await window.apiBridge(String(url),options.body||null,options.headers||{});return new Response(r.body,{status:r.status,headers:{'Content-Type':'application/json'}});};</script>'''
    html = html.replace('<script src="assets.js"></script>', bridge+'<script src="assets.js"></script>')
    for name in ('assets.js','online.js','office.js','game.js'):
        code = (ROOT/'public'/name).read_text()
        if name == 'assets.js':
            code=code.replace("'assets/hero.webp'", "'data:image/webp;base64,"+base64.b64encode((ROOT/'public/assets/hero.webp').read_bytes()).decode()+"'")
        if name == 'online.js':
            code=code.replace("if (!/^https?:$/.test(location.protocol))",'if (false)')
        if name == 'game.js':
            code=code.replace("if(location.hostname==='127.0.0.1'&&new URLSearchParams(location.search).has('test'))",'if(true)')
        html=html.replace(f'<script src="{name}"></script>','<script>'+code+'</script>')
    return html

def attach_api(page):
    opener=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
    def bridge(path,body,headers):
        request=urllib.request.Request(API+path,data=body.encode() if body else None,headers={**headers,'Origin':API})
        try:
            with opener.open(request,timeout=8) as response:
                return {'status':response.status,'body':response.read().decode()}
        except urllib.error.HTTPError as error:
            return {'status':error.code,'body':error.read().decode()}
    page.expose_function('apiBridge',bridge)

if __name__ == '__main__':
    result={'errors':[],'checks':[]}
    with sync_playwright() as p:
        browser=p.chromium.launch(executable_path=os.getenv('CHROMIUM','/usr/bin/chromium'),headless=True,args=['--no-sandbox'])
        for label,width,height,mobile in [('desktop',1440,1080,False),('phone',390,844,True),('landscape',844,390,True)]:
            page=browser.new_page(viewport={'width':width,'height':height},is_mobile=mobile,has_touch=mobile)
            page.on('pageerror',lambda e:result['errors'].append(str(e)))
            attach_api(page);page.set_content(html_for_test())
            page.wait_for_function("window.__VIKTOR_TEST__?.state==='menu'")
            page.screenshot(path=str(OUT/f'menu-{label}.png'))
            page.locator('#playerName').fill('Tester '+label)
            page.locator('#startButton').click()
            page.wait_for_function("window.__VIKTOR_TEST__.state==='playing'")
            page.wait_for_timeout(1300)
            assert page.evaluate('!!window.__VIKTOR_TEST__.game.ticket')
            page.screenshot(path=str(OUT/f'game-{label}.png'))
            page.evaluate('window.__VIKTOR_TEST__.end()')
            page.wait_for_function("document.querySelector('#saveStatus').textContent.startsWith('\u0420\u0435\u0437\u0443\u043b\u044c\u0442\u0430\u0442 \u0441\u043e\u0445\u0440\u0430\u043d\u0451\u043d')")
            page.screenshot(path=str(OUT/f'results-{label}.png'))
            page.locator('#overScreen [data-open-board]').click()
            page.wait_for_function("document.querySelector('#boardRows').children.length>0")
            assert page.locator('#boardRows tr.mine').count()==1
            assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
            page.screenshot(path=str(OUT/f'board-{label}.png'))
            result['checks'].append(label+': start, API save, own ranking, no overflow')
            page.close()
        browser.close()
    (OUT/'browser-results.json').write_text(json.dumps(result,indent=2))
    print(json.dumps(result,indent=2))
    assert not result['errors']
