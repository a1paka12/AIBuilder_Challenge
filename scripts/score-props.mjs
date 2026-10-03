// 조건 일치 점수식의 수학적 성질을 무작위 조건 2,000개로 검사한다.
// 점수 = round(100 × Σ(활성 기준 가중치 × 일치값) ÷ Σ(활성 기준 가중치))
// 사용: node scripts/score-props.mjs   (rolldown으로 src/lib/lawyerMatch.ts 를 메모리에서 번들)
import { rolldown } from 'rolldown'
import { fileURLToPath } from 'node:url'

const entry = fileURLToPath(new URL('../src/lib/lawyerMatch.ts', import.meta.url))
const bundle = await rolldown({ input: entry, logLevel: 'silent' })
const { output } = await bundle.generate({ format: 'esm' })
await bundle.close()
const m = await import('data:text/javascript;base64,' + Buffer.from(output[0].code).toString('base64'))

const dataEntry = fileURLToPath(new URL('../src/data/lawyers.ts', import.meta.url))
const b2 = await rolldown({ input: dataEntry, logLevel: 'silent' })
const o2 = (await b2.generate({ format: 'esm' })).output
await b2.close()
const d = await import('data:text/javascript;base64,' + Buffer.from(o2[0].code).toString('base64'))
const { scoreOf, activeKeys, checkOf, WEIGHTS, LEVELS } = m
const { TOPICS, METHODS, REGIONS, BUDGETS, LAWYERS } = d
const TIMINGS = ['today', '3d', '2w']
const LANGS = ['ko', 'en', null]

// 재현 가능한 의사 난수(시드 고정)
let seed = 20261003
const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648)
const pick = (a) => a[Math.floor(rnd() * a.length)]
const subset = (a, min = 0) => {
  const s = a.filter(() => rnd() < 0.5)
  return s.length >= min ? s : [pick(a)]
}

function randomCriteria() {
  return {
    topics: subset([...TOPICS], 1),
    methods: subset([...METHODS], 1),
    region: pick([...REGIONS]),
    budget: pick([...BUDGETS]),
    timing: pick(TIMINGS),
    language: pick(LANGS),
    levels: { method: pick([...LEVELS]), region: pick([...LEVELS]), budget: pick([...LEVELS]), timing: pick([...LEVELS]), language: pick([...LEVELS]) },
  }
}

// 식을 처음부터 다시 계산(코드와 독립된 기준값)
function reference(p, c) {
  let num = 0
  let den = 0
  for (const k of activeKeys(c)) {
    const w = WEIGHTS[k]
    den += w
    if (k === 'topic') num += (w * c.topics.filter((t) => p.topics.includes(t)).length) / c.topics.length
    else num += checkOf(p, c, k) === 'yes' ? w : 0
  }
  return den === 0 ? 0 : Math.round((100 * num) / den)
}

const N = 2000
let fails = 0
const fail = (msg) => {
  fails++
  if (fails <= 5) console.log('FAIL', msg)
}
let checked = 0
for (let i = 0; i < N; i++) {
  const c = randomCriteria()
  const keys = activeKeys(c)
  // 1) 분모(활성 기준)는 모든 후보에게 같다 — 정보가 없는 후보만 분모를 줄여 유리해지지 않는다
  if (!keys.includes('topic')) fail('주제 기준이 빠짐')
  for (const p of LAWYERS) {
    const s = scoreOf(p, c)
    checked++
    // 2) 범위 0~100 정수
    if (!(Number.isInteger(s) && s >= 0 && s <= 100)) fail(`범위 밖 ${s}`)
    // 3) 독립 계산과 일치
    if (s !== reference(p, c)) fail(`독립 계산과 다름 ${s} vs ${reference(p, c)}`)
    // 4) 상관없음 기준은 점수에 영향 없음: 상관없음인 기준을 다른 값으로 바꿔도 점수 같음
    for (const k of ['method', 'budget', 'timing']) {
      if (c.levels[k] === 'any') {
        const c2 = structuredClone(c)
        c2[k === 'method' ? 'methods' : k] = k === 'method' ? [pick([...METHODS])] : k === 'budget' ? pick([...BUDGETS]) : pick(TIMINGS)
        if (scoreOf(p, c2) !== s) fail(`상관없음 ${k}가 점수를 바꿈`)
      }
    }
  }
  // 5) 방문을 고르지 않으면 지역은 계산에서 빠진다
  if (!c.methods.includes('visit') && keys.includes('region')) fail('방문 없이 지역 활성')
}

// 6) 모든 기준이 맞는 가상 후보는 100점, 모두 어긋나면 0점(주제는 최소 1개 겹쳐야 후보이므로 주제만 맞으면 40÷활성합)
const perfect = { ...LAWYERS[0], topics: [...TOPICS], methods: [...METHODS], regions: [...REGIONS], fee: { amount: 0, minutes: 30 }, availability: 'today', languages: ['ko', 'en'] }
for (let i = 0; i < 200; i++) {
  const c = randomCriteria()
  if (scoreOf(perfect, c) !== 100) fail(`모두 맞는데 100이 아님 ${scoreOf(perfect, c)}`)
}

console.log(`검사한 (조건, 후보) 쌍: ${checked}개 + 만점 검사 200개`)
console.log(fails === 0 ? '모두 통과: 범위 0~100 정수 · 독립 계산과 일치 · 상관없음 무영향 · 방문 없으면 지역 제외 · 모두 맞으면 100' : `실패 ${fails}건`)
process.exit(fails === 0 ? 0 : 1)
