(()=>{
  const pend=new Map();let n=0;
  const call=(method,...args)=>new Promise((res,rej)=>{
    const id=++n;pend.set(id,{res,rej});
    parent.postMessage({id,method,args},"*");
    setTimeout(()=>{if(pend.has(id)){pend.delete(id);rej(new Error("Tamat masa"))}},120000);
  });
  addEventListener("message",e=>{
    if(e.source!==parent)return;
    const {id,res,err}=e.data||{};const p=pend.get(id);if(!p)return;
    pend.delete(id);err?p.rej(new Error(err)):p.res(res);
  });
  window.os=Object.freeze({
    ai:{ask:t=>call("ai.ask",t)},
    storage:{get:k=>call("storage.get",k),set:(k,v)=>call("storage.set",k,v)},
    printers:{list:()=>call("printers.list"),print:(p,t)=>call("printers.print",p,t)},
    blender:{run:s=>call("blender.run",s)},
    notify:m=>call("notify",m),
    app:window.__APP||{}
  });
})();
