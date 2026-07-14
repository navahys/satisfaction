/* ============================================================
   Let's Grow with LG전자 · 수업 만족도 조사 · 앱 로직
   구조: 수업 데이터(curriculum) → 만족도 조사(survey) → 응답(response)
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
const TRACKS = ["스마트팩토리","AX","디지털마케팅","공통"];

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
  /* 학생 */
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
  /* 수업 데이터(커리큘럼) */
  async listCurriculum(){
    if(useCloud){const s=await db.collection("curriculum").get();return s.docs.map(d=>({id:d.id,...d.data()}));}
    return LS.get("curriculum");
  },
  async addCurriculum(c){
    if(useCloud){const ref=await db.collection("curriculum").add(c);return ref.id;}
    const a=LS.get("curriculum");const id="C"+Date.now()+Math.floor(Math.random()*10000);
    a.push({id,...c});LS.set("curriculum",a);return id;
  },
  async deleteCurriculum(id){
    if(useCloud){await db.collection("curriculum").doc(id).delete();return;}
    LS.set("curriculum",LS.get("curriculum").filter(x=>x.id!==id));
  },
  async clearCurriculum(){
    if(useCloud){const s=await db.collection("curriculum").get();
      const batch=db.batch();s.docs.forEach(d=>batch.delete(d.ref));await batch.commit();return;}
    LS.set("curriculum",[]);
  },
  /* 만족도 조사(survey) */
  async listSurveys(){
    if(useCloud){const s=await db.collection("surveys").get();
      return s.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(b.date||"").localeCompare(a.date||""));}
    return LS.get("surveys").sort((a,b)=>(b.date||"").localeCompare(a.date||""));
  },
  async getSurvey(id){
    if(useCloud){const d=await db.collection("surveys").doc(id).get();return d.exists?{id:d.id,...d.data()}:null;}
    return LS.get("surveys").find(x=>x.id===id)||null;
  },
  async addSurvey(s){
    if(useCloud){const ref=await db.collection("surveys").add(s);return ref.id;}
    const a=LS.get("surveys");const id="S"+Date.now()+Math.floor(Math.random()*1000);
    a.push({id,...s});LS.set("surveys",a);return id;
  },
  async updateSurvey(id,patch){
    if(useCloud){await db.collection("surveys").doc(id).update(patch);return;}
    LS.set("surveys",LS.get("surveys").map(x=>x.id===id?{...x,...patch}:x));
  },
  async deleteSurvey(id){
    if(useCloud){await db.collection("surveys").doc(id).delete();return;}
    LS.set("surveys",LS.get("surveys").filter(x=>x.id!==id));
  },
  /* 응답 */
  async listResponses(){
    if(useCloud){const s=await db.collection("responses").get();return s.docs.map(d=>({id:d.id,...d.data()}));}
    return LS.get("responses");
  },
  async addResponse(r){
    if(useCloud){const ref=await db.collection("responses").add(r);return ref.id;}
    const a=LS.get("responses");const id="R"+Date.now();a.push({id,...r});LS.set("responses",a);return id;
  }
};

/* 공통 헬퍼 */
function inRange(d,s,e){ return d && s && e && d>=s && d<=e; }
function surveyScope(s){ return s.type==="주간" ? ((s.startDate||"")+" ~ "+(s.endDate||"")) : (s.date||""); }
function dateInScope(s,c){ return s.type==="주간" ? inRange(c.date,s.startDate,s.endDate) : c.date===s.date; }
// 조사에 해당하는 커리큘럼 수업 (조사의 트랙과 정확히 일치 + 날짜 범위)
function surveyLessons(survey, curriculum){
  return curriculum.filter(c=> c.track===survey.track && dateInScope(survey,c))
    .sort((a,b)=>(a.date||"").localeCompare(b.date||"") || (a.title||"").localeCompare(b.title||""));
}
function studentCanSee(s){ return s.track===session.track || s.track==="공통"; }
function buildRoundMap(curriculum){
  const dates=[...new Set(curriculum.map(c=>c.date).filter(Boolean))].sort();
  const m={}; dates.forEach((d,i)=>m[d]=i+1); return m;
}

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
  session={role:"student",studentId:st.studentId,name:st.name,track:st.track||"공통"};
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
    session.role==="admin" ? "관리자 모드" : (session.name+" ("+session.studentId+" · "+session.track+")");
  hide("loginView");
  if(session.role==="admin"){ show("adminView"); hide("studentView"); loadAdmin(); }
  else { show("studentView"); hide("adminView"); loadStudent(); }
}

