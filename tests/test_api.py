"""Dependency-free API, persistence and security regression tests."""
import concurrent.futures
import io
import json
import os
import sqlite3
import subprocess
import sys
import tarfile
import tempfile
import time
import unittest
from pathlib import Path
from wsgiref.util import setup_testing_defaults
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from app import RunnerApp, score_for

class Client:
    def __init__(self,app): self.app,self.cookie,self.csrf=app,'',''
    def request(self,path,body=None,headers=None,method=None,raw=None):
        env={};setup_testing_defaults(env)
        env.update(REQUEST_METHOD=method or ('POST' if body is not None or raw else 'GET'),HTTP_HOST='test.local',REMOTE_ADDR='127.0.0.1',HTTP_COOKIE=self.cookie,HTTP_X_CSRF_TOKEN=self.csrf,HTTP_ORIGIN='http://test.local')
        env['PATH_INFO'],_,env['QUERY_STRING']=path.partition('?')
        if body is not None or raw is not None:
            data=raw if raw is not None else json.dumps(body).encode()
            env.update(CONTENT_TYPE='application/json',CONTENT_LENGTH=str(len(data)),**{'wsgi.input':io.BytesIO(data)})
        env.update(headers or {});result={}
        def start(status,headers):result.update(status=int(status.split()[0]),headers=dict(headers))
        payload=b''.join(self.app(env,start))
        result['body']=json.loads(payload) if payload and 'application/json' in result['headers'].get('Content-Type','') else payload
        if 'Set-Cookie' in result['headers']:self.cookie=result['headers']['Set-Cookie'].split(';')[0]
        return result
    def session(self):
        r=self.request('/api/session');self.csrf=r['body']['csrf_token'];return r
    def start(self,name='Tester'):
        if not self.csrf:self.session()
        return self.request('/api/runs/start',{'name':name})

