// 가벼운 점검: 화면별 1회 로드 + axe(wcag2a/aa) 심각 등급만 + 콘솔 오류 + 모바일 스크린샷
// 준비: npm i -D playwright axe-core (저장소 의존성엔 넣지 않음) · 결과는 scripts/out/ 에 저장
// 사용: node check.js http://localhost:8420
const { chromium } = require('playwright')
const fs = require('fs')
const path = require('path')
const BASE = process.argv[2] || 'http://localhost:8420'
const OUT = path.join(__dirname, 'out')
fs.mkdirSync(OUT, { recursive: true })
const AXE = fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8')
const ROUTES = [
  ['home', '#/?nopopup=1'],
  ['deduct-sample', '#/deduct?sample=1&auto=1&nopopup=1'],
  ['record', '#/record'],
  ['cert', '#/cert'],
  ['pricing', '#/pricing'],
  ['privacy', '#/privacy'],
  ['event', '#/event'],
  ['help', '#/help'],
  ['lawyer', '#/lawyer'],
]

;(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true })
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'ko-KR' })
  const report = []
  for (const [name, hash] of ROUTES) {
    const page = await ctx.newPage()
    const errors = []
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text().slice(0, 200)))
    page.on('pageerror', (e) => errors.push('pageerror: ' + String(e.message).slice(0, 200)))
    await page.goto(BASE + '/' + hash, { waitUntil: 'networkidle', timeout: 20000 }).catch((e) => errors.push('goto: ' + e.message))
    if (name === 'deduct-sample') {
      await page.waitForFunction(() => document.body.innerText.includes('780,000'), null, { timeout: 25000 }).catch(() => errors.push('780,000 not shown'))
    } else {
      await page.waitForTimeout(800)
    }
    await page.addScriptTag({ content: AXE })
    const axe = await page.evaluate(async () => {
      const r = await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] }, resultTypes: ['violations'] })
      return r.violations
        .filter((v) => v.impact === 'critical' || v.impact === 'serious')
        .map((v) => ({ id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.length, sample: v.nodes.slice(0, 3).map((n) => n.target.join(' ')) }))
    })
    const text = (await page.evaluate(() => document.body.innerText)).slice(0, 4000)
    await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: true })
    report.push({ name, errors, axe, banned: ['부당', '판정', '돌려받을 수 있', '안 내도 됩니다', '기준과 다른', 'AI 변호사', '승소', 'ISMS-P', '전문 변호사', '이 사건에 최적', '반드시 선임', '회수액 보장', '완전 제거'].filter((w) => text.includes(w)) })
    await page.close()
  }
  await browser.close()
  fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2))
  for (const r of report) {
    console.log(`\n## ${r.name}: axe serious+ ${r.axe.length}, console errors ${r.errors.length}, banned words ${r.banned.join(',') || '-'}`)
    r.axe.forEach((v) => console.log(`  - [${v.impact}] ${v.id} (${v.nodes}) ${v.help} :: ${v.sample.join(' | ')}`))
    r.errors.forEach((e) => console.log(`  ! ${e}`))
  }
})()
