/* ============================================================
   Let's Grow with LG전자 · 수업 만족도 조사 · 앱 로직
   ============================================================ */

/* 0) 설정 — Firebase 콘솔 값으로 교체 (SETUP_GUIDE.md 참고) */
 const firebaseConfig = {
   apiKey: "AIzaSyDNSPAxQ98eJky8wyGC7zXOQxfW8kjEOWA",
   authDomain: "knew-deal-test.firebaseapp.com",
   projectId: "knew-deal-test",
   storageBucket: "knew-deal-test.firebasestorage.app",
   messagingSenderId: "139032048393",
   appId: "1:139032048393:web:fc731bb5b4083dd5f919d8",
   measurementId: "G-PB4X4FEBC0"
 };

const ADMIN_CODE = "000000";

const QUESTIONS = [
  {key:"q_overall", label:"수업이 전반적으로 만족스러웠다"},
  {key:"q_instructor", label:"강사의 강의 전달력이 좋았다"},
  {key:"q_difficulty", label:"수업 난이도가 적절했다"},
  {key:"q_understand", label:"수업 내용을 잘 이해할 수 있었다"},
  {key:"q_useful", label:"실무에 도움이 될 것 같다"}
];

/* 1) 데이터 계층 (Firestore ↔ localStorage 폴백) */
let db = null, useCloud = false;
try {
  if (firebaseConfig.projectId && firebaseConfig.projectId !== "YOUR_PROJECT_ID") {
    firebase.initializeApp(firebaseConfig);
    db = firebase.firestore();
    useCloud = true;
  }
} catch(e){ console.warn("Firebase 초기화 실패, 로컬 모드로 전환:", e); }

const LS = {
  get:(k)=>JSON.parse(localStorage.getItem(k)||"[]"),
  set:(k,v)=>localStorage.setItem(k,JSON.stringify(v))
};

const Data = {
  async listStudents(){
    if(useCloud){const s=await db.collection("students").get();return s.docs.map(d=>d.data());}
    return LS.get("students");
  },
  async addStudent(st){
    if(useCloud){await db.collection("students").doc(st.studentId).set(st);return;}
    const a=LS.get("students").filter(x=>x.studentId!==st.studentId);a.push(st);LS.set("students",a);
  },
  async deleteStudent(id){
    if(useCloud){await db.collection("students").doc(id).delete();return;}
    LS.set("students",LS.get("students").filter(x=>x.studentId!==id));
  },
  async getStudent(id){
    if(useCloud){const d=await db.collection("students").doc(id).get();return d.exists?d.data():null;}
    return LS.get("students").find(x=>x.studentId===id)||null;
  },
  async listLessons(){
    if(useCloud){const s=await db.collection("lessons").orderBy("date","desc").get();
      return s.docs.map(d=>({id:d.id,...d.data()}));}
    return LS.get("lessons").sort((a,b)=>(b.date||"").localeCompare(a.date||""));
  },
  async addLesson(ls){
    if(useCloud){const ref=await db.collection("lessons").add(ls);return ref.id;}
    const a=LS.get("lessons");const id="L"+Date.now()+Math.floor(Math.random()*1000);
    a.push({id,...ls});LS.set("lessons",a);return id;
  },
  async updateLesson(id,patch){
    if(useCloud){await db.collection("lessons").doc(id).update(patch);return;}
    LS.set("lessons",LS.get("lessons").map(x=>x.id===id?{...x,...patch}:x));
  },
  async deleteLesson(id){
    if(useCloud){await db.collection("lessons").doc(id).delete();return;}
    LS.set("lessons",LS.get("lessons").filter(x=>x.id!==id));
  },
  async listResponses(){
    if(useCloud){const s=await db.collection("responses").get();return s.docs.map(d=>({id:d.id,...d.data()}));}
    return LS.get("responses");
  },
  async addResponse(r){
    if(useCloud){const ref=await db.collection("responses").add(r);return ref.id;}
    const a=LS.get("responses");const id="R"+Date.now();a.push({id,...r});LS.set("responses",a);return id;
  }
};

/* 2) 세션 / 로그인 */
let session = null;