class APITests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory();self.app=RunnerApp(self.tmp.name,testing=True);self.c=Client(self.app);self.c.session()
    def tearDown(self):self.tmp.cleanup()
    def body(self,c=None,**kw):
        c=c or self.c
        result=dict(run_id=c.start()['body']['run_id'],distance=40,coins=2,kills=1,sidejobs=1,bonuses=1,elapsed_ms=1000);result.update(kw);return result
    def save(self,c=None,**kw):
        c=c or self.c;return c.request('/api/runs/finish',self.body(c,**kw))
    def test_score(self):
        b=self.body(score=999999);r=self.c.request('/api/runs/finish',b)
        self.assertEqual(r['status'],200);self.assertEqual(r['body']['score'],1690);self.assertEqual(score_for(b),1690)
    def test_idempotent(self):
        b=self.body();self.c.request('/api/runs/finish',b)
        self.assertTrue(self.c.request('/api/runs/finish',b)['body']['duplicate']);b['distance']+=1
        self.assertEqual(self.c.request('/api/runs/finish',b)['status'],409)
    def test_csrf_origin(self):
        for h in [{'HTTP_X_CSRF_TOKEN':''},{'HTTP_ORIGIN':'https://evil.example'},{'HTTP_SEC_FETCH_SITE':'cross-site'}]:
            self.assertEqual(self.c.request('/api/runs/start',{'name':'Alice'},h)['status'],403)
        other=Client(self.app);other.csrf=self.c.csrf
        self.assertEqual(other.request('/api/runs/start',{'name':'Alice'})['status'],403)
    def test_names(self):
        for name in ['', 'a','x'*25,'<script>x</script>','a\x00b',['Alice']]:self.assertEqual(self.c.start(name)['status'],400)
        self.assertEqual(self.c.start('  Alice_99 ')['body']['name'],'Alice_99')
    def test_fields_and_plausibility(self):
        for field,value in [('coins',True),('distance',-1),('kills','2'),('bonuses',1.5)]:
            b=self.body();b[field]=value;self.assertEqual(self.c.request('/api/runs/finish',b)['status'],400)
        for fields in [dict(distance=100000),dict(elapsed_ms=10),dict(elapsed_ms=7300000),dict(elapsed_ms=100000)]:
            self.assertEqual(self.c.request('/api/runs/finish',self.body(**fields))['status'],422)
    def test_ownership(self):
        other=Client(self.app);other.session()
        self.assertEqual(other.request('/api/runs/finish',self.body())['status'],404)
    def test_best_and_personal_rank(self):
        self.save(distance=25);self.save(distance=40);other=Client(self.app);other.session();self.save(other,distance=50)
        b=self.c.request('/api/leaderboard?limit=1')['body']
        self.assertEqual(b['players'],2);self.assertEqual(len(b['entries']),1);self.assertEqual(b['me']['rank'],2);self.assertEqual(b['me']['distance'],40)
    def test_periods(self):
        self.save()
        with self.app.connect() as db:db.execute('UPDATE runs SET submitted_at=?',(time.time()-2*86400,))
        self.assertEqual(self.c.request('/api/leaderboard?period=day')['body']['players'],0)
        self.assertEqual(self.c.request('/api/leaderboard?period=week')['body']['players'],1)
        with self.app.connect() as db:db.execute('UPDATE runs SET submitted_at=?',(time.time()-9*86400,))
        self.assertEqual(self.c.request('/api/leaderboard?period=week')['body']['players'],0)
        self.assertEqual(self.c.request('/api/leaderboard')['body']['players'],1)
    def test_restart(self):
        self.save();old=(self.c.cookie,self.c.csrf);self.c.app=RunnerApp(self.tmp.name,testing=True);self.c.session()
        self.assertEqual(old,(self.c.cookie,self.c.csrf));self.assertEqual(self.c.request('/api/leaderboard')['body']['me']['score'],1690)
    def test_expiry_and_abandoned(self):
        b=self.body()
        with self.app.connect() as db:db.execute('UPDATE runs SET started_at=?',(time.time()-25*3600,))
        self.assertEqual(self.c.request('/api/runs/finish',b)['status'],410)
        for _ in range(11):self.c.start()
        with self.app.connect() as db:self.assertEqual(db.execute('SELECT COUNT(*) FROM runs').fetchone()[0],8)
    def test_concurrent_save(self):
        b=self.body();pid=self.c.cookie.split('=')[1].split('.')[0]
        with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:results=list(pool.map(lambda _:self.app.submit_run(pid,b),range(8)))
        self.assertEqual(sum(not r['duplicate'] for r in results),1)
    def test_static_and_etag(self):
        r=self.c.request('/');self.assertEqual(r['status'],200);self.assertNotIn('Set-Cookie',r['headers'])
        self.assertIn("script-src 'self'",r['headers']['Content-Security-Policy'])
        self.assertEqual(self.c.request('/',headers={'HTTP_IF_NONE_MATCH':r['headers']['ETag']})['status'],304)
        self.assertEqual(self.c.request('/',method='HEAD')['body'],b'')
        for path in ['/../app.py','/.env','/assets/../../app.py','/missing']:self.assertEqual(self.c.request(path)['status'],404)
        for path in ['/api/leaderboard?period=bad','/api/leaderboard?limit=999']:self.assertEqual(self.c.request(path)['status'],400)
    def test_bad_json(self):
        for raw,status in [(b'{broken',400),(b'[]',400),(b' '*5000,413)]:self.assertEqual(self.c.request('/api/runs/start',raw=raw)['status'],status)
        self.assertEqual(self.c.request('/api/runs/start',{}, {'CONTENT_TYPE':'text/plain'})['status'],415)
    def test_rate_limit(self):
        self.app.testing=False
        for _ in range(180):self.assertEqual(self.c.request('/api/session')['status'],200)
        r=self.c.request('/api/session');self.assertEqual(r['status'],429);self.assertEqual(r['headers']['Retry-After'],'60')
    def test_backup(self):
        self.save();script=Path(__file__).resolve().parents[1]/'tools/backup.py'
        archive=subprocess.check_output([sys.executable,str(script)],env={**os.environ,'DATA_DIR':self.tmp.name})
        with tarfile.open(fileobj=io.BytesIO(archive),mode='r:gz') as tar:
            self.assertEqual(set(tar.getnames()),{'leaderboard.sqlite3','.session-key'});self.assertEqual(tar.extractfile('.session-key').read(),self.app.key);data=tar.extractfile('leaderboard.sqlite3').read()
        with tempfile.NamedTemporaryFile() as f:
            f.write(data);f.flush();db=sqlite3.connect(f.name)
            try:self.assertEqual(db.execute('SELECT score FROM runs').fetchone()[0],1690)
            finally:db.close()

if __name__=='__main__':unittest.main()
