// 변호사 찾아보기 검산(07 5-4) — node scripts/lawyer-check.mjs
// rolldown(vite 의존성)으로 src/lib/lawyerMatch.ts + src/data/lawyers.ts 를 메모리에서 번들해 실행한다. 파일을 남기지 않는다.
import { rolldown } from 'rolldown'
import { fileURLToPath } from 'node:url'

const entry = fileURLToPath(new URL('../src/lib/lawyerMatch.ts', import.meta.url))
const bundle = await rolldown({ input: entry, logLevel: 'silent' })
const { output } = await bundle.generate({ format: 'esm' })
await bundle.close()
const m = await import('data:text/javascript;base64,' + Buffer.from(output[0].code).toString('base64'))
const { matchLawyers, EXAMPLE_CRITERIA, LEVELS } = m

let failed = 0
const ok = (cond, msg) => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${msg}`)
  if (!cond) failed += 1
}
const show = (title, r) => {
  console.log(`\n# ${title} — 후보 ${r.ranked.length}명 · 활성 기준 ${r.active.join('·')}`)
  for (const c of r.ranked) console.log(`  ${c.profile.name}  조건 일치 ${c.score}  | ${c.reason}`)
}
const score = (r, id) => r.ranked.find((c) => c.profile.id === id)?.score
const ids = (r) => r.ranked.map((c) => c.profile.id).join('')

// 1) 모든 기준 "선호" — A 100 · B 75 · C 65
const base = structuredClone(EXAMPLE_CRITERIA)
ok(base.levels.method === 'prefer' && base.levels.region === 'prefer' && base.levels.budget === 'prefer' && base.levels.timing === 'prefer', '예시 조건 = 모든 기준 선호')
const r1 = matchLawyers(base)
show('예시 조건(주제 2개·방문·서울 동북권·5만원 이하·3일 이내)', r1)
ok(score(r1, 'a') === 100, `A = 100 (실제 ${score(r1, 'a')})`)
ok(score(r1, 'b') === 75, `B = 75 지역·시점 불일치 (실제 ${score(r1, 'b')})`)
ok(score(r1, 'c') === 65, `C = 65 주제 1/2·예산 초과 (실제 ${score(r1, 'c')})`)
ok(ids(r1).startsWith('abc'), `상위 3명 = A·B·C (실제 순서 ${ids(r1)})`)
ok(!ids(r1).includes('f') && !ids(r1).includes('h'), '주제가 겹치지 않는 F·H 제외')

// 2) 예산 "꼭 필요" — C(초과)·요금 미확인·20분 요금 제외
const r2 = matchLawyers({ ...base, levels: { ...base.levels, budget: 'must' } })
show('예산 꼭 필요', r2)
ok(score(r2, 'c') === undefined, 'C 제외(예산 초과)')
ok(score(r2, 'd') === undefined && score(r2, 'g') === undefined, '요금 미확인 D·G 제외(자동 통과 금지)')
ok(score(r2, 'e') === undefined, '20분 요금 E 제외(30분으로 환산하지 않음)')
ok(score(r2, 'a') === 100 && score(r2, 'b') === 75, 'A 100 · B 75 유지')

// 3) 전화만 — 지역 기준을 모든 후보의 분자·분모에서 제외
const r3 = matchLawyers({ ...base, methods: ['phone'] })
show('방식 전화만', r3)
ok(!r3.active.includes('region') && !r3.regionActive, '지역 기준 비활성')
ok(score(r3, 'a') === Math.round((100 * 85) / 85), `A = 100 (실제 ${score(r3, 'a')})`)
ok(score(r3, 'b') === Math.round((100 * 75) / 85), `B = round(7500/85) = 88 (실제 ${score(r3, 'b')})`)
ok(score(r3, 'c') === Math.round((100 * 50) / 85), `C = round(5000/85) = 59 (실제 ${score(r3, 'c')})`)

// 4) 동점은 확인일 최근 → ID 순, 같은 조건이면 같은 결과
const tie = r1.ranked.filter((c) => c.score === 20).map((c) => c.profile.id).join('')
ok(tie === 'eg', `동점 20점 E(09-27) → G(09-25) (실제 ${tie})`)
ok(ids(matchLawyers(base)) === ids(r1), '재실행 결과 동일')

// 5) 0명 — 조건을 바꾸지 않고 가장 많이 거른 꼭 필요 조건만 알린다
const zero = { ...base, topics: ['procedure'], budget: 'le30k', timing: 'today', levels: { ...base.levels, budget: 'must', timing: 'must' } }
const r5 = matchLawyers(zero)
console.log(`\n# 0명 조건 — 후보 ${r5.ranked.length}명 · 가장 많이 거른 조건 ${r5.blocker?.label} ${r5.blocker?.count}/${r5.blocker?.base}(미확인 ${r5.blocker?.unknown})`)
ok(r5.ranked.length === 0 && r5.blocker !== null, '0명 + 가장 많이 거른 조건 안내')

// 5-1) 1명 — 3명을 채우려고 후보를 만들지 않는다
const r51 = matchLawyers({ ...base, budget: 'le30k', levels: { ...base.levels, budget: 'must' } })
ok(ids(r51) === 'a', `예산 3만원 이하 꼭 필요 → A 1명만 (실제 ${ids(r51)})`)

// 6) 언어 꼭 필요 — 미확인(G) 제외, 점수에는 영향 없음
const r6 = matchLawyers({ ...base, language: 'en', levels: { ...base.levels, language: 'must' } })
show('언어 영어 꼭 필요', r6)
ok(ids(r6) === 'bd', `영어 확인된 B·D만 (실제 ${ids(r6)})`)
ok(score(r6, 'b') === 75, '언어는 점수에 넣지 않음(B 75 그대로)')
const r6b = matchLawyers({ ...base, language: 'en', levels: { ...base.levels, language: 'prefer' } })
ok(ids(r6b) === ids(r1), '언어 선호는 결과를 바꾸지 않음')

// 7) 상관없음은 모든 후보에서 제외
const r7 = matchLawyers({ ...base, levels: { ...base.levels, timing: 'any' } })
ok(!r7.active.includes('timing') && score(r7, 'b') === Math.round((100 * 75) / 90), `시점 상관없음 → B = round(7500/90) = 83 (실제 ${score(r7, 'b')})`)

// 8) 금지 표현 없음
const banned = ['승소', '최적', '반드시 선임', '임대차 전문', '보장']
const allReasons = [r1, r2, r3, r6, r7].flatMap((r) => r.ranked.map((c) => c.reason)).join(' ')
ok(!banned.some((w) => allReasons.includes(w)), '추천 이유에 금지 표현 없음')
ok(Array.isArray(LEVELS) && LEVELS.length === 3, '중요도 3단계')

console.log(`\n${failed === 0 ? '모두 통과' : `실패 ${failed}건`}`)
process.exit(failed === 0 ? 0 : 1)