async function doLogin(){
  const id = document.getElementById("loginId").value.trim();
  const err = document.getElementById("loginErr");
  err.textContent="";
  if(!id){err.textContent="학번 또는 관리자 코드를 입력하세요.";return;}
  if(id===ADMIN_CODE){ session={role:"admin",name:"관리자"}; enterApp(); return; }
  const st = await Data.getStudent(id);
  if(!st){err.textContent="등록되지 않은 학번입니다. 관리자에게 등록을 요청하세요.";return;}
  session={role:"student",studentId:st.studentId,name:st.name};
  enterApp();
}

function logout(){
  session=null;
  document.getElementById("loginId").value="";
  document.getElementById("whoBar").style.display="none";
  show("loginView"); hide("adminView"); hide("studentView");
}

function enterApp(){
  document.getElementById("whoBar").style.display="flex";
  document.getElementById("whoText").textContent =
    session.role==="admin" ? "관리자 모드" : (session.name+" ("+session.studentId+")");
  hide("loginView");
  if(session.role==="admin"){ show("adminView"); hide("studentView"); loadAdmin(); }
  else { show("studentView"); hide("adminView"); loadStudent(); }
}

/* 3) 관리자 화면 */
function adminTab(t){
  ["lesson","students","results"].forEach(x=>
    document.getElementById("tab-"+x).classList.toggle("hidden",x!==t));
  document.querySelectorAll("#adminView .tab").forEach(b=>
    b.classList.toggle("active",b.dataset.tab===t));
  if(t==="students")loadStudents();
  if(t==="results")loadResultLessons();
}

function loadAdmin(){
  document.getElementById("lsDate").value = todayStr();
  loadLessonList();
}

function todayStr(){
  const d=new Date();const p=n=>String(n).padStart(2,"0");
  return d.getFullYear()+"-"+p(d.getMonth()+1)+"-"+p(d.getDate());
}

async function saveLesson(){
  const ls={
    round:val("lsRound").trim(), type:val("lsType"), date:val("lsDate"), track:val("lsTrack"),
    title:val("lsTitle").trim(), content:val("lsContent").trim(),
    active:true, createdAt:new Date().toISOString()
  };
  if(!ls.date||!ls.title){msg("lessonMsg","날짜와 제목은 필수입니다.","err");return;}
  await Data.addLesson(ls);
  msg("lessonMsg","회차 만족도 조사가 생성되었습니다. (기본: 온)","ok");
  document.getElementById("lsTitle").value="";
  document.getElementById("lsContent").value="";
  document.getElementById("lsRound").value="";
  loadLessonList();
}

async function loadLessonList(){
  const list=await Data.listLessons();
  const el=document.getElementById("lessonList");
  if(!list.length){el.innerHTML='<p class="muted">생성된 회차 조사가 없습니다.</p>';return;}
  let h='<table><tr><th>회차</th><th>날짜</th><th>구분</th><th>트랙</th><th>제목</th><th>조사 상태</th><th></th></tr>';
  list.forEach(l=>{
    const on=(l.active!==false);
    h+='<tr><td class="center">'+(l.round?esc(l.round)+'회':'-')+'</td><td>'+esc(l.date)+'</td>'+
      '<td><span class="pill '+(l.type==='주간'?'pill-week':'pill-day')+'">'+esc(l.type)+'</span></td>'+
      '<td>'+(esc(l.track)||'-')+'</td><td>'+esc(l.title)+'</td>'+
      '<td><span class="pill '+(on?'pill-on':'pill-off')+'">'+(on?'● 온':'○ 오프')+'</span></td>'+
      '<td style="white-space:nowrap">'+
        '<button class="btn btn-sm '+(on?'btn-gray':'btn-primary')+'" onclick="toggleLesson(\''+l.id+'\','+(!on)+')">'+(on?'오프':'온')+'</button> '+
        '<button class="btn btn-danger btn-sm" onclick="delLesson(\''+l.id+'\')">삭제</button></td></tr>';
  });
  el.innerHTML=h+'</table>';
}
async function toggleLesson(id,makeActive){ await Data.updateLesson(id,{active:makeActive}); loadLessonList(); }
async function delLesson(id){ if(!confirm("이 회차 조사를 삭제할까요?"))return; await Data.deleteLesson(id); loadLessonList(); }

