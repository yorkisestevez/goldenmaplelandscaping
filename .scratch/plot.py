import json,sys
import matplotlib; matplotlib.use('Agg')
import matplotlib.pyplot as plt
d=json.load(open('.scratch/dump.json'))
fig,ax=plt.subplots(figsize=(14,20))
def poly(r,**k):
    xs=[p['x']/12 for p in r]+[r[0]['x']/12]; ys=[p['y']/12 for p in r]+[r[0]['y']/12]; ax.plot(xs,ys,**k)
for f in d['features']:
    for r in f['rings']: poly(r,color='tan' if f['kind']=='patio' else 'gray',lw=1)
for r in d['pools']: poly(r,color='blue')
for h in d['house']: poly(h,color='k')
poly(d['deck'],color='brown')
for o in d['objects']:
    r=[{'x':p['x'],'y':p['z']} for p in o['ring']]
    poly(r,color='green' if o['kind']=='bed' else 'purple',lw=.8)
    if o['kind']=='bed': ax.text(sum(p['x'] for p in r)/len(r)/12,sum(p['y'] for p in r)/len(r)/12,o['id'],color='green',fontsize=7)
cols={'scope':'red','liv':'orange','fusion_22':'gold','paver_40':'y','inground_2ss':'c','liv_wall':'m','puck':'k','evo_hyde':'b','pool_niche_led':'navy','halo_down':'k','evo_down':'k','mini_scope_ceiling':'r','dot_22':'gold'}
for f in d['fixtures']:
    ax.plot(f['x']/12,f['z']/12,'o',ms=4,color=cols.get(f['productId'],'gray'))
for p in d['posts']: ax.plot(p['x']/12,p['z']/12,'s',ms=3,mfc='none',color='k')
ax.set_aspect('equal'); ax.grid(True,lw=.3); ax.set_xticks(range(-40,66,4)); ax.set_yticks(range(-36,130,4)); ax.invert_yaxis()
plt.savefig(sys.argv[1] if len(sys.argv)>1 else '.scratch/plan.png',dpi=110,bbox_inches='tight')
