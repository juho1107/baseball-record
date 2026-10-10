"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { ArrowLeft, Check, CircleDot, ExternalLink, Gauge, Link2, LoaderCircle, LockKeyhole, RefreshCw, UserRound } from "lucide-react";

type BattingView = { games: number; atBats: number; average: number; hits: number; homeRuns: number | null; rbi: number; ops: number | null };
type PitchingView = { games: number; era: number | null; wins: number | null; losses: number | null; innings: string; strikeouts: number | null; whip: number | null };
type RecordStats = { games: number; average: number; hits: number; homeRuns: number | null; rbi: number; ops: number | null; era: number | null; batting?: BattingView; pitching?: PitchingView };
type TeamRecord = { clubId: string; name: string; career: RecordStats; seasons: Array<{ season: number; stats: RecordStats }> };
type ImportedRecord = {
  source: string; externalId: string; profileUrl: string; fetchedAt: string;
  player: { name: string; team: string };
  stats: RecordStats; career?: RecordStats; seasons?: Array<{ season: number; stats: RecordStats }>; teams?: TeamRecord[];
  games?: Array<{ gameId: string }>;
};
type MemberProfile = { email: string; name: string; team: string; gameoneUrl: string; record?: ImportedRecord };

const STORAGE_KEY = "dugout-member-profile";
const exampleUrl = "https://gameone.kr/locker/record/sum?group_code=1O9TU1P7OBN00000001ARDV";