/* 3) 관리자 */
function adminTab(t){
  ["curriculum","survey","students","results"].forEach(x=>
    document.getElementById("tab-"+x).classList.toggle("hidden",x!==t));
  document.querySelectorAll("#adminView .tab").forEach(b=>
    b.classList.toggle("active",b.dataset.tab===t));
  if(t==="curriculum")loadCurriculum();
  if(t==="survey"){ loadSurveyList(); updateSurveyPreview(); }
  if(t==="students")loadStudents();
  if(t==="results")loadResultSurveys();
}
function loadAdmin(){
  const t=todayStr();
  document.getElementById("sgDate").value=t;
  document.getElementById("sgStart").value=t;
  document.getElementById("sgEnd").value=t;
  toggleSurveyDateMode();
  loadCurriculum();
}
function todayStr(){
  const d=new Date();const p=n=>String(n).padStart(2,"0");
  return d.getFullYear()+"-"+p(d.getMonth()+1)+"-"+p(d.getDate());
}

/* --- ① 수업 데이터(커리큘럼) --- */
async function loadCurriculum(){
  const list=(await Data.listCurriculum()).sort((a,b)=>(a.date||"").localeCompare(b.date||"")||(a.track||"").localeCompare(b.track||""));
  document.getElementById("curCount").textContent="("+list.length+"건)";
  const el=document.getElementById("curList");
  if(!list.length){el.innerHTML='<p class="muted">불러온 수업 데이터가 없습니다. 엑셀을 업로드하세요.</p>';return;}
  const rmap=buildRoundMap(list);
  let h='<table><tr><th>회차</th><th>날짜</th><th>트랙</th><th>제목</th><th>내용</th><th></th></tr>';
  list.forEach(c=>{
    h+='<tr><td class="center">'+(rmap[c.date]?rmap[c.date]+'회':'-')+'</td><td>'+esc(c.date)+'</td><td><span class="pill pill-track">'+esc(c.track)+'</span></td>'+
      '<td>'+esc(c.title)+'</td><td class="muted">'+esc((c.content||"").slice(0,40))+'</td>'+
      '<td><button class="btn btn-danger btn-sm" onclick="delCurriculum(\''+c.id+'\')">삭제</button></td></tr>';
  });
  el.innerHTML=h+'</table>';
}
async function delCurriculum(id){ if(!confirm("이 수업을 삭제할까요?"))return; await Data.deleteCurriculum(id); loadCurriculum(); updateSurveyPreview(); }
async function clearCurriculum(){ if(!confirm("불러온 수업 데이터를 전체 삭제할까요?"))return; await Data.clearCurriculum(); loadCurriculum(); updateSurveyPreview(); }

function uploadCurriculumExcel(ev){
  const f=ev.target.files[0]; if(!f)return;
  readSheet(f, async rows=>{
    let n=0;
    for(const r of rows){
      const date=normDate(r["날짜"]||r["date"]);
      const track=(r["트랙"]||r["track"]||"").toString().trim();
      if(!date||!track)continue;
      await Data.addCurriculum({
        date:date, track:track,
        title:(r["제목"]||r["title"]||"").toString(),
        content:(r["내용"]||r["content"]||"").toString(),
        createdAt:new Date().toISOString()
      });n++;
    }
    msg("curMsg",n+"건의 수업 데이터를 파이어베이스에 저장했습니다.","ok"); loadCurriculum(); updateSurveyPreview();
  });
  ev.target.value="";
}
function downloadCurriculumTemplate(){
  const ws=XLSX.utils.aoa_to_sheet([
    ["트랙","날짜","제목","내용"],
    ["스마트팩토리","2026-07-14","제조 데이터 분석 실습","설비 데이터 수집과 이상탐지"],
    ["AX","2026-07-14","머신러닝 모델링 실습","분류·회귀 모델 학습과 평가"],
    ["디지털마케팅","2026-07-14","SNS 채널 운영","콘텐츠 캘린더와 채널 전략"]
  ]);
  const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,"수업데이터");
  XLSX.writeFile(wb,"curriculum_template.xlsx");
}

