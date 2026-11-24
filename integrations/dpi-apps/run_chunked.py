#!/usr/bin/env python3
import os, re, ssl, socket, json, time

BASE = os.path.dirname(os.path.abspath(__file__))
SUBS = os.path.join(BASE, 'subs', 'all_links.txt')
RESULT = os.path.join(BASE, 'dpi_chunk_results.json')

def load(n=15):
    t=[]
    try:
        with open(SUBS) as f:
            for line in f:
                m=re.search(r'@([^:]+):(\d+)', line.strip())
                if m:
                    h,p=m.group(1),int(m.group(2))
                    if (h,p) not in t:
                        t.append((h,p)); 
                        if len(t)>=n: break
    except: pass
    return t

def tcp(h,p,to=4):
    s=time.time()
    try:
        c=socket.create_connection((h,p),timeout=to); c.close()
        return {'ok':True,'ms':round((time.time()-s)*1000,1)}
    except Exception as e:
        return {'ok':False,'err':type(e).__name__,'ms':round((time.time()-s)*1000,1)}

def tls(h,p,sni=None,to=5):
    s=time.time()
    try:
        if sni is None:
            ctx=ssl._create_unverified_context()
            with socket.create_connection((h,p),timeout=to) as c:
                ss=ctx.wrap_socket(c); v=ss.version(); ss.close()
                return {'ok':True,'tls':v,'ms':round((time.time()-s)*1000,1)}
        else:
            ctx=ssl.create_default_context()
            with socket.create_connection((h,p),timeout=to) as c:
                ss=ctx.wrap_socket(c,server_hostname=sni); v=ss.version(); ss.close()
                return {'ok':True,'tls':v,'ms':round((time.time()-s)*1000,1)}
    except Exception as e:
        return {'ok':False,'err':type(e).__name__,'ms':round((time.time()-s)*1000,1)}

if __name__=='__main__':
    t=load()
    out=[]
    for h,p in t:
        out.append({
            't':f'{h}:{p}',
            'tcp':tcp(h,p),
            'real':tls(h,p,sni=h),
            'fake':tls(h,p,sni='example.com'),
            'none':tls(h,p,sni=None),
        })
    with open(RESULT,'w') as f:
        json.dump(out,f,indent=2)
    print('done', len(out))
