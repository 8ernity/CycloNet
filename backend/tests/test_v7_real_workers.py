"""Independent process contenders against isolated real Redis keys."""
import os
import subprocess
import sys
import time
from test_v5_infrastructure import infrastructure


def test_independent_processes_cannot_both_hold_the_lease(infrastructure):
    _,_,client,key=infrastructure
    program='''
import os,time,redis
from app.core.process_lock import ACQUIRE_LOCK_LUA
client=redis.from_url(os.environ['TEST_REDIS_URL'])
time.sleep(max(0,float(os.environ['START_AT'])-time.time()))
print(client.eval(ACQUIRE_LOCK_LUA,2,os.environ['LEASE_KEY'],os.environ['LEASE_KEY']+':generation',str(os.getpid()),2,0))
'''
    env={**os.environ,'START_AT':str(time.time()+1),'LEASE_KEY':key}
    workers=[subprocess.Popen([sys.executable,'-c',program],env=env,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True) for _ in range(2)]
    try:
        results=[]
        for process in workers:
            output,errors=process.communicate(timeout=15)
            assert process.returncode==0,errors
            results.append(int(output.strip()))
        assert sum(value>0 for value in results)==1
        first=max(results)
        deadline=time.monotonic()+5
        while client.exists(key) and time.monotonic()<deadline:
            time.sleep(.1)
        from app.core.process_lock import ACQUIRE_LOCK_LUA,RENEW_LOCK_LUA
        second=int(client.eval(ACQUIRE_LOCK_LUA,2,key,key+':generation','replacement',10,0))
        assert second>first
        for process in workers:
            assert client.eval(RENEW_LOCK_LUA,1,key,str(process.pid),10)==0
    finally:
        for process in workers:
            if process.poll() is None:
                process.kill();process.wait()
