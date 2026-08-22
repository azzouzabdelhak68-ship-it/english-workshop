import { useEffect, useState } from 'react'

interface Piece {
  id: number
  left: number
  delay: number
  color: string
  emoji: string
}

const COLORS = ['#B08A57', '#0E2A3A', '#7FA6A8', '#F1EFE8', '#5B92AC']
const EMOJIS = ['🎉', '✨', '⭐', '🎊']

export function fireConfetti() {
  window.dispatchEvent(new Event('ew-confetti'))
}

export function ConfettiLayer() {
  const [pieces, setPieces] = useState<Piece[]>([])
  useEffect(() => {
    let counter = 0
    const onFire = () => {
      const batch: Piece[] = Array.from({ length: 40 }, () => ({
        id: counter++,
        left: Math.random() * 100,
        delay: Math.random() * 0.4,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        emoji: EMOJIS[Math.floor(Math.random() * EMOJIS.length)]
      }))
      setPieces((p) => [...p, ...batch])
      setTimeout(() => setPieces((p) => p.filter((x) => !batch.includes(x))), 2600)
    }
    window.addEventListener('ew-confetti', onFire)
    return () => window.removeEventListener('ew-confetti', onFire)
  }, [])
  if (pieces.length === 0) return null
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-[70] overflow-hidden">
      {pieces.map((p) => (
        <span
          key={p.id}
          className="absolute text-lg"
          style={{
            left: `${p.left}%`,
            top: '-24px',
            animation: `fall 2.2s ${p.delay}s ease-in forwards`,
            color: p.color
          }}
        >
          {Math.random() > 0.5 ? p.emoji : '●'}
        </span>
      ))}
      <style>{`@keyframes fall{to{transform:translateY(110vh) rotate(540deg);opacity:.7}}`}</style>
    </div>
  )
}