function uploadLessonExcel(ev){
  const f=ev.target.files[0]; if(!f)return;
  readSheet(f, async rows=>{
    let n=0;
    for(const r of rows){
      if(!r["날짜"]&&!r["date"])continue;
      await Data.addLesson({
        round:(r["회차"]||r["round"]||"").toString(),
        type:(r["구분"]||r["type"]||"일간").toString(),
        date:normDate(r["날짜"]||r["date"]),
        track:(r["트랙"]||r["track"]||"공통").toString(),
        title:(r["제목"]||r["title"]||"").toString(),
        content:(r["내용"]||r["content"]||"").toString(),
        active:true, createdAt:new Date().toISOString()
      });n++;
    }
    msg("lessonMsg",n+"개 회차 조사를 생성했습니다.","ok"); loadLessonList();
  });
  ev.target.value="";
}
function downloadLessonTemplate(){
  const ws=XLSX.utils.aoa_to_sheet([
    ["회차","구분","날짜","트랙","제목","내용"],
    ["1","일간","2026-07-14","스마트팩토리","제조 데이터 분석 실습","오늘 진행한 수업 내용을 적습니다."],
    ["2","주간","2026-07-18","AX","주간 프로젝트 리뷰","이번 주 커리큘럼 요약"]
  ]);
  const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,"수업");
  XLSX.writeFile(wb,"lesson_template.xlsx");
}

/* --- 학생 관리 --- */
async function addStudent(){
  const st={studentId:val("stId").trim(),name:val("stName").trim(),track:val("stTrack"),
    createdAt:new Date().toISOString()};
  if(!st.studentId||!st.name){msg("studentMsg","학번과 이름은 필수입니다.","err");return;}
  if(st.studentId===ADMIN_CODE){msg("studentMsg","000000은 관리자 코드로 사용할 수 없습니다.","err");return;}
  await Data.addStudent(st);
  msg("studentMsg","학생이 등록되었습니다.","ok");
  document.getElementById("stId").value="";document.getElementById("stName").value="";
  loadStudents();
}
async function loadStudents(){
  const list=await Data.listStudents();
  document.getElementById("stCount").textContent="("+list.length+"명)";
  const el=document.getElementById("studentList");
  if(!list.length){el.innerHTML='<p class="muted">등록된 학생이 없습니다.</p>';return;}
  let h='<table><tr><th>학번</th><th>이름</th><th>트랙</th><th></th></tr>';
  list.sort((a,b)=>a.studentId.localeCompare(b.studentId)).forEach(s=>{
    h+='<tr><td>'+esc(s.studentId)+'</td><td>'+esc(s.name)+'</td><td>'+(esc(s.track)||'-')+'</td>'+
      '<td><button class="btn btn-danger btn-sm" onclick="delStudent(\''+s.studentId+'\')">삭제</button></td></tr>';
  });
  el.innerHTML=h+'</table>';
}
async function delStudent(id){ if(!confirm(id+" 학생을 삭제할까요?"))return; await Data.deleteStudent(id); loadStudents(); }

function uploadStudentExcel(ev){
  const f=ev.target.files[0]; if(!f)return;
  readSheet(f, async rows=>{
    let n=0;
    for(const r of rows){
      const sid=(r["학번"]||r["studentId"]||r["id"]||"").toString().trim();
      if(!sid||sid===ADMIN_CODE)continue;
      await Data.addStudent({studentId:sid,name:(r["이름"]||r["name"]||"").toString(),
        track:(r["트랙"]||r["track"]||"공통").toString(),createdAt:new Date().toISOString()});n++;
    }
    msg("studentMsg",n+"명을 등록했습니다.","ok");loadStudents();
  });
  ev.target.value="";
}
function downloadStudentTemplate(){
  const ws=XLSX.utils.aoa_to_sheet([["학번","이름","트랙"],
    ["20250001","홍길동","스마트팩토리"],["20250002","김철수","AX"]]);
  const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,"학생");
  XLSX.writeFile(wb,"student_template.xlsx");
}

