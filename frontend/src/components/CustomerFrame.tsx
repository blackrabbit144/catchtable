'use client'

export type Lang = 'ko' | 'en'

interface Props {
  lang: Lang
  onLangChange: (l: Lang) => void
  children: React.ReactNode
}

export default function CustomerFrame({ lang, onLangChange, children }: Props) {
  return (
    <div className="custWrap">
      <div className="custFrame">
        <p className="shopName">포켓몬카드샵</p>
        {children}
        <div className="langBar">
          <div className="langToggle">
            <button
              className={`langBtn${lang === 'ko' ? ' active' : ''}`}
              onClick={() => onLangChange('ko')}
            >
              한국어
            </button>
            <button
              className={`langBtn${lang === 'en' ? ' active' : ''}`}
              onClick={() => onLangChange('en')}
            >
              English
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
