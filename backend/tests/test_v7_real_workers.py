"""Independent process contenders against isolated real Redis keys."""
import os
import subprocess
import sys
import time
from test_v5_infrastructure import infrastructure


def test_independent_processes_cannot_both_hold_the_lease(infrastructure):
    _,_,client,key=infrastructure
    program='''
import os,sys,redis
from app.core.process_lock import ACQUIRE_LOCK_LUA
client=redis.from_url(os.environ['TEST_REDIS_URL'],socket_timeout=5,socket_connect_timeout=5)
client.rpush(os.environ['LEASE_KEY']+':ready',str(os.getpid()))
assert sys.stdin.readline().strip() == 'acquire'
print(client.eval(ACQUIRE_LOCK_LUA,2,os.environ['LEASE_KEY'],os.environ['LEASE_KEY']+':generation',str(os.getpid()),30,0))
'''
    env={**os.environ,'LEASE_KEY':key}
    workers=[subprocess.Popen([sys.executable,'-c',program],env=env,stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True) for _ in range(2)]
    try:
        # Import time is not contention. Release both already-ready processes
        # together, so a slow Windows spawn cannot outlive the winner's lease.
        deadline=time.monotonic()+60
        while client.llen(key+':ready') != 2:
            assert all(process.poll() is None for process in workers), 'Contender exited before the barrier'
            assert time.monotonic()<deadline, 'Contenders did not reach the readiness barrier'
            time.sleep(.05)
        for process in workers:
            process.stdin.write('acquire\n')
            process.stdin.flush()
        results=[]
        for process in workers:
            output,errors=process.communicate(timeout=15)
            assert process.returncode==0,errors
            results.append(int(output.strip()))
        assert sum(value>0 for value in results)==1
        first=max(results)
        assert client.exists(key), 'Winning lease must remain held until both contenders finish'
        client.pexpire(key,500)
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
        client.delete(key+':ready')
