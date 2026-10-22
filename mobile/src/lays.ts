export type LayLeg = {symbol:string;title:string;opposite:string;side:'yes'|'no'};
export type Lay = {v:1;name:string;legs:LayLeg[];source?:string;stake?:number;confirmed?:boolean};
const prefix='LAY/1 ';
export function readLay(body:string):Lay|null {
  if(!body.startsWith(prefix))return null;
  try {
    const p=JSON.parse(body.slice(prefix.length));
    if(p.v!==1||typeof p.name!=='string'||p.name.length>60||!Array.isArray(p.legs)||p.legs.length<2||p.legs.length>6)return null;
    if(!p.legs.every((l:LayLeg)=>l&&['symbol','title','opposite'].every(k=>typeof (l as any)[k]==='string'&&(l as any)[k].length>0&&(l as any)[k].length<=160)&&(l.side==='yes'||l.side==='no')))return null;
    if(new Set(p.legs.map((l:LayLeg)=>l.symbol)).size!==p.legs.length)return null;
    if(p.source!==undefined&&(typeof p.source!=='string'||p.source.length>100))return null;
    if(p.confirmed!==undefined&&typeof p.confirmed!=='boolean')return null;
    if(p.stake!==undefined&&(!Number.isFinite(p.stake)||p.stake<=0||p.stake>10000))return null;
    return p;
  }catch{return null;}
}
export function writeLay(lay:Lay):string {
  const body=prefix+JSON.stringify(lay);
  if(body.length>2000||!readLay(body))throw Error('Keep your lay to 2–6 distinct markets and a short name.');
  return body;
}
