import {httpRouter} from 'convex/server';
import {httpAction} from './_generated/server';
import {siteAssets} from './siteAssets';

const http=httpRouter();
http.route({
  pathPrefix:'/',method:'GET',
  handler:httpAction(async (_ctx,request) => {
    const url=new URL(request.url);
    let pathname:string;
    try {pathname=decodeURIComponent(url.pathname);} catch {return new Response('Invalid path',{status:400});}
    let asset=siteAssets[pathname==='/'?'/index.html':pathname];
    if (!asset && request.headers.get('Accept')?.includes('text/html') && !pathname.startsWith('/assets/')) asset=siteAssets['/index.html'];
    if(!asset)return new Response('Not found',{status:404,headers:{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store'}});
    const headers={
      'Content-Type':asset.contentType,
      'Cache-Control':asset.immutable?'public, max-age=31536000, immutable':'no-cache',
      'X-Content-Type-Options':'nosniff',
      'Referrer-Policy':'strict-origin-when-cross-origin',
    };
    if(asset.base64){
      const binary=atob(asset.body),bytes=new Uint8Array(binary.length);
      for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);
      return new Response(bytes,{headers});
    }
    return new Response(asset.body,{headers});
  }),
});
export default http;
