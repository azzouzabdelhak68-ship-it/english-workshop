import { useEffect } from 'react'
import { useApp } from '../context/AppContext'

export function CelebrationPopup() {
  const { t } = useApp()
  useEffect(() => {
    const timer = setTimeout(() => window.dispatchEvent(new Event('ew-close-celebration')), 4000)
    return () => clearTimeout(timer)
  }, [])
  return (
    <div className="fixed bottom-6 start-1/2 z-[60] w-11/12 max-w-sm -translate-x-1/2 max-md:start-4 max-md:translate-x-0 rtl:max-md:-translate-x-0">
      <div className="app-card animate-bounceIn border-s-4 border-ps-0 p-4" style={{ borderInlineStartColor: '#B08A57' }}>
        <p className="font-bold">{t('celebrationTitle')}</p>
        <p className="mt-1 text-sm opacity-80">{t('celebrationBody')}</p>
      </div>
    </div>
  )
}
