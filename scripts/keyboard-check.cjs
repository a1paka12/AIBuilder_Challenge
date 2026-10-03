// 키보드만으로 다 가는지 + 스크린리더가 읽을 내용 점검 (가볍게 1회)
// 준비: npm i -D playwright axe-core (저장소 의존성엔 넣지 않음) · 결과는 scripts/out/ 에 저장
// 사용: node kbd.js http://localhost:8420
const { chromium } = require('playwright')
const fs = require('fs')
const path = require('path')
const BASE = process.argv[2] || 'http://localhost:8420'
const OUT = path.join(__dirname, 'out')
fs.mkdirSync(OUT, { recursive: true })
const ROUTES = ['', 'deduct', 'record', 'lawyer', 'cert', 'pricing', 'privacy', 'event', 'help']

// 포커스된 요소 정보 + 실제로 포커스 표시가 보이는지
const FOCUS_INFO = () => {
  const el = document.activeElement
  if (!el || el === document.body) return null
  const cs = getComputedStyle(el)
  const r = el.getBoundingClientRect()
  const name = (el.getAttribute('aria-label') || (el.labels && el.labels[0] && el.labels[0].innerText) || el.innerText || el.value || el.getAttribute('title') || '').trim().replace(/\s+/g, ' ').slice(0, 60)
  return {
    key: el.outerHTML.slice(0, 120),
    tag: el.tagName.toLowerCase(),
    role: el.getAttribute('role') || '',
    name,
    visibleFocus: (cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0) || (cs.boxShadow && cs.boxShadow !== 'none'),
    size: [Math.round(r.width), Math.round(r.height)],
    inDialog: !!el.closest('[role="dialog"]'),
  }
}
// 키보드로 닿아야 하는 요소 목록(보이는 것만)
const INTERACTIVE = () =>
  [...document.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]):not([type=hidden]), select, textarea, [tabindex]:not([tabindex="-1"])')]
    .filter((el) => {
      const r = el.getBoundingClientRect()
      const cs = getComputedStyle(el)
      return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && !el.closest('[aria-hidden="true"]') && el.tabIndex >= 0
    })
    .map((el) => el.outerHTML.slice(0, 120))

// 스크린리더가 소리 내어 읽을 알림(aria-live/status/alert) 수집
const LIVE_HOOK = () => {
  window.__announce = []
  const seen = new WeakMap()
  const grab = () => {
    document.querySelectorAll('[aria-live], [role="status"], [role="alert"]').forEach((n) => {
      const t = n.innerText.trim().replace(/\s+/g, ' ')
      if (t && seen.get(n) !== t) {
        seen.set(n, t)
        window.__announce.push(t.slice(0, 120))
      }
    })
  }
  new MutationObserver(grab).observe(document, { subtree: true, childList: true, characterData: true })
}

