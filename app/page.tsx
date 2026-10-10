"use client";

import { useState } from "react";
import { Bell, ChevronDown, CircleDot, Link2 } from "lucide-react";
import TeamDirectory from "./TeamDirectory";
import SyncOverview from "./SyncOverview";
import TeamRecords from "./TeamRecords";

export default function Dashboard() {
  const [mobileMenu, setMobileMenu] = useState(false);

  return <main className="min-h-screen">
    <header className="topbar">
      <a className="brand" href="#dashboard"><span className="brand-mark"><CircleDot size={23} /></span><span>DUGOUT</span></a>
      <nav className={mobileMenu ? "nav nav-open" : "nav"}>
        <a className="active" href="#dashboard">대시보드</a><a href="#players">선수 기록</a><a href="#teams">팀별 기록</a>
      </nav>
      <div className="header-actions">
        <button className="icon-button" aria-label="알림"><Bell size={18} /></button>
        <a className="profile" href="#players" onClick={() => setMobileMenu((value) => !value)}><span>ALL</span><div><b>선수 찾기</b><small>가입 없이 열람</small></div><ChevronDown size={15} /></a>
      </div>
    </header>

    <div className="shell" id="dashboard">
      <section className="hero">
        <div>
          <div className="eyebrow"><span /> 썬볼 · 레드포니즈 통합 기록</div>
          <h1>흩어진 모든 기록,<br /><em>하나의 더그아웃.</em></h1>
          <p>게임원, 유니크플레이, 야구스, 나이스캐치 기록을 한곳에서 확인하세요.<br className="desktop" /> 가입 없이 팀과 선수를 선택하면 됩니다.</p>
        </div>
        <div className="diamond-wrap" aria-hidden="true">
          <div className="orbit orbit-one" /><div className="orbit orbit-two" />
          <div className="diamond"><span className="base b1" /><span className="base b2" /><span className="base b3" /><span className="base b4" /><div className="mound"><CircleDot size={40} /></div></div>
        </div>
      </section>

      <SyncOverview />

      <TeamDirectory />

      <TeamRecords />

      <section className="coming"><span><CircleDot size={22} /></span><div><b>실제 팀 기록만 제공</b><p>썬볼과 레드포니즈의 게임원·유니크플레이 기록, 썬볼의 야구스·나이스캐치 기록을 통합해 표시합니다.</p></div><a className="connect-cta" href="#players"><Link2 size={15} /> 선수 기록 보기</a></section>
    </div>
    <footer><b>DUGOUT</b><span>© 2026 Social Baseball Records</span><span>게임원 · 유니크플레이 · 야구스 · 나이스캐치 통합 기록</span></footer>
  </main>;
}
