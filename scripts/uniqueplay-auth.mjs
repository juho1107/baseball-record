import { chromium } from "playwright";
import { loadEnvFile } from "node:process";
import { existsSync } from "node:fs";
import path from "node:path";

try { loadEnvFile(path.resolve(".env.local")); } catch {}

const LOGIN_URL = "https://www.unique-play.com/login";
const DEFAULT_EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const SESSION_DIR = path.resolve(".data", "uniqueplay-session");

async function accessToken(page, timeout = 2_000) {
  return page.waitForFunction(() => {
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (key?.toLowerCase().includes("accesstoken")) return localStorage.getItem(key);
    }
    return null;
  }, null, { timeout }).then((handle) => handle.jsonValue()).catch(() => null);
}

async function validToken(token) {
  if (!token) return false;
  const response = await fetch("https://service-api.unique-play.com/app-user/me", {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
  }).catch(() => null);
  return response?.ok === true;
}

export async function openUniquePlaySession() {
  const email = process.env.UNIQUEPLAY_LOGIN_ID;
  const password = process.env.UNIQUEPLAY_LOGIN_PASSWORD;
  const automatic = Boolean(email && password);
  const requestedBrowser = process.env.UNIQUEPLAY_BROWSER_PATH;
  const executablePath = requestedBrowser ?? (existsSync(DEFAULT_EDGE) ? DEFAULT_EDGE : undefined);
  const context = await chromium.launchPersistentContext(SESSION_DIR, {
    ...(executablePath ? { executablePath } : {}),
    headless: automatic,
    viewport: { width: 1100, height: 820 },
  });

  try {
    const page = context.pages()[0] ?? await context.newPage();
    await page.goto(LOGIN_URL, { waitUntil: "domcontentloaded" });
    let token = await accessToken(page);
    if (token && !(await validToken(token))) {
      await page.evaluate(() => {
        for (let index = localStorage.length - 1; index >= 0; index -= 1) {
          const key = localStorage.key(index);
          if (key?.toLowerCase().includes("token")) localStorage.removeItem(key);
        }
      });
      token = null;
      console.log("만료된 유니크플레이 세션을 새로 갱신합니다.");
    }

    if (!token && automatic) {
      await page.getByPlaceholder("이메일").fill(email);
      await page.getByPlaceholder("비밀번호").fill(password);
      await page.getByText("로그인", { exact: true }).last().click();
      token = await accessToken(page, 30_000);
      if (!token) throw new Error("유니크플레이 자동 로그인에 실패했습니다. 계정 정보 또는 추가 인증 여부를 확인하세요.");
      console.log("유니크플레이 자동 로그인 완료");
    } else if (!token) {
      console.log("열린 Edge 창에서 유니크플레이 관리자 계정으로 로그인하세요.");
      token = await accessToken(page, 5 * 60_000);
    } else {
      console.log("저장된 유니크플레이 로그인 세션을 재사용합니다.");
    }

    if (!token || typeof token !== "string") throw new Error("유니크플레이 로그인 토큰을 확인하지 못했습니다.");
    return { context, page, token };
  } catch (error) {
    await context.close();
    throw error;
  }
}
