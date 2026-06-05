import { ImageResponse } from 'next/og'
import { NextRequest } from 'next/server'

export const runtime = 'edge'

export function GET(req: NextRequest) {
  const size = Math.min(512, Math.max(16, parseInt(req.nextUrl.searchParams.get('size') ?? '192')))

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #0f172a 0%, #1a3354 100%)',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: `${size * 0.02}px`,
          }}
        >
          <span
            style={{
              color: '#34d399',
              fontSize: `${size * 0.3}px`,
              fontWeight: '800',
              letterSpacing: '-0.03em',
              fontFamily: 'sans-serif',
              lineHeight: 1,
            }}
          >
            CFC
          </span>
          <span
            style={{
              color: '#64748b',
              fontSize: `${size * 0.09}px`,
              fontWeight: '500',
              letterSpacing: '0.12em',
              fontFamily: 'sans-serif',
            }}
          >
            INSIGHT
          </span>
        </div>
      </div>
    ),
    { width: size, height: size }
  )
}
