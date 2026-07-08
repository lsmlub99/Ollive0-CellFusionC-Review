import { NextRequest, NextResponse } from 'next/server'
import { getBrandEvents, getBrandNames, saveBrandEvent } from '@/lib/db'

export async function GET(req: NextRequest) {
  const brand = req.nextUrl.searchParams.get('brand') ?? undefined
  const limit = parseInt(req.nextUrl.searchParams.get('limit') ?? '50')

  if (req.nextUrl.searchParams.get('names') === '1') {
    return NextResponse.json(await getBrandNames())
  }

  return NextResponse.json(await getBrandEvents(brand, limit))
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { event_date, event_type, brand_name, goods_no, category_name, event_detail } = body
    if (!event_date || !event_type) {
      return NextResponse.json({ error: 'event_date, event_type 필수' }, { status: 400 })
    }
    await saveBrandEvent({
      event_date,
      event_type: 'action_taken',
      brand_name: brand_name ?? null,
      goods_no: goods_no ?? null,
      category_name: category_name ?? null,
      event_detail: event_detail ?? {},
      source: 'user',
    })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