/* --- 응답 현황 --- */
async function loadResultLessons(){
  const list=await Data.listLessons();
  const sel=document.getElementById("resLesson");
  sel.innerHTML='<option value="">— 선택하세요 —</option>'+
    list.map(l=>'<option value="'+l.id+'">'+(l.round?l.round+'회 · ':'')+esc(l.date)+' · '+esc(l.type)+' · '+esc(l.title)+(l.active===false?' (오프)':'')+'</option>').join("");
  document.getElementById("resultBox").innerHTML="";
}
async function renderResults(){
  const id=val("resLesson");const box=document.getElementById("resultBox");
  if(!id){box.innerHTML="";return;}
  const resps=await Data.listResponses();
  const rs=resps.filter(r=>r.lessonId===id);
  if(!rs.length){box.innerHTML='<p class="muted">아직 응답이 없습니다.</p>';return;}
  let h='<div class="stat-grid">';
  h+='<div class="stat"><div class="n">'+rs.length+'</div><div class="l">응답 수</div></div>';
  QUESTIONS.forEach(q=>{
    const avg=(rs.reduce((s,r)=>s+(+r[q.key]||0),0)/rs.length).toFixed(2);
    h+='<div class="stat"><div class="n">'+avg+'</div><div class="l">'+esc(q.label.slice(0,9))+'…</div></div>';
  });
  h+='</div>';
  h+='<table><tr><th>학번</th><th>이름</th>'+QUESTIONS.map(q=>'<th>'+esc(q.label.slice(0,6))+'</th>').join("")+'<th>자유서술</th><th>제출시각</th></tr>';
  rs.forEach(r=>{
    h+='<tr><td>'+esc(r.studentId)+'</td><td>'+esc(r.name)+'</td>'+
      QUESTIONS.map(q=>'<td class="center">'+(r[q.key]||'-')+'</td>').join("")+
      '<td>'+esc(r.comment)+'</td><td class="muted">'+fmt(r.submittedAt)+'</td></tr>';
  });
  box.innerHTML=h+'</table>';
}

async function exportResults(type){
  const id=val("resLesson"); if(!id){alert("회차 조사를 먼저 선택하세요.");return;}
  const [lessons,resps]=await Promise.all([Data.listLessons(),Data.listResponses()]);
  const lesson=lessons.find(l=>l.id===id)||{};
  const rs=resps.filter(r=>r.lessonId===id);
  if(!rs.length){alert("응답이 없습니다.");return;}
  const rows=rs.map(r=>{
    const o={회차:lesson.round||"",날짜:lesson.date,구분:lesson.type,수업:lesson.title,학번:r.studentId,이름:r.name||""};
    QUESTIONS.forEach(q=>o[q.label]=r[q.key]);
    o["자유서술"]=r.comment||"";o["제출시각"]=fmt(r.submittedAt);return o;
  });
  const fname="survey_"+(lesson.round||'-')+"회_"+lesson.date;
  if(type==="csv")downloadCSV(rows,fname+".csv"); else downloadXLSX(rows,fname+".xlsx");
}
async function exportAll(){
  const [lessons,resps]=await Promise.all([Data.listLessons(),Data.listResponses()]);
  const lmap={};lessons.forEach(l=>lmap[l.id]=l);
  const rows=resps.map(r=>{
    const l=lmap[r.lessonId]||{};
    const o={회차:l.round||"",날짜:l.date||"",구분:l.type||"",트랙:l.track||"",수업:l.title||"",학번:r.studentId,이름:r.name||""};
    QUESTIONS.forEach(q=>o[q.label]=r[q.key]);
    o["자유서술"]=r.comment||"";o["제출시각"]=fmt(r.submittedAt);return o;
  });
  if(!rows.length){alert("응답 데이터가 없습니다.");return;}
  downloadCSV(rows,"survey_responses.csv");
}

/* 4) 학생 화면 */
function studentTab(t){
  ["survey","history"].forEach(x=>document.getElementById("tab-"+x).classList.toggle("hidden",x!==t));
  document.querySelectorAll("#studentView .tab").forEach(b=>b.classList.toggle("active",b.dataset.tab===t));
  if(t==="history")loadHistory();
  if(t==="survey")loadStudent();
}
async function loadStudent(){
  const list=(await Data.listLessons()).filter(l=>l.active!==false); // 온 상태만 노출
  const sel=document.getElementById("svLesson");
  sel.innerHTML='<option value="">— 선택하세요 —</option>'+
    list.map(l=>'<option value="'+l.id+'">'+(l.round?l.round+'회 · ':'')+esc(l.date)+' · '+esc(l.type)+' · '+esc(l.title)+'</option>').join("");
  document.getElementById("surveyForm").innerHTML= list.length?"":
    '<p class="muted" style="margin-top:12px">현재 열려 있는 만족도 조사가 없습니다.</p>';
}

