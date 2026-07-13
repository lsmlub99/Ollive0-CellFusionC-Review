'use client'

import { useState } from 'react'

const ACTION_TYPES = [
  '올영픽 신청',
  '광고 집행',
  '인플루언서 협업',
  '가격 조정',
  '패키지 변경',
  '이벤트/프로모션',
  '기타',
] as const

const TARGET_METRICS = ['순위 상승', '리뷰 증가', '재구매율 개선', '기타'] as const

export default function ActionLogWidget() {
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [form, setForm] = useState({
    action_type: ACTION_TYPES[0] as string,
    memo: '',
    target_metric: TARGET_METRICS[0] as string,
    goods_no: '',
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      await fetch('/api/brand-events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_date: new Date().toISOString().slice(0, 10),
          event_type: 'action_taken',
          event_detail: {
            action_type: form.action_type,
            memo: form.memo,
            target_metric: form.target_metric,
            goods_no: form.goods_no || null,
          },
        }),
      })
      setSaved(true)
      setForm({ action_type: ACTION_TYPES[0], memo: '', target_metric: TARGET_METRICS[0], goods_no: '' })
      setTimeout(() => { setSaved(false); setOpen(false) }, 1500)
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      {/* 플로팅 버튼 */}
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-24 right-6 z-50 flex items-center gap-2 bg-accent text-white rounded-full px-4 py-2.5 shadow-lg hover:brightness-110 transition text-sm font-medium"
        title="실행 기록 남기기"
      >
        <span className="text-base leading-none">+</span>
        실행 기록
      </button>

      {/* 모달 */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40">
          <div className="bg-background rounded-t-2xl sm:rounded-xl w-full sm:max-w-md p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-text-primary">실행 기록</h2>
              <button onClick={() => setOpen(false)} className="text-text-tertiary hover:text-text-primary text-lg leading-none">✕</button>
            </div>

            {saved ? (
              <div className="py-8 text-center text-accent font-medium">저장됐습니다 ✓</div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="text-xs font-medium text-text-secondary block mb-1">행동 유형</label>
                  <select
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-surface text-text-primary"
                    value={form.action_type}
                    onChange={e => setForm(f => ({ ...f, action_type: e.target.value }))}
                  >
                    {ACTION_TYPES.map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-medium text-text-secondary block mb-1">기대 목표</label>
                  <select
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-surface text-text-primary"
                    value={form.target_metric}
                    onChange={e => setForm(f => ({ ...f, target_metric: e.target.value }))}
                  >
                    {TARGET_METRICS.map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-medium text-text-secondary block mb-1">메모 <span className="text-text-tertiary font-normal">(선택)</span></label>
                  <textarea
                    rows={2}
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-surface text-text-primary resize-none"
                    placeholder="간단히 내용을 적어주세요"
                    value={form.memo}
                    onChange={e => setForm(f => ({ ...f, memo: e.target.value }))}
                  />
                </div>

                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="flex-1 border border-border rounded-lg py-2 text-sm text-text-secondary hover:bg-surface"
                  >
                    취소
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex-1 bg-accent text-white rounded-lg py-2 text-sm font-medium hover:brightness-110 disabled:opacity-50"
                  >
                    {saving ? '저장 중…' : '저장'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  )
}
