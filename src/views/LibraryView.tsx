import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useApp } from '../context/AppContext'
import type { FileType, Resource, ResourceCategory } from '../lib/types'
import { FILE_TYPES, RESOURCE_CATEGORIES } from '../lib/constants'
import { Modal, Banner } from '../components/ui'

const ICONS: Record<FileType, string> = { PDF: '📄', Audio: '🎧', Note: '📖', Glossary: '📖' }

export function LibraryView() {
  const { t, isStaff } = useApp()
  const [items, setItems] = useState<Resource[]>([])
  const [query, setQuery] = useState('')
  const [cat, setCat] = useState<ResourceCategory | 'All'>('All')
  const [uploadOpen, setUploadOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState<ResourceCategory>('Grammar')
  const [fileType, setFileType] = useState<FileType>('PDF')
  const [note, setNote] = useState('')

  useEffect(() => {
    void reload()
  }, [])

  async function reload() {
    const { data } = await supabase.from('resources').select('*').order('created_at', { ascending: false })
    setItems((data as Resource[]) ?? [])
  }

  async function download(r: Resource) {
    if (r.file_url) {
      window.open(r.file_url, '_blank', 'noopener')
      await supabase.from('resources').update({ downloads: r.downloads + 1 }).eq('id', r.id)
      void reload()
    }
  }

  async function upload(e: React.FormEvent) {
    e.preventDefault()
    setNote('')
    const { error } = await supabase.from('resources').insert({ title: title.trim(), category, file_type: fileType })
    if (error) {
      setNote(error.message)
      return
    }
    setTitle('')
    setUploadOpen(false)
    void reload()
  }

  const filtered = items.filter(
    (r) =>
      (cat === 'All' || r.category === cat) &&
      (query.trim() === '' || r.title.toLowerCase().includes(query.toLowerCase()))
  )

  return (
    <div className="mx-auto max-w-4xl px-4 pb-24 pt-6 md:pb-10">
      {note && (
        <div className="mb-4">
          <Banner kind="err">{note}</Banner>
        </div>
      )}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input className="input-base max-w-xs" placeholder={t('search')} value={query} onChange={(e) => setQuery(e.target.value)} aria-label={t('search')} />
        {isStaff && (
          <button onClick={() => setUploadOpen(true)} className="btn-primary ms-auto">
            ⬆️ {t('uploadResource')}
          </button>
        )}
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        {(['All', ...RESOURCE_CATEGORIES] as const).map((c) => (
          <button
            key={c}
            onClick={() => setCat(c as ResourceCategory | 'All')}
            className={`pill min-h-[36px] px-4 ${cat === c ? 'bg-petrol-700 !text-white' : 'bg-mist-200 !text-mist-900 dark:bg-mist-800 dark:!text-mist-100'}`}
          >
            {c === 'All' ? t('allCategories') : c}
          </button>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {filtered.map((r) => (
          <article key={r.id} className="app-card p-5">
            <div className="mb-1 flex items-center gap-2 text-xs">
              <span className="text-2xl">{ICONS[r.file_type]}</span>
              <span className="pill bg-petrol-100 font-semibold text-petrol-800 dark:bg-petrol-800 dark:text-petrol-100">{r.category}</span>
            </div>
            <h3 className="mt-2 font-bold">{r.title}</h3>
            <p className="text-xs opacity-65">
              {r.size_label ?? `${r.file_type}`} • {r.downloads} ↓ •{' '}
              {t('addedOn', { date: new Date(r.created_at).toLocaleDateString() })}
            </p>
            {r.file_url && (
              <button onClick={() => void download(r)} className="btn-secondary mt-3 w-full py-2 text-sm">
                ⬇️ Download
              </button>
            )}
          </article>
        ))}
      </div>

      {isStaff && (
        <Modal open={uploadOpen} onClose={() => setUploadOpen(false)} title={t('uploadResource')}>
          <form onSubmit={upload} className="flex flex-col gap-3">
            <input required className="input-base" placeholder={t('announcementTitle')} value={title} onChange={(e) => setTitle(e.target.value)} />
            <select className="input-base" value={category} onChange={(e) => setCategory(e.target.value as ResourceCategory)}>
              {RESOURCE_CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
            <select className="input-base" value={fileType} onChange={(e) => setFileType(e.target.value as FileType)}>
              {FILE_TYPES.map((f) => (
                <option key={f}>{f}</option>
              ))}
            </select>
            {note && <Banner kind="err">{note}</Banner>}
            <button type="submit" className="btn-primary">
              {t('uploadResource')}
            </button>
          </form>
        </Modal>
      )}
    </div>
  )
}