let svRatings={};
async function renderSurveyForm(){
  const id=val("svLesson");const box=document.getElementById("surveyForm");
  svRatings={};
  if(!id){box.innerHTML="";return;}
  const [lessons,resps]=await Promise.all([Data.listLessons(),Data.listResponses()]);
  const lesson=lessons.find(l=>l.id===id);
  if(!lesson||lesson.active===false){
    box.innerHTML='<div class="notice">이 만족도 조사는 현재 마감(오프) 상태입니다.</div>';return;
  }
  const done=resps.find(r=>r.lessonId===id&&r.studentId===session.studentId);
  if(done){
    box.innerHTML='<div class="status-ok">이미 이 회차에 응답하셨습니다. \'내 응답 이력\'에서 확인하세요.</div>';return;
  }
  let h='<div class="notice"><b>'+(lesson.round?lesson.round+'회 · ':'')+esc(lesson.title)+'</b> · '+esc(lesson.date)+' · '+esc(lesson.type)+'<br>'+
    '<span class="muted">'+esc(lesson.content)+'</span></div>';
  QUESTIONS.forEach(q=>{
    h+='<div class="q-block"><div class="q-title">'+esc(q.label)+'</div>'+starHTML(q.key)+'</div>';
  });
  h+='<div class="q-block"><div class="q-title">자유 서술 (개선점·좋았던 점)</div>'+
    '<textarea id="svComment" placeholder="자유롭게 남겨주세요 (선택)"></textarea></div>'+
    '<div style="height:10px"></div>'+
    '<button class="btn btn-primary" onclick="submitSurvey(\''+id+'\')">응답 제출</button>'+
    '<span id="svMsg" style="margin-left:12px"></span>';
  box.innerHTML=h;
  bindStars();
}
function starHTML(key){
  let s='<div class="stars" data-key="'+key+'">';
  for(let i=1;i<=5;i++)s+='<span class="star" data-v="'+i+'">★</span>';
  return s+'</div><span class="muted" id="lbl-'+key+'">평가해 주세요</span>';
}
function bindStars(){
  document.querySelectorAll(".stars").forEach(row=>{
    const key=row.dataset.key;
    row.querySelectorAll(".star").forEach(star=>{
      star.onclick=()=>{
        const v=+star.dataset.v;svRatings[key]=v;
        row.querySelectorAll(".star").forEach(s=>s.classList.toggle("on",+s.dataset.v<=v));
        const labels=["","매우 불만족","불만족","보통","만족","매우 만족"];
        document.getElementById("lbl-"+key).textContent=v+"점 · "+labels[v];
      };
    });
  });
}
async function submitSurvey(lessonId){
  const lesson=(await Data.listLessons()).find(l=>l.id===lessonId);
  if(!lesson||lesson.active===false){msg("svMsg","이 조사는 마감되었습니다.","err");renderSurveyForm();return;}
  for(const q of QUESTIONS){
    if(!svRatings[q.key]){msg("svMsg","모든 문항을 평가해 주세요.","err");return;}
  }
  const r={lessonId,studentId:session.studentId,name:session.name,
    comment:(document.getElementById("svComment").value||"").trim(),
    submittedAt:new Date().toISOString()};
  QUESTIONS.forEach(q=>r[q.key]=svRatings[q.key]);
  await Data.addResponse(r);
  msg("svMsg","제출되었습니다. 감사합니다!","ok");
  setTimeout(()=>renderSurveyForm(),900);
}
async function loadHistory(){
  const [lessons,resps]=await Promise.all([Data.listLessons(),Data.listResponses()]);
  const lmap={};lessons.forEach(l=>lmap[l.id]=l);
  const mine=resps.filter(r=>r.studentId===session.studentId)
    .sort((a,b)=>(b.submittedAt||"").localeCompare(a.submittedAt||""));
  const el=document.getElementById("historyBox");
  if(!mine.length){el.innerHTML='<p class="muted">아직 제출한 응답이 없습니다.</p>';return;}
  let h="";
  mine.forEach(r=>{
    const l=lmap[r.lessonId]||{};
    h+='<div class="card" style="box-shadow:none;margin-bottom:12px">'+
      '<div><b>'+(l.round?esc(l.round)+'회 · ':'')+(esc(l.title)||'(삭제된 수업)')+'</b> '+
        '<span class="pill '+(l.type==='주간'?'pill-week':'pill-day')+'">'+esc(l.type||'')+'</span>'+
        '<span class="muted"> · '+esc(l.date||'')+'</span></div>'+
      '<table style="margin-top:8px">';
    QUESTIONS.forEach(q=>h+='<tr><td>'+esc(q.label)+'</td><td class="center"><b>'+(r[q.key]||'-')+'</b> / 5</td></tr>');
    h+='</table>'+
      (r.comment?'<div style="margin-top:8px"><span class="muted">자유서술:</span> '+esc(r.comment)+'</div>':'')+
      '<div class="muted" style="margin-top:6px">제출: '+fmt(r.submittedAt)+'</div></div>';
  });
  el.innerHTML=h;
}