/* --- ② 만족도 조사 생성 / 수정 --- */
let editingSurveyId=null;

function toggleSurveyDateMode(){
  const weekly=val("sgType")==="주간";
  document.getElementById("sgSingleWrap").classList.toggle("hidden",weekly);
  document.getElementById("sgRangeWrap").classList.toggle("hidden",!weekly);
}
function currentSurveyDraft(){
  const type=val("sgType");
  const base={type:type, track:val("sgTrack")};
  if(type==="주간"){ base.startDate=val("sgStart"); base.endDate=val("sgEnd"); base.date=val("sgStart"); }
  else base.date=val("sgDate");
  return base;
}
async function updateSurveyPreview(){
  const el=document.getElementById("sgPreview"); if(!el)return;
  const draft=currentSurveyDraft();
  if(draft.type==="주간" && draft.startDate>draft.endDate){el.textContent="⚠ 종료일이 시작일보다 빠릅니다.";return;}
  const cur=await Data.listCurriculum();
  const rm=buildRoundMap(cur);
  if(!editingSurveyId){
    const dd=draft.type==="주간"?draft.startDate:draft.date;
    document.getElementById("sgRound").value=rm[dd]||"";
  }
  const scope=cur.filter(c=>dateInScope(draft,c));
  if(draft.track==="전체"){
    if(!scope.length){el.innerHTML="이 날짜/기간에 해당하는 수업이 <b>없습니다.</b>";return;}
    const byTrack={}; scope.forEach(c=>{(byTrack[c.track]=byTrack[c.track]||[]).push(c);});
    el.innerHTML="트랙별 조사가 생성됩니다 → "+Object.keys(byTrack).map(t=>esc(t)+"("+byTrack[t].length+"건)").join(", ");
  }else{
    const lessons=scope.filter(c=>c.track===draft.track);
    if(!lessons.length){el.innerHTML="["+esc(draft.track)+"] 트랙의 해당 수업이 <b>없습니다.</b>";return;}
    el.innerHTML="["+esc(draft.track)+"] 대상 수업 <b>"+lessons.length+"건</b>: "+lessons.map(l=>esc(l.date)+" "+esc(l.title)).join(", ");
  }
}
async function saveSurvey(){
  const draft=currentSurveyDraft();
  const round=val("sgRound").trim();
  if(draft.type==="주간"){
    if(!draft.startDate||!draft.endDate){msg("surveyMsg","주간은 시작일과 종료일이 필요합니다.","err");return;}
    if(draft.startDate>draft.endDate){msg("surveyMsg","종료일이 시작일보다 빠릅니다.","err");return;}
  }else if(!draft.date){msg("surveyMsg","날짜를 선택하세요.","err");return;}
  const cur=await Data.listCurriculum();

  /* 수정 모드 */
  if(editingSurveyId){
    if(draft.track==="전체"){msg("surveyMsg","수정 시에는 특정 트랙을 선택하세요.","err");return;}
    const rmapE=buildRoundMap(cur);
    const rndE=(rmapE[draft.type==="주간"?draft.startDate:draft.date]||round||"");
    const patch={round:rndE, type:draft.type, track:draft.track, title:(val("sgTitle").trim()||autoTitle(rndE,draft))};
    if(draft.type==="주간"){patch.startDate=draft.startDate;patch.endDate=draft.endDate;patch.date=draft.startDate;}
    else {patch.date=draft.date; patch.startDate=firebase&&null; }
    // 일간으로 바뀌면 기간 필드 제거(로컬), 클라우드는 남아도 무방
    await Data.updateSurvey(editingSurveyId,patch);
    msg("surveyMsg","조사가 수정되었습니다.","ok");
    cancelEdit(); loadSurveyList(); return;
  }

  /* 생성 모드 */
  const makeTracks = draft.track==="전체"
    ? [...new Set(cur.filter(c=>dateInScope(draft,c)).map(c=>c.track))]
    : [draft.track];
  if(!makeTracks.length){
    if(!confirm("해당 날짜/기간에 수업 데이터가 없습니다. 그래도 빈 조사를 생성할까요?"))return;
    makeTracks.push(draft.track==="전체"?"공통":draft.track);
  }
  const rmap=buildRoundMap(cur);
  const rnd=(rmap[draft.type==="주간"?draft.startDate:draft.date]||round||"");
  let created=0;
  for(const tk of makeTracks){
    const s={round:rnd, type:draft.type, track:tk, active:false, createdAt:new Date().toISOString(),
      title:(val("sgTitle").trim()||autoTitle(rnd,{...draft,track:tk}))};
    if(draft.type==="주간"){s.startDate=draft.startDate;s.endDate=draft.endDate;s.date=draft.startDate;}
    else s.date=draft.date;
    await Data.addSurvey(s);created++;
  }
  msg("surveyMsg",created+"개 조사가 생성되었습니다. (기본: 오프 — 목록에서 온을 눌러 게시)","ok");
  document.getElementById("sgRound").value="";
  document.getElementById("sgTitle").value="";
  loadSurveyList();
}
function autoTitle(round,draft){
  const scope=draft.type==="주간"?(draft.startDate+"~"+draft.endDate+" 주간"):(draft.date+" 일간");
  return (round?round+"회 ":"")+"["+draft.track+"] "+scope+" 만족도";
}
async function editSurvey(id){
  const s=await Data.getSurvey(id); if(!s)return;
  editingSurveyId=id;
  document.getElementById("sgRound").value=s.round||"";
  document.getElementById("sgType").value=s.type||"일간";
  document.getElementById("sgTrack").value=s.track||"공통";
  toggleSurveyDateMode();
  if(s.type==="주간"){ document.getElementById("sgStart").value=s.startDate||""; document.getElementById("sgEnd").value=s.endDate||""; }
  else document.getElementById("sgDate").value=s.date||"";
  document.getElementById("sgTitle").value=s.title||"";
  document.getElementById("sgSaveBtn").textContent="수정 저장";
  document.getElementById("sgCancelBtn").classList.remove("hidden");
  const b=document.getElementById("sgEditBanner");
  b.classList.remove("hidden"); b.innerHTML="✎ 수정 중: <b>"+esc(s.title||"")+"</b> — 값을 바꾸고 '수정 저장'을 누르세요.";
  updateSurveyPreview();
  window.scrollTo({top:0,behavior:"smooth"});
}
function cancelEdit(){
  editingSurveyId=null;
  document.getElementById("sgSaveBtn").textContent="조사 생성";
  document.getElementById("sgCancelBtn").classList.add("hidden");
  document.getElementById("sgEditBanner").classList.add("hidden");
  document.getElementById("sgRound").value="";
  document.getElementById("sgTitle").value="";
  updateSurveyPreview();
}
async function loadSurveyList(){
  const [surveys,cur]=await Promise.all([Data.listSurveys(),Data.listCurriculum()]);
  const el=document.getElementById("surveyList");
  if(!surveys.length){el.innerHTML='<p class="muted">생성된 조사가 없습니다.</p>';return;}
  let h='<table><tr><th>회차</th><th>구분</th><th>트랙</th><th>날짜/기간</th><th>대상 수업</th><th>제목</th><th>상태</th><th></th></tr>';
  surveys.forEach(s=>{
    const on=(s.active!==false);
    const cnt=surveyLessons(s,cur).length;
    h+='<tr><td class="center">'+(s.round?esc(s.round)+'회':'-')+'</td>'+
      '<td><span class="pill '+(s.type==='주간'?'pill-week':'pill-day')+'">'+esc(s.type)+'</span></td>'+
      '<td><span class="pill pill-track">'+esc(s.track)+'</span></td>'+
      '<td>'+esc(surveyScope(s))+'</td><td class="center">'+cnt+'건</td>'+
      '<td>'+esc(s.title)+'</td>'+
      '<td><span class="pill '+(on?'pill-on':'pill-off')+'">'+(on?'● 온':'○ 오프')+'</span></td>'+
      '<td style="white-space:nowrap">'+
        '<button class="btn btn-ghost btn-sm" onclick="editSurvey(\''+s.id+'\')">수정</button> '+
        '<button class="btn btn-sm '+(on?'btn-gray':'btn-primary')+'" onclick="toggleSurvey(\''+s.id+'\','+(!on)+')">'+(on?'오프':'온')+'</button> '+
        '<button class="btn btn-danger btn-sm" onclick="delSurvey(\''+s.id+'\')">삭제</button></td></tr>';
  });
  el.innerHTML=h+'</table>';
}
async function toggleSurvey(id,makeActive){ await Data.updateSurvey(id,{active:makeActive}); loadSurveyList(); }
async function delSurvey(id){ if(!confirm("이 조사를 삭제할까요?"))return; if(editingSurveyId===id)cancelEdit(); await Data.deleteSurvey(id); loadSurveyList(); }

