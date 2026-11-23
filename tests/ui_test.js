// Ujian UI dalam jsdom. Jalankan: npm install jsdom && node tests/ui_test.js
const {JSDOM, VirtualConsole} = require("jsdom");
const fs=require("fs"), {spawn}=require("child_process"), path=require("path"), os=require("os");
const home=fs.mkdtempSync(path.join(os.tmpdir(),"ui-"));
fs.mkdirSync(home+"/.config/smartos",{recursive:true});
fs.writeFileSync(home+"/.config/smartos/config.json",JSON.stringify({provider:"mock"}));
fs.mkdirSync(home+"/Dokumen",{recursive:true}); fs.writeFileSync(home+"/Dokumen/laporan.txt","x"); fs.writeFileSync(home+"/Dokumen/gambar.png","x"); fs.mkdirSync(home+"/Dokumen/Projek");
const svc=spawn("python3",[path.join(__dirname,"../iso/config/includes.chroot_after_packages/opt/smartos/service/smartos_service.py")],{env:{...process.env,SMARTOS_HOME:home,SMARTOS_PORT:"7898",XDG_RUNTIME_DIR:home,SMARTOS_TEST:"1"}});
const B="http://127.0.0.1:7898"; let ok=0,bad=0; const t=(n,c)=>{c?ok++:bad++;console.log((c?"PASS ":"FAIL ")+n)};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function page(view,extra=""){
  const token=fs.readFileSync(home+"/smartos.token","utf8");
  const errors=[]; const vc=new VirtualConsole(); vc.on("jsdomError",e=>errors.push(e.message)); vc.on("error",e=>errors.push(String(e)));
  const dom=await JSDOM.fromURL(`${B}/shell/index.html?view=${view}&t=${token}${extra}`,{runScripts:"dangerously",resources:"usable",pretendToBeVisual:true,virtualConsole:vc,
    beforeParse(w){ w.fetch=(u,o)=>fetch(new URL(u,B),o); w.matchMedia=w.matchMedia||(()=>({matches:false})); w.HTMLDialogElement.prototype.showModal=function(){this.setAttribute("open","")}; w.HTMLDialogElement.prototype.close=function(){this.removeAttribute("open")}; }});
  await sleep(1200); return {dom,w:dom.window,d:dom.window.document,errors};
}
(async()=>{
  await sleep(1500);
  let p=await page("desktop");
  t("desktop: tiada ralat JS", p.errors.length===0 || (console.log(p.errors),false));
  t("desktop: pintasan lalai dipaparkan", p.d.querySelectorAll(".shortcuts .sc").length>=5);
  t("desktop: jam dipaparkan", p.d.querySelector(".clock").textContent.length>=4);
  t("desktop: pintasan ada Chrome", [...p.d.querySelectorAll(".sc span")].some(s=>s.textContent==="Chrome"));
  p=await page("start");
  t("menu mula: tiada ralat", p.errors.length===0 || (console.log(p.errors),false));
  t("menu mula: senarai app + carian", p.d.querySelectorAll(".start .sc").length>=10 && !!p.d.querySelector(".start input"));
  const inp=p.d.querySelector(".start input"); inp.value="goo"; inp.dispatchEvent(new p.w.Event("input"));
  t("menu mula: tapis 'goo' -> Google sahaja", [...p.d.querySelectorAll(".start .sc span")].every(s=>/google/i.test(s.textContent)) && p.d.querySelectorAll(".start .sc").length>=3);
  p=await page("power"); t("kuasa: 4 butang", p.d.querySelectorAll(".power button").length===4);
  p=await page("store"); t("store: tiada ralat", p.errors.length===0 || (console.log(p.errors),false));
  t("store: kad katalog", p.d.querySelectorAll(".store-grid .card").length>=10);
  t("store: butang Pasang wujud", [...p.d.querySelectorAll(".store-grid button")].some(b=>b.textContent==="Pasang"));
  p=await page("myapps"); t("myapps: tiada ralat", p.errors.length===0 || (console.log(p.errors),false));
  t("myapps: Make a Software + butang Cipta app", p.d.body.textContent.includes("Make a Software") && [...p.d.querySelectorAll("button")].some(b=>b.textContent==="Cipta app"));
  [...p.d.querySelectorAll("button")].find(b=>b.textContent==="Cipta app").click();
  p.d.querySelector("dialog textarea").value="app kaunter"; [...p.d.querySelectorAll("dialog button")].find(b=>b.textContent==="Bina").click(); await sleep(1500);
  t("make: pratonton + kebenaran + imbasan", !!p.d.querySelector("#prev") && p.d.body.textContent.includes("Imbasan kod") && p.d.body.textContent.includes("Simpan data"));
  [...p.d.querySelectorAll("dialog button")].find(b=>b.textContent==="Pasang app").click(); await sleep(1200);
  t("make: app dipasang & muncul dalam My Smart App", p.d.querySelectorAll(".card.app").length===1);
  const appId=(await (await fetch(B+"/api/apps",{headers:{"X-SmartOS-Token":fs.readFileSync(home+"/smartos.token","utf8")}})).json()).apps[0].id;
  p=await page("app","&id="+appId); t("app pengguna: iframe sandbox dimuat", !!p.d.querySelector("iframe[sandbox]") && p.d.querySelector("iframe").srcdoc.includes("Content-Security-Policy") && p.d.querySelector("iframe").srcdoc.includes("window.os"));
  t("app pengguna: CSP menutup rangkaian", p.d.querySelector("iframe").srcdoc.includes("connect-src 'none'"));
  p=await page("settings"); t("tetapan: tiada ralat", p.errors.length===0 || (console.log(p.errors),false));
  t("tetapan: rantaian AI + keselamatan + Doktor", p.d.querySelectorAll(".prov").length>=4 && p.d.body.textContent.includes("Keselamatan") && p.d.body.textContent.includes("Doktor SmartOS"));
  p=await page("files","&path="+encodeURIComponent(home+"/Dokumen")); t("fail: tiada ralat", p.errors.length===0 || (console.log(p.errors),false));
  t("fail: senarai fail dan folder", p.d.querySelectorAll("tbody tr").length===3 && p.d.querySelector("tbody tr").textContent.includes("Projek"));
  const rows=()=>[...p.d.querySelectorAll("tbody tr")];
  rows()[1].dispatchEvent(new p.w.MouseEvent("click",{bubbles:true})); rows()[2].dispatchEvent(new p.w.MouseEvent("click",{bubbles:true,ctrlKey:true}));
  t("fail: pilih berbilang (Ctrl+klik)", rows().filter(r=>r.classList.contains("sel")).length===2);
  rows()[0].dispatchEvent(new p.w.MouseEvent("click",{bubbles:true,shiftKey:true}));
  t("fail: pilih julat (Shift+klik)", rows().filter(r=>r.classList.contains("sel")).length>=2);
  p.d.dispatchEvent(new p.w.KeyboardEvent("keydown",{key:"a",ctrlKey:true,bubbles:true})); 
  t("fail: Ctrl+A pilih semua", rows().every(r=>r.classList.contains("sel")));
  p.d.dispatchEvent(new p.w.KeyboardEvent("keydown",{key:"c",ctrlKey:true,bubbles:true}));
  t("fail: Ctrl+C -> bar status salinan", p.d.querySelector(".status").textContent.includes("Disalin: 3"));
  // padam melalui kekunci Delete, kemudian undo
  rows()[1].dispatchEvent(new p.w.MouseEvent("click",{bubbles:true}));
  const before=rows().length; p.d.dispatchEvent(new p.w.KeyboardEvent("keydown",{key:"Delete",bubbles:true})); await sleep(900);
  t("fail: Delete -> item hilang (ke tong sampah)", rows().length===before-1);
  p.d.dispatchEvent(new p.w.KeyboardEvent("keydown",{key:"z",ctrlKey:true,bubbles:true})); await sleep(900);
  t("fail: Ctrl+Z -> item dipulihkan", rows().length===before);
  svc.kill(); console.log(`\n${ok} lulus, ${bad} gagal`); process.exit(bad?1:0);
})().catch(e=>{console.error(e);svc.kill();process.exit(2)});
