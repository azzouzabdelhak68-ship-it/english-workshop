import { useApp } from '../context/AppContext'
import { TextChatStream } from '../components/TextChatStream'

export function ChatView() {
  const { t } = useApp()
  return (
    <div className="mx-auto flex h-[calc(100dvh-9rem)] max-w-3xl flex-col px-4 pb-24 pt-6 md:pb-6">
      <div className="app-card min-h-0 flex-1 p-4">
        <TextChatStream table="chat_messages" placeholder={t('chatPlaceholder')} emptyLabel={t('noNotifications')} />
      </div>
    </div>
  )
}