/* --- 학생 관리 --- */
async function addStudent(){
  const st={studentId:val("stId").trim(),name:val("stName").trim(),track:val("stTrack"),createdAt:new Date().toISOString()};
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
  const ws=XLSX.utils.aoa_to_sheet([["학번","이름","트랙"],["20250001","홍길동","스마트팩토리"],["20250002","김철수","AX"]]);
  const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,"학생");
  XLSX.writeFile(wb,"student_template.xlsx");
}

/* --- 응답 현황 --- */
async function loadResultSurveys(){
  const surveys=await Data.listSurveys();
  const sel=document.getElementById("resSurvey");
  sel.innerHTML='<option value="">— 선택하세요 —</option>'+
    surveys.map(s=>'<option value="'+s.id+'">'+(s.round?s.round+'회 · ':'')+esc(s.track)+' · '+esc(surveyScope(s))+' · '+esc(s.type)+' · '+esc(s.title)+(s.active===false?' (오프)':'')+'</option>').join("");
  document.getElementById("resultBox").innerHTML="";
}
async function renderResults(){
  const id=val("resSurvey");const box=document.getElementById("resultBox");
  if(!id){box.innerHTML="";return;}
  const rs=(await Data.listResponses()).filter(r=>r.surveyId===id);
  if(!rs.length){box.innerHTML='<p class="muted">아직 응답이 없습니다.</p>';return;}
  let h='<div class="stat-grid"><div class="stat"><div class="n">'+rs.length+'</div><div class="l">응답 수</div></div>';
  QUESTIONS.forEach(q=>{
    const avg=(rs.reduce((s,r)=>s+(+r[q.key]||0),0)/rs.length).toFixed(2);
    h+='<div class="stat"><div class="n">'+avg+'</div><div class="l">'+esc(q.label.slice(0,9))+'…</div></div>';
  });
  h+='</div>';
  h+='<table><tr><th>학번</th><th>이름</th><th>트랙</th>'+QUESTIONS.map(q=>'<th>'+esc(q.label.slice(0,6))+'</th>').join("")+'<th>자유서술</th><th>제출시각</th></tr>';
  rs.forEach(r=>{
    h+='<tr><td>'+esc(r.studentId)+'</td><td>'+esc(r.name)+'</td><td>'+esc(r.track)+'</td>'+
      QUESTIONS.map(q=>'<td class="center">'+(r[q.key]||'-')+'</td>').join("")+
      '<td>'+esc(r.comment)+'</td><td class="muted">'+fmt(r.submittedAt)+'</td></tr>';
  });
  box.innerHTML=h+'</table>';
}
async function exportResults(type){
  const id=val("resSurvey"); if(!id){alert("조사를 먼저 선택하세요.");return;}
  const [surveys,resps]=await Promise.all([Data.listSurveys(),Data.listResponses()]);
  const s=surveys.find(x=>x.id===id)||{};
  const rs=resps.filter(r=>r.surveyId===id);
  if(!rs.length){alert("응답이 없습니다.");return;}
  const rows=rs.map(r=>{
    const o={회차:s.round||"",구분:s.type||"",트랙:s.track||"",기간:surveyScope(s),조사:s.title||"",학번:r.studentId,이름:r.name||""};
    QUESTIONS.forEach(q=>o[q.label]=r[q.key]);
    o["자유서술"]=r.comment||"";o["제출시각"]=fmt(r.submittedAt);return o;
  });
  const fname="survey_"+(s.round||'-')+"회_"+(s.track||"")+"_"+(s.date||"");
  if(type==="csv")downloadCSV(rows,fname+".csv"); else downloadXLSX(rows,fname+".xlsx");
}
async function exportAll(){
  const [surveys,resps]=await Promise.all([Data.listSurveys(),Data.listResponses()]);
  const smap={};surveys.forEach(s=>smap[s.id]=s);
  const rows=resps.map(r=>{
    const s=smap[r.surveyId]||{};
    const o={회차:s.round||"",구분:s.type||"",트랙:r.track||s.track||"",기간:surveyScope(s),조사:s.title||"",학번:r.studentId,이름:r.name||""};
    QUESTIONS.forEach(q=>o[q.label]=r[q.key]);
    o["자유서술"]=r.comment||"";o["제출시각"]=fmt(r.submittedAt);return o;
  });
  if(!rows.length){alert("응답 데이터가 없습니다.");return;}
  downloadCSV(rows,"survey_responses.csv");
}

