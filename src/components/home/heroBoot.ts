import { HERO_VARIANTS } from '../../data/homeHeroVariants';
import { HOME_SERVICES, INTENT_RULES } from './intent';

/** localStorage key holding the segment the intent engine last settled on. */
export const SEGMENT_STORAGE_KEY = 'gm_intent_segment';
/** `?gm_intent=decks` forces a segment, for testing and for showing the owner. */
export const SEGMENT_PARAM = 'gm_intent';
/** Set on <html> by the script below so React can agree with what was painted. */
export const SEGMENT_ATTRIBUTE = 'data-home-intent';

/**
 * The prerendered homepage always carries the default hero. This script sits
 * right after the hero markup and runs before first paint: when the visitor's
 * interest is already known (forced by URL, stored from earlier pages, or
 * plain from their search term) it rewrites the hero text and photo in place,
 * so they never see the default flash by. It is written as a plain ES5 string
 * so the prerender and the browser bundle emit byte-identical markup.
 */
const BOOT = `(function(V,R,K){try{
var q=new URLSearchParams(location.search),s=q.get(K.p);
if(s==null)s=localStorage.getItem(K.s);
if(!s){var t=[q.get('utm_term'),q.get('utm_campaign'),q.get('utm_content')].join(' ').toLowerCase();
for(var i=0;i<R.length;i++){if(new RegExp(R[i][1]).test(t)){s=R[i][0];break}}}
var v=V[s];if(!v)return;
document.documentElement.setAttribute(K.a,s);
var set=function(k,x){var el=document.querySelector('[data-hero="'+k+'"]');if(el)el.textContent=x};
set('eyebrow',v.e);set('l1',v.h[0]);set('l2',v.h[1]);set('l3',v.h[2]);set('sub',v.s);set('cap1',v.c[0]);set('cap2',v.c[1]);
var img=document.querySelector('[data-hero="img"]');if(img){img.srcset=v.ss;img.src=v.i;img.alt=v.a}
}catch(e){}})`;

export function heroBootScript(): string {
  const variants = Object.fromEntries(
    HOME_SERVICES.map((service) => {
      const v = HERO_VARIANTS[service];
      return [service, { e: v.eyebrow, h: v.headline, s: v.subhead, c: v.caption, i: v.image.src, ss: v.image.srcSet, a: v.image.alt }];
    }),
  );
  const rules = INTENT_RULES.map((rule) => [rule.service, rule.pattern.source]);
  const keys = { p: SEGMENT_PARAM, s: SEGMENT_STORAGE_KEY, a: SEGMENT_ATTRIBUTE };
  // "<" is escaped inside the data only, so no value can close the script tag.
  // The code's own loop comparison has to stay a real "<".
  const data = [variants, rules, keys].map((value) => JSON.stringify(value).replace(/</g, '\\u003c'));
  return `${BOOT}(${data.join(',')})`;
}