/* 5) 유틸 */
function show(id){const e=document.getElementById(id);e.classList.remove("hidden");e.style.display="";}
function hide(id){document.getElementById(id).classList.add("hidden");}
function val(id){return document.getElementById(id).value;}
function esc(s){return (s==null?'':String(s)).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));}
function fmt(iso){if(!iso)return'';const d=new Date(iso);if(isNaN(d))return iso;
  const p=n=>String(n).padStart(2,"0");
  return d.getFullYear()+"-"+p(d.getMonth()+1)+"-"+p(d.getDate())+" "+p(d.getHours())+":"+p(d.getMinutes());}
function msg(id,t,type){const e=document.getElementById(id);
  e.innerHTML='<span style="color:'+(type==='err'?'#b91c1c':'#15803d')+';font-size:13px;font-weight:600">'+t+'</span>';}
function normDate(v){
  if(v instanceof Date)return v.toISOString().slice(0,10);
  if(typeof v==="number"&&XLSX.SSF){const d=XLSX.SSF.parse_date_code(v);
    if(d)return d.y+"-"+String(d.m).padStart(2,'0')+"-"+String(d.d).padStart(2,'0');}
  return String(v).slice(0,10);
}
function readSheet(file,cb){
  const rd=new FileReader();
  rd.onload=e=>{
    const wb=XLSX.read(e.target.result,{type:"array"});
    const rows=XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{defval:""});
    cb(rows);
  };
  rd.readAsArrayBuffer(file);
}
function downloadCSV(rows,fname){
  const cols=Object.keys(rows[0]);
  const csv=[cols.join(",")].concat(
    rows.map(r=>cols.map(c=>'"'+String(r[c]==null?'':r[c]).replace(/"/g,'""')+'"').join(","))
  ).join("\r\n");
  const blob=new Blob(["﻿"+csv],{type:"text/csv;charset=utf-8"});
  triggerDownload(blob,fname);
}
function downloadXLSX(rows,fname){
  const ws=XLSX.utils.json_to_sheet(rows);
  const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,"응답");
  XLSX.writeFile(wb,fname);
}
function triggerDownload(blob,fname){
  const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=fname;
  a.click();URL.revokeObjectURL(a.href);
}

/* 시작 시 DB 상태 배지 */
(function(){
  const badge=document.getElementById("dbBadge");
  const foot=document.getElementById("footNote");
  if(useCloud){badge.innerHTML="☁ 클라우드(Firebase) 연동됨 — 데이터가 실시간 저장됩니다.";
    foot.textContent="Firebase Firestore 연동 · Let's Grow with LG전자 만족도 조사";}
  else{badge.innerHTML="⚠ 현재 <b>로컬 저장 모드</b>입니다. app.js의 firebaseConfig를 입력하면 클라우드 저장이 활성화됩니다.";
    foot.textContent="로컬(브라우저) 저장 모드 · 설정 후 Firebase 연동";}
})();