/* 4) 학생 */
function studentTab(t){
  document.getElementById("tab-stusurvey").classList.toggle("hidden",t!=="survey");
  document.getElementById("tab-history").classList.toggle("hidden",t!=="history");
  document.querySelectorAll("#studentView .tab").forEach(b=>b.classList.toggle("active",b.dataset.tab===t));
  if(t==="history")loadHistory();
  if(t==="survey")loadStudent();
}
async function loadStudent(){
  const [surveys,cur,resps]=await Promise.all([Data.listSurveys(),Data.listCurriculum(),Data.listResponses()]);
  const list=surveys.filter(s=> s.active!==false && studentCanSee(s) && surveyLessons(s,cur).length>0);
  const done={};
  resps.filter(r=>r.studentId===session.studentId).forEach(r=>done[r.surveyId]=true);
  const sel=document.getElementById("stuSel");
  sel.innerHTML='<option value="">— 선택하세요 —</option>'+
    list.map(s=>'<option value="'+s.id+'">'+(s.round?s.round+'회 · ':'')+esc(surveyScope(s))+' · '+esc(s.type)+' · '+esc(s.title)+(done[s.id]?'  ✓ 응답완료':'  · 미응답')+'</option>').join("");
  document.getElementById("surveyForm").innerHTML= list.length?"":
    '<p class="muted" style="margin-top:12px">현재 내 트랙('+esc(session.track)+')에 열려 있는 만족도 조사가 없습니다.</p>';
}