;(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true })
  const report = {}

  // 1) 화면별 Tab 순회
  for (const r of ROUTES) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'ko-KR' })
    const page = await ctx.newPage()
    await page.goto(`${BASE}/#/${r}${r === 'deduct' ? '?sample=1&auto=1&nopopup=1' : '?nopopup=1'}`, { waitUntil: 'networkidle' })
    if (r === 'deduct') await page.waitForFunction(() => document.body.innerText.includes('780,000'), null, { timeout: 25000 }).catch(() => {})
    else await page.waitForTimeout(600)
    const should = await page.evaluate(INTERACTIVE)
    const order = []
    const reached = new Set()
    for (let i = 0; i < 160; i++) {
      await page.keyboard.press('Tab')
      const f = await page.evaluate(FOCUS_INFO)
      if (!f) continue
      if (reached.has(f.key) && order.length > 3 && f.key === order[0].key) break
      if (!reached.has(f.key)) order.push(f)
      reached.add(f.key)
    }
    const unreachable = should.filter((k) => !reached.has(k))
    const noFocusRing = order.filter((f) => !f.visibleFocus).map((f) => `${f.tag} "${f.name}"`)
    const small = order.filter((f) => f.size[1] < 24 || f.size[0] < 24).map((f) => `${f.tag} "${f.name}" ${f.size.join('x')}`)
    const aria = await page.locator('body').ariaSnapshot().catch((e) => 'ariaSnapshot failed: ' + e.message)
    fs.writeFileSync(path.join(OUT, `aria-${r || 'home'}.yml`), aria)
    report[r || 'home'] = { tabStops: order.length, unreachable, noFocusRing, small, first: order.slice(0, 6).map((f) => `${f.tag} "${f.name}"`) }
    await ctx.close()
  }

  // 2) 공제 정리 흐름을 키보드만으로: 예시 → 도배·장판 선택 → 550,000원 → 문자 복사
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'ko-KR', permissions: ['clipboard-read', 'clipboard-write'] })
    const page = await ctx.newPage()
    await page.addInitScript(LIVE_HOOK)
    await page.goto(`${BASE}/#/deduct?sample=1&auto=1&nopopup=1`, { waitUntil: 'networkidle' })
    const flow = []
    const ok780 = await page.waitForFunction(() => document.body.innerText.includes('780,000'), null, { timeout: 25000 }).then(() => true).catch(() => false)
    flow.push(`예시 정리 결과 표시: ${ok780}`)
    // 정리 결과 확인이 필요하면 "확인" 체크부터 — 이름에 도배/장판이 들어간 체크박스를 Tab으로 찾아 Space
    const tabTo = async (pred, max = 200) => {
      for (let i = 0; i < max; i++) {
        await page.keyboard.press('Tab')
        const hit = await page.evaluate(pred)
        if (hit) return hit
      }
      return null
    }
    // 행마다: "확인" 버튼(Enter) → "물어볼 항목" 체크박스(Space). 같은 행 텍스트로 항목을 찾는다
    const inRow = (word, test) => `(() => { const el = document.activeElement; if (!el) return null; const row = el.closest('tr, [role=row], li'); if (!row || !row.innerText.includes('${word}')) return null; ${test} })()`
    for (const word of ['도배', '장판']) {
      const confirmBtn = await tabTo(inRow(word, "return el.tagName === 'BUTTON' && /확인/.test(el.innerText) && !/확인 전/.test(el.innerText) ? (el.getAttribute('aria-label') || el.innerText).trim() : null"), 200)
      if (confirmBtn) { await page.keyboard.press('Enter'); flow.push(`Enter → ${word} 행 "${confirmBtn}"`) } else flow.push(`${word} 행 확인 버튼에 못 닿음`)
      await page.waitForTimeout(200)
      const box = await tabTo(inRow(word, "return el.type === 'checkbox' && !el.checked && !el.disabled ? (el.getAttribute('aria-label') || (el.labels && el.labels[0] ? el.labels[0].innerText : '체크박스')).trim() : null"), 40)
      if (box) { await page.keyboard.press('Space'); flow.push(`Space → ${word} 행 "${box}"`) } else flow.push(`${word} 행 체크박스에 못 닿음`)
    }
    await page.waitForTimeout(400)
    flow.push(`550,000원 표시: ${await page.evaluate(() => document.body.innerText.includes('550,000'))}`)
    const makeHit = await tabTo(`(() => { const el = document.activeElement; return el && el.tagName === 'BUTTON' && /문자 만들기/.test(el.innerText) ? el.innerText.trim() : null })()`, 200)
    if (makeHit) { await page.keyboard.press('Enter'); await page.waitForTimeout(400); flow.push(`Enter → "${makeHit}"`) } else flow.push('"문자 만들기"에 Tab으로 못 닿음')
    const copyHit = await tabTo(`(() => { const el = document.activeElement; return el && el.tagName === 'BUTTON' && /복사/.test(el.innerText) ? el.innerText.trim() : null })()`, 80)
    if (copyHit) { await page.keyboard.press('Enter'); await page.waitForTimeout(500); flow.push(`Enter → "${copyHit}"`) } else flow.push('복사 버튼에 Tab으로 못 닿음')
    flow.push('스크린리더 알림(aria-live/status/alert) 순서:')
    for (const a of await page.evaluate(() => window.__announce)) flow.push('  🔊 ' + a)
    report.flow_deduct = flow
    await ctx.close()
  }

  // 3) 첫 화면 팝업: 포커스가 대화상자 안에 갇히는지, Esc로 닫히는지
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'ko-KR' })
    const page = await ctx.newPage()
    await page.goto(`${BASE}/#/`, { waitUntil: 'networkidle' })
    const dlg = await page.waitForSelector('[role="dialog"]', { timeout: 4000 }).then(() => true).catch(() => false)
    const res = [`팝업 열림: ${dlg}`]
    if (dlg) {
      res.push(`처음 포커스: ${JSON.stringify(await page.evaluate(FOCUS_INFO))}`)
      let escaped = 0
      for (let i = 0; i < 20; i++) {
        await page.keyboard.press('Tab')
        const f = await page.evaluate(FOCUS_INFO)
        if (!f || !f.inDialog) escaped++
      }
      res.push(`Tab 20번 중 대화상자 밖으로 샌 횟수: ${escaped}`)
      await page.keyboard.press('Escape')
      await page.waitForTimeout(300)
      res.push(`Esc 후 닫힘: ${!(await page.$('[role="dialog"]'))}`)
    }
    report.popup = res
    await ctx.close()
  }

  // 4) 화면 이동 시 제목·포커스 (스크린리더가 새 화면을 알리는지)
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'ko-KR' })
    const page = await ctx.newPage()
    await page.goto(`${BASE}/#/?nopopup=1`, { waitUntil: 'networkidle' })
    const t0 = await page.title()
    await page.evaluate(() => (window.location.hash = '#/record'))
    await page.waitForTimeout(500)
    const t1 = await page.title()
    const f = await page.evaluate(() => { const el = document.activeElement; return el ? el.tagName + ' ' + (el.innerText || '').slice(0, 40) : null })
    report.route_change = [`제목: "${t0}" → "${t1}"`, `이동 후 포커스: ${f}`]
    await ctx.close()
  }

  await browser.close()
  fs.writeFileSync(path.join(OUT, 'kbd-report.json'), JSON.stringify(report, null, 2))
  for (const [k, v] of Object.entries(report)) {
    console.log(`\n## ${k}`)
    if (Array.isArray(v)) v.forEach((l) => console.log('  ' + l))
    else {
      console.log(`  Tab 정지 ${v.tabStops}개 · 못 닿음 ${v.unreachable.length} · 포커스 표시 없음 ${v.noFocusRing.length} · 24px 미만 ${v.small.length}`)
      v.unreachable.slice(0, 5).forEach((u) => console.log('   ✗ 못 닿음: ' + u))
      v.noFocusRing.slice(0, 5).forEach((u) => console.log('   ✗ 포커스 안 보임: ' + u))
      v.small.slice(0, 5).forEach((u) => console.log('   △ 작음: ' + u))
      console.log('   처음 순서: ' + v.first.join(' → '))
    }
  }
})()
