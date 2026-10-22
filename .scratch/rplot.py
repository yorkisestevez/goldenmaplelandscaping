import json,matplotlib;matplotlib.use('Agg');import matplotlib.pyplot as plt
D=json.load(open('/workspace/sage/lit146/.scratch/rplot.json'));f,ax=plt.subplots(figsize=(10,12))
def ring(r,**k):
  if r and isinstance(r[0],list): [ring(x,**k) for x in r];return
  if not r: return
  xs=[p['x']/12 for p in r]+[r[0]['x']/12];ys=[p['y']/12 for p in r]+[r[0]['y']/12];ax.plot(xs,ys,**k)
for h in D['house']: ring(h,color='k')
for dk in D['deck']: ring(dk,color='brown')
for ft in D['feat']: ring(ft['r'],color='orange'); 
for p in D['pools']:
  try: ring(p,color='blue')
  except Exception as e: print(e,str(p)[:200])
for o in D['objs']:
  if o.get('poly'): ax.plot([q['x']/12 for q in o['poly']]+[o['poly'][0]['x']/12],[q['z']/12 for q in o['poly']]+[o['poly'][0]['z']/12],color='green',lw=.5)
  elif o['k']=='plant': ax.plot(o['x']/12,o['z']/12,'g.',ms=1.5)
  else: ax.plot(o['x']/12,o['z']/12,'rs',ms=3)
ax.set_aspect('equal');ax.grid(True);plt.savefig('/workspace/sage/paradise/resort-plan.png',dpi=70)