export default function ConnectPage() {
  const [profile, setProfile] = useState<MemberProfile>({ email: "", name: "", team: "", gameoneUrl: "" });
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [period, setPeriod] = useState("career");
  const [teamId, setTeamId] = useState("all");
  const [recordType, setRecordType] = useState<"batting" | "pitching">("batting");
  const resultRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) setProfile(JSON.parse(saved));
    setReady(true);
  }, []);

  function save(next: MemberProfile, notice: string) {
    setProfile(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setMessage(notice);
  }

  function saveIdentity(event: FormEvent) {
    event.preventDefault();
    save(profile, "내 프로필을 저장했습니다.");
  }

  async function syncGameOne(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch("/api/gameone", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: profile.gameoneUrl }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      const imported = body as ImportedRecord;
      const next = { ...profile, name: profile.name || imported.player.name, team: profile.team || imported.player.team, record: imported };
      setPeriod("career");
      setTeamId("all");
      setRecordType("batting");
      save(next, "게임원 공개 기록을 연결했습니다.");
      window.setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 100);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "동기화에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }

  if (!ready) return null;
  const record = profile.record;
  const selectedTeam = record?.teams?.find((team) => team.clubId === teamId);
  const availableSeasons = selectedTeam?.seasons ?? record?.seasons ?? [];
  const shownStats = selectedTeam
    ? (period === "career" ? selectedTeam.career : selectedTeam.seasons.find((item) => String(item.season) === period)?.stats)
    : (period === "career" ? (record?.career ?? record?.stats) : record?.seasons?.find((item) => String(item.season) === period)?.stats);
  const batting = shownStats?.batting ?? (shownStats ? { games: shownStats.games, atBats: 0, average: shownStats.average, hits: shownStats.hits, homeRuns: shownStats.homeRuns, rbi: shownStats.rbi, ops: shownStats.ops } : undefined);
  const pitching = shownStats?.pitching ?? (shownStats ? { games: shownStats.era == null ? 0 : shownStats.games, era: shownStats.era, wins: null, losses: null, innings: "0", strikeouts: null, whip: null } : undefined);
  return <main className="connect-page">
    <header className="connect-header"><a className="brand" href="/"><span className="brand-mark"><CircleDot size={23} /></span><span>DUGOUT</span></a><a className="back-link" href="/"><ArrowLeft size={16} /> 대시보드</a></header>
    <div className="connect-shell">
      <section className="connect-intro"><span className="section-kicker">MY RECORD LINK</span><h1>내 기록을<br /><em>하나로 연결하세요.</em></h1><p>이름과 소속팀을 저장하면 관리자가 동기화한 게임원·유니크플레이 팀 기록에서 내 기록을 자동으로 찾아 통합합니다.</p><div className="privacy-note"><LockKeyhole size={17} /><div><b>외부 서비스 계정 연결이 필요하지 않습니다.</b><span>썬볼과 레드포니즈 기록은 팀 단위로 안전하게 갱신합니다.</span></div></div></section>
      <div className="connect-flow">
        <section className="setup-card"><div className="step-heading"><span>01</span><div><b>내 프로필</b><small>통합 기록의 기준이 되는 정보</small></div>{profile.email && <Check size={19} />}</div>
          <form className="profile-form" onSubmit={saveIdentity}><label>이메일<input required type="email" value={profile.email} onChange={(e) => setProfile({ ...profile, email: e.target.value })} placeholder="name@example.com" /></label><label>이름<input required value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} placeholder="홍길동" /></label><label>대표 소속팀<input required value={profile.team} onChange={(e) => setProfile({ ...profile, team: e.target.value })} placeholder="여러 팀 중 대표로 표시할 팀" /></label><p className="field-help">등번호는 팀마다 다를 수 있어 기본 프로필에 저장하지 않습니다.</p><button className="primary-button"><UserRound size={16} /> 프로필 저장</button></form>
        </section>
        <section className="setup-card"><div className="step-heading"><span>02</span><div><b>팀 기록 자동 연결</b><small>관리자가 갱신한 두 플랫폼 기록과 이름으로 연결</small></div><Check size={19} /></div><div className="central-sync-note"><b>개인 게임원 URL은 더 이상 필요하지 않습니다.</b><p>프로필 저장 후 대시보드에서 통합·게임원·유니크플레이 기록을 확인하세요.</p><a className="primary-button mint" href="/"><Gauge size={16} /> 대시보드에서 확인</a></div></section>
        {message && <div className={record ? "form-message success" : "form-message"}>{message}</div>}
      </div>
    </div>
    {record && shownStats && batting && pitching && <section ref={resultRef} className="import-result">
      <div className="result-head"><div><span className="connected-dot" /> GAMEONE CONNECTED<h2>{record.player.name} <small>{selectedTeam?.name ?? "전체 팀 통합"}</small></h2></div><div className="result-actions"><select value={teamId} onChange={(event) => { setTeamId(event.target.value); setPeriod("career"); }}><option value="all">전체 팀</option>{record.teams?.map((team) => <option key={team.clubId} value={team.clubId}>{team.name}</option>)}</select><select value={period} onChange={(event) => setPeriod(event.target.value)}><option value="career">통산 기록</option>{availableSeasons.map((item) => <option key={item.season} value={item.season}>{item.season} 시즌</option>)}</select><a href={record.profileUrl} target="_blank" rel="noreferrer">원본 기록 <ExternalLink size={14} /></a></div></div>
      <div className="record-type-tabs"><button className={recordType === "batting" ? "active" : ""} onClick={() => setRecordType("batting")}>타자 기록</button><button className={recordType === "pitching" ? "active" : ""} onClick={() => setRecordType("pitching")}>투수 기록 <small>{pitching.games}경기</small></button></div>
      {recordType === "batting" ? <div className="import-stats"><Stat label="경기" value={batting.games} /><Stat label="타수" value={batting.atBats} /><Stat label="타율" value={batting.average.toFixed(3)} /><Stat label="안타" value={batting.hits} /><Stat label="홈런" value={batting.homeRuns ?? "—"} /><Stat label="타점" value={batting.rbi} /><Stat label="OPS" value={batting.ops == null ? "—" : batting.ops.toFixed(3)} /></div> : <div className="import-stats"><Stat label="경기" value={pitching.games} /><Stat label="방어율" value={pitching.era?.toFixed(2) ?? "—"} /><Stat label="승" value={pitching.wins ?? "—"} /><Stat label="패" value={pitching.losses ?? "—"} /><Stat label="이닝" value={pitching.innings} /><Stat label="탈삼진" value={pitching.strikeouts ?? "—"} /><Stat label="WHIP" value={pitching.whip?.toFixed(2) ?? "—"} /></div>}
      {selectedTeam && <div className="team-data-note">팀별 홈런·OPS와 투수 승패·탈삼진·WHIP는 저장된 경기별 박스스코어 원자료로 계산했습니다.</div>}
      <div className="result-next"><div><Check size={17} /><span><b>{record.seasons?.length ?? 1}개 시즌 · {record.teams?.length ?? 0}개 팀 · 경기 원자료 {record.games?.length ?? 0}건을 저장했습니다.</b>기록 종류와 팀, 연도를 조합해 확인할 수 있습니다.</span></div><a href="/"><Gauge size={15} /> 내 대시보드 보기</a></div><p>이 브라우저에 저장됨 · 마지막 동기화 {new Date(record.fetchedAt).toLocaleString("ko-KR")}</p>
    </section>}
  </main>;
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return <div><span>{label}</span><strong>{value}</strong></div>;
}
