import { useState } from 'react'
import { extractYouTubeId } from '../../lib/ai-chat'
import { useApp } from '../../context/AppContext'

export function VideoPreview({ url, title }: { url: string | null | undefined; title: string }) {
  const { t } = useApp()
  const [playing, setPlaying] = useState(false)
  const id = extractYouTubeId(url)
  if (!url) return null

  if (!id) {
    return (
      <a href={url} target="_blank" rel="noreferrer" className="text-xs underline opacity-70">
        🔗 {t('openExternal')}
      </a>
    )
  }

  if (!playing) {
    return (
      <div>
        <button
          onClick={() => setPlaying(true)}
          aria-label={`${t('watchPreview')}: ${title}`}
          className="group relative block aspect-video w-full overflow-hidden rounded-lg border border-mist-200 dark:border-mist-700"
        >
          <img
            src={`https://i.ytimg.com/vi/${id}/hqdefault.jpg`}
            alt=""
            loading="lazy"
            decoding="async"
            className="absolute inset-0 h-full w-full object-cover brightness-[.92]"
          />
          <span className="absolute inset-0 grid place-items-center">
            <span className="grid h-14 w-14 place-items-center rounded-full bg-black/60 text-xl text-white transition-colors group-hover:bg-petrol-700">
              ▶
            </span>
          </span>
        </button>
        <p className="mt-1 flex items-center justify-between text-xs opacity-60">
          <span>{t('watchPreview')}</span>
          <a href={url} target="_blank" rel="noreferrer" className="underline">{t('openExternal')}</a>
        </p>
      </div>
    )
  }

  return (
    <div className="aspect-video w-full overflow-hidden rounded-lg border border-mist-200 dark:border-mist-700">
      <iframe
        src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1`}
        title={title}
        allowFullScreen
        className="h-full w-full"
      />
    </div>
  )
}