let svRatings={};
async function renderSurveyForm(){
  const id=val("stuSel");const box=document.getElementById("surveyForm");
  svRatings={};
  if(!id){box.innerHTML="";return;}
  const [cur,resps]=await Promise.all([Data.listCurriculum(),Data.listResponses()]);
  const s=await Data.getSurvey(id);
  if(!s||s.active===false){box.innerHTML='<div class="notice">이 만족도 조사는 현재 마감(오프) 상태입니다.</div>';return;}
  if(!studentCanSee(s)){box.innerHTML='<div class="notice">본인 트랙 대상 조사가 아닙니다.</div>';return;}
  const lessons=surveyLessons(s,cur);
  if(!lessons.length){box.innerHTML='<div class="notice">이 조사에 해당하는 수업이 없습니다.</div>';return;}
  if(resps.find(r=>r.surveyId===id&&r.studentId===session.studentId)){
    box.innerHTML='<div class="status-ok">✓ 이미 이 조사에 응답하셨습니다. \'내 응답 이력\'에서 확인하세요.</div>';return;
  }
  let h='<div class="notice"><b>'+(s.round?s.round+'회 · ':'')+esc(s.title)+'</b> · '+esc(surveyScope(s))+' · '+esc(s.type)+' · '+esc(s.track)+'<br>'+
    '<span class="muted">평가 대상 수업:</span>'+
    '<ul style="margin:6px 0 0 0;padding-left:18px">'+
    lessons.map(l=>'<li>'+esc(l.date)+' · '+esc(l.title)+(l.content?' <span class="muted">('+esc(l.content)+')</span>':'')+'</li>').join("")+
    '</ul></div>';
  QUESTIONS.forEach(q=>{ h+='<div class="q-block"><div class="q-title">'+esc(q.label)+'</div>'+starHTML(q.key)+'</div>'; });
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
        row.querySelectorAll(".star").forEach(x=>x.classList.toggle("on",+x.dataset.v<=v));
        const labels=["","매우 불만족","불만족","보통","만족","매우 만족"];
        document.getElementById("lbl-"+key).textContent=v+"점 · "+labels[v];
      };
    });
  });
}
async function submitSurvey(surveyId){
  const [cur]=await Promise.all([Data.listCurriculum()]);
  const s=await Data.getSurvey(surveyId);
  if(!s||s.active===false){msg("svMsg","이 조사는 마감되었습니다.","err");renderSurveyForm();return;}
  if(!studentCanSee(s)||!surveyLessons(s,cur).length){msg("svMsg","대상 수업이 없습니다.","err");return;}
  for(const q of QUESTIONS){ if(!svRatings[q.key]){msg("svMsg","모든 문항을 평가해 주세요.","err");return;} }
  const r={surveyId:surveyId,studentId:session.studentId,name:session.name,track:session.track,
    round:s.round||"",scope:surveyScope(s),
    comment:(document.getElementById("svComment").value||"").trim(),
    submittedAt:new Date().toISOString()};
  QUESTIONS.forEach(q=>r[q.key]=svRatings[q.key]);
  await Data.addResponse(r);
  msg("svMsg","제출되었습니다. 감사합니다!","ok");
  setTimeout(()=>{ loadStudent(); renderSurveyForm(); },900);
}
async function loadHistory(){
  const [surveys,resps]=await Promise.all([Data.listSurveys(),Data.listResponses()]);
  const smap={};surveys.forEach(s=>smap[s.id]=s);
  const mine=resps.filter(r=>r.studentId===session.studentId).sort((a,b)=>(b.submittedAt||"").localeCompare(a.submittedAt||""));
  const el=document.getElementById("historyBox");
  if(!mine.length){el.innerHTML='<p class="muted">아직 제출한 응답이 없습니다.</p>';return;}
  let h="";
  mine.forEach(r=>{
    const s=smap[r.surveyId]||{};
    h+='<div class="card" style="box-shadow:none;margin-bottom:12px">'+
      '<div><b>'+(r.round?esc(r.round)+'회 · ':'')+(esc(s.title)||'(삭제된 조사)')+'</b> '+
        '<span class="pill '+(s.type==='주간'?'pill-week':'pill-day')+'">'+esc(s.type||'')+'</span>'+
        '<span class="muted"> · '+esc(r.scope||surveyScope(s))+'</span></div>'+
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
  if(v==null||v==="")return"";
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
