import { useTranslation } from 'react-i18next';
import { useEffect, useRef, useState } from 'react';
import { Icons } from '../../components/common/Icons';
import { useAuthStore } from '../../state/useAuthStore';
import {
  listContactMessages,
  setContactMessageStatus,
  type ContactMessage,
} from '../../services/api/contactService';
import { Badge } from '../../components/common/Badge';
import {
  createRoom,
  listMessages,
  listRooms,
  listStaff,
  markRoomRead,
  sendMessage as sendMessageApi,
  type ChatMessage,
  type StaffDirectoryEntry,
} from '../../services/api/messageService';

type Convo = { id: string; from: string; subject: string; time: string; unread: boolean; staffId?: string };

type ChatMsg = {
  id: string;
  from: 'them' | 'me';
  text?: string;
  time: string;
  voice?: boolean;
  file?: { name: string; size: string };
};

const WAVE = [4, 9, 6, 12, 7, 14, 8, 11, 5, 10, 6, 13, 7, 9, 4, 8];

function initials(name: string): string {
  return name.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase();
}

function formatTime(value: string): string {
  return new Date(value).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function mapMessage(message: ChatMessage, currentUserId: string): ChatMsg {
  const attachment = message.attachments[0];
  return {
    id: message.id,
    from: message.senderId === currentUserId ? 'me' : 'them',
    text: message.body,
    time: formatTime(message.createdAt),
    file: attachment ? { name: attachment.filename, size: `${Math.max(1, Math.round((attachment.sizeBytes ?? 0) / 1024))} KB` } : undefined,
  };
}

/**
 * Public website enquiries, kept visually and structurally separate from the
 * clinical staff chat above. These rows come from `GET /api/contact-messages`
 * and carry NO clinical data — only what an anonymous visitor typed.
 */
function PublicContactPanel() {
  const { t } = useTranslation();
  const [items, setItems] = useState<ContactMessage[] | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [error, setError] = useState(false);

  const load = async () => {
    setError(false);
    try {
      setItems(await listContactMessages());
    } catch {
      setItems([]);
      setError(true);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const open = async (message: ContactMessage) => {
    setOpenId(message.id);
    if (message.status === 'new') {
      // Persist new -> read so the status survives a refresh.
      try {
        const updated = await setContactMessageStatus(message.id, 'read');
        setItems((prev) => (prev ?? []).map((m) => (m.id === updated.id ? updated : m)));
      } catch { /* keep the list usable even if the status write failed */ }
    }
  };

  return (
    <section className="flex min-h-[520px] flex-col overflow-hidden rounded-2xl bg-messaging p-4 shadow-card-soft sm:p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-sm font-bold text-ink">{t('messages.publicContacts')}</h2>
        <button
          type="button"
          onClick={() => void load()}
          className="rounded-lg px-2 py-1 text-xs font-semibold text-[#5B6AD0] transition-colors hover:bg-canvas"
        >
          {t('common.refresh')}
        </button>
      </div>

      {error ? <p className="text-sm text-danger">{t('messages.publicContactsLoadError')}</p> : null}

      {items === null ? (
        <p className="text-sm text-ink-muted">{t('common.loading')}</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-ink-muted">{t('messages.publicContactsEmpty')}</p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
          <div className="space-y-1.5 overflow-y-auto">
            {items.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => void open(m)}
                aria-pressed={openId === m.id}
                className={`w-full rounded-2xl p-3 text-left transition-colors ${
                  openId === m.id ? 'bg-[#5B6AD0] text-white' : 'bg-surface text-ink hover:bg-surface/80'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className={`min-w-0 flex-1 truncate text-sm font-semibold ${openId === m.id ? 'text-white' : 'text-ink'}`}>
                    {m.name}
                  </p>
                  {m.status === 'new' ? <span className="h-2 w-2 shrink-0 rounded-full bg-primary" /> : null}
                </div>
                <p className={`mt-0.5 line-clamp-2 text-xs ${openId === m.id ? 'text-white/80' : 'text-ink-muted'}`}>
                  {m.message}
                </p>
                <p className={`mt-0.5 text-[10px] ${openId === m.id ? 'text-white/60' : 'text-ink-muted'}`}>
                  {t('messages.sourceWebsite')} · {m.createdAt ? formatTime(m.createdAt) : '—'}
                </p>
              </button>
            ))}
          </div>

          <div className="min-h-[220px] rounded-2xl bg-surface p-5">
            {(() => {
              const activeItem = items.find((m) => m.id === openId);
              if (!activeItem) {
                return <p className="text-sm text-ink-muted">{t('messages.selectPublicMessage')}</p>;
              }
              return (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-base font-bold text-ink">{activeItem.name}</p>
                    <Badge label={activeItem.status} variant={activeItem.status === 'new' ? 'medium' : 'high'} />
                  </div>
                  <p className="text-xs text-ink-muted">
                    {t('messages.sourceLabel')}: {t('messages.sourceWebsite')} ·{' '}
                    {activeItem.createdAt ? new Date(activeItem.createdAt).toLocaleString() : '—'}
                  </p>
                  {/* Rendered as text, never as HTML. */}
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink">{activeItem.message}</p>
                  {activeItem.status !== 'replied' ? (
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          const updated = await setContactMessageStatus(activeItem.id, 'replied');
                          setItems((prev) => (prev ?? []).map((m) => (m.id === updated.id ? updated : m)));
                        } catch { /* leave the status unchanged if the write failed */ }
                      }}
                      className="rounded-xl border border-line px-3 py-1.5 text-xs font-semibold text-[#5B6AD0] transition-colors hover:bg-canvas"
                    >
                      {t('messages.markReplied')}
                    </button>
                  ) : null}
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </section>
  );
}

export default function MessagesPage() {
  const { t } = useTranslation();
  const currentUser = useAuthStore((state) => state.user);
  const [convos, setConvos] = useState<Convo[]>([]);
  const [staff, setStaff] = useState<StaffDirectoryEntry[]>([]);
  const [threads, setThreads] = useState<Record<string, ChatMsg[]>>({});
  const [selected, setSelected] = useState<string | null>(null);
  const [view, setView] = useState<'chat' | 'call'>('chat');
  const [muted, setMuted] = useState(false);
  const [camOn, setCamOn] = useState(false);
  const [draft, setDraft] = useState('');
  const [section, setSection] = useState<'staff' | 'public'>('staff');
  const [attachment, setAttachment] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const active = selected != null ? (convos.find((c) => c.id === selected) ?? null) : null;
  const activeStaff = active?.staffId ? staff.find((member) => member.id === active.staffId) : undefined;
  const contact = activeStaff ? { initials: initials(activeStaff.fullName), role: `${activeStaff.role} · ${activeStaff.specialization ?? 'Staff'}`, online: false, status: 'Availability unavailable' } : undefined;
  const thread = selected != null ? (threads[selected] ?? []) : [];
  const files = thread.flatMap((message) => message.file ? [message.file] : []);

  useEffect(() => {
    let mounted = true;
    void Promise.all([listRooms(), listStaff('doctor')]).then(([loadedRooms, loadedStaff]) => {
      if (!mounted) return;
      setStaff(loadedStaff);
      const next = loadedRooms.map((room) => {
        const otherId = room.participantIds.find((id) => id !== currentUser?.id);
        const member = loadedStaff.find((entry) => entry.id === otherId);
        return { id: room.id, from: member?.fullName ?? room.name ?? 'Staff conversation', subject: 'Real conversation', time: formatTime(room.createdAt), unread: false, staffId: member?.id };
      });
      const roomParticipants = new Set(loadedRooms.flatMap((room) => room.participantIds));
      const discoverable = loadedStaff.filter((member) => member.id !== currentUser?.id && !roomParticipants.has(member.id));
      setConvos([...next, ...discoverable.map((member) => ({ id: `new:${member.id}`, from: member.fullName, subject: 'Start conversation', time: '', unread: false, staffId: member.id }))]);
    });
    return () => { mounted = false; };
  }, [currentUser?.id]);

  useEffect(() => {
    if (!selected || selected.startsWith('new:')) return;
    const load = () => void listMessages(selected).then((messages) => {
      if (currentUser?.id) setThreads((previous) => ({ ...previous, [selected]: messages.map((message) => mapMessage(message, currentUser.id)) }));
      void markRoomRead(selected);
    });
    load();
    const interval = window.setInterval(load, 5000);
    return () => window.clearInterval(interval);
  }, [selected, currentUser?.id]);

  // Auto-scroll to the latest message whenever the thread changes or the chat opens.
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [selected, view, threads]);

  const openConversation = (id: string) => {
    setSelected(id);
    setView('chat');
    setConvos((prev) => prev.map((c) => (c.id === id ? { ...c, unread: false } : c)));
  };

  const fmtSize = (bytes: number) =>
    bytes >= 1024 * 1024
      ? `${(bytes / (1024 * 1024)).toFixed(1)} MB`
      : `${Math.max(1, Math.round(bytes / 1024))} KB`;

  const sendMessage = async () => {
    if (selected == null || (!draft.trim() && !attachment)) return;
    let roomId = selected;
    if (selected.startsWith('new:')) {
      const staffId = selected.slice(4);
      const member = staff.find((entry) => entry.id === staffId);
      if (!currentUser?.id || !member) return;
      const room = await createRoom([currentUser.id, member.id], member.fullName);
      roomId = room.id;
      setConvos((previous) => previous.map((conversation) => conversation.id === selected ? { ...conversation, id: room.id } : conversation));
      setSelected(room.id);
    }
    const message = await sendMessageApi(roomId, draft.trim() || undefined, attachment ? [{ filename: attachment.name, sizeBytes: attachment.size, contentType: attachment.type }] : []);
    if (currentUser?.id) setThreads((previous) => ({ ...previous, [roomId]: [...(previous[roomId] ?? []), mapMessage(message, currentUser.id)] }));
    setDraft('');
    setAttachment(null);
    if (composerRef.current) composerRef.current.style.height = 'auto';
  };

  return (
    <div className="flex h-full flex-col gap-6">
      <div>
        <div className="overflow-hidden pb-1 pt-1"><h1 className="text-2xl font-extrabold text-heading">{t('nav.messages')}</h1></div>
        <p className="subtitle-typewriter text-sm text-ink-muted">{t('app.systemName')}</p>
      </div>

      {/* Section switcher — clinical staff chat and public website enquiries are
          deliberately two separate areas, never a blended list. */}
      <div role="tablist" aria-label={t('messages.sectionsLabel')} className="flex flex-wrap gap-2">
        {([['staff', t('messages.sectionStaff')], ['public', t('messages.sectionPublic')]] as const).map(
          ([key, label]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={section === key}
              onClick={() => setSection(key)}
              className={`rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${
                section === key
                  ? 'bg-[#5B6AD0] text-white'
                  : 'bg-surface text-ink-muted hover:text-ink'
              }`}
            >
              {label}
            </button>
          ),
        )}
      </div>

      {section === 'public' ? (
        <PublicContactPanel />
      ) : (
      <>
      {/* Conversation workspace — lavender canvas with two floating white cards */}
      <div className="flex min-h-[520px] flex-1 flex-col overflow-hidden rounded-2xl bg-messaging p-4 sm:p-6">
        <div className="grid min-h-0 flex-1 gap-6 lg:grid-cols-[320px_minmax(0,1fr)_340px]">
          {/* Message list — mobile: only pane when nothing is selected */}
          <section className={`${selected !== null ? 'hidden' : 'flex'} min-h-0 flex-col overflow-hidden rounded-3xl bg-surface shadow-card-soft lg:flex`}>
            <div className="flex items-center gap-2 border-b border-line bg-canvas/60 px-4 py-2.5">
              <Icons.search width={16} height={16} className="shrink-0 text-ink-muted" />
              <input
                placeholder={t('messages.searchPlaceholder')}
                className="h-9 min-w-0 flex-1 bg-transparent text-sm text-ink focus:outline-none"
              />
            </div>
            <div className="space-y-1.5 p-3">
              {convos.map((m) => (
                <button
                  key={m.id}
                  onClick={() => openConversation(m.id)}
                  aria-pressed={selected === m.id}
                  className={`w-full rounded-2xl p-3 text-left transition-colors active:scale-[0.99] ${selected === m.id ? 'bg-[#5B6AD0] text-white shadow-card-soft' : 'text-ink-muted hover:bg-canvas/60'}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className={`min-w-0 flex-1 truncate text-sm font-semibold ${selected === m.id || m.unread ? (selected === m.id ? 'text-white' : 'text-ink') : 'text-ink-muted'}`}>{m.from}</p>
                    {m.unread && <span className={`h-2 w-2 shrink-0 rounded-full ${selected === m.id ? 'bg-white' : 'bg-primary'}`} />}
                  </div>
                  <p className={`mt-0.5 truncate text-xs ${selected === m.id ? 'text-white/80' : 'text-ink-muted'}`}>{m.subject}</p>
                  <p className={`mt-0.5 text-[10px] ${selected === m.id ? 'text-white/60' : 'text-ink-muted'}`}>{m.time}</p>
                </button>
              ))}
            </div>
          </section>

          {/* Center column — chat first, call on demand (mobile: only pane when selected) */}
          <section className={`${selected == null ? 'hidden' : 'flex'} min-h-0 flex-col gap-5 lg:flex`}>
            {selected != null && contact && active ? (
              view === 'call' ? (
                <div key="call" className="flex min-h-0 flex-1 animate-view flex-col">
                  {/* Video call window (16:9) — light neutral feed */}
                  <div className="relative min-h-[320px] flex-1 overflow-hidden rounded-3xl bg-slate-200 ring-1 ring-line shadow-card-soft">
                  <p className="absolute right-4 top-4 z-10 rounded-full bg-white/75 px-3 py-1.5 text-[10px] font-semibold text-ink-muted backdrop-blur">{t('messages.callPrototype')}</p>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/70 text-lg font-bold text-[#5B6AD0] ring-1 ring-white/60 backdrop-blur">
                      {contact.initials}
                    </div>
                  </div>
                  <div className="absolute left-4 top-4 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setView('chat')}
                      aria-label={t('messages.backToChat')}
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/70 text-[#5B6AD0] ring-1 ring-white/60 backdrop-blur-md transition-colors hover:bg-white"
                    >
                      {Icons.chevronLeft({ width: 16, height: 16 })}
                    </button>
                    <div className="flex items-center gap-2 rounded-full bg-white/70 px-3 py-1.5 ring-1 ring-white/60 backdrop-blur-md">
                      <span className="h-2 w-2 rounded-full bg-red-400" />
                      <p className="text-xs font-semibold text-ink">{active.from}</p>
                      <span className="text-[10px] text-ink-muted">12:34</span>
                    </div>
                  </div>
                  {!camOn && (
                    <div className="absolute inset-0 flex items-center justify-center bg-slate-100/80 backdrop-blur">
                      <p className="text-xs font-semibold text-ink-muted">Camera is off</p>
                    </div>
                  )}
                  <div className="absolute bottom-16 right-4 flex h-20 w-28 items-center justify-center overflow-hidden rounded-xl border border-white/60 bg-white/70 backdrop-blur-md">
                    <span className="text-[10px] font-semibold text-ink-muted">You</span>
                  </div>
                  {/* Floating glassmorphic control bar */}
                  <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full bg-white/70 p-2 ring-1 ring-white/60 backdrop-blur-md">
                    <button
                      type="button"
                      aria-pressed={muted}
                      onClick={() => setMuted(!muted)}
                      className={`flex h-9 w-9 items-center justify-center rounded-full transition-colors ${muted ? 'bg-red-500 text-white' : 'bg-white text-[#5B6AD0] shadow-sm hover:bg-slate-100'}`}
                    >
                      {muted ? Icons.micOff({ width: 16, height: 16 }) : Icons.mic({ width: 16, height: 16 })}
                    </button>
                    <button
                      type="button"
                      aria-pressed={!camOn}
                      onClick={() => setCamOn(!camOn)}
                      className={`flex h-9 w-9 items-center justify-center rounded-full transition-colors ${camOn ? 'bg-white text-[#5B6AD0] shadow-sm hover:bg-slate-100' : 'bg-red-500 text-white'}`}
                    >
                      {Icons.video({ width: 16, height: 16 })}
                    </button>
                    <button
                      type="button"
                      onClick={() => setView('chat')}
                      aria-label={t('messages.endCall')}
                      className="flex h-9 w-9 items-center justify-center rounded-full bg-red-500 text-white transition-colors hover:bg-red-600"
                    >
                      {Icons.phoneOff({ width: 16, height: 16 })}
                    </button>
                  </div>
                </div>
                </div>
              ) : (
                <div key="chat" className="flex min-h-0 flex-1 animate-view flex-col overflow-hidden rounded-3xl bg-surface shadow-card-soft">
                  {/* Chat header — contact identity + call action */}
                  <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
                    <div className="flex min-w-0 items-center gap-2 sm:gap-3">
                      <button
                        type="button"
                        onClick={() => setSelected(null)}
                        aria-label={t('messages.backToChat')}
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-canvas hover:text-ink lg:hidden"
                      >
                        {Icons.chevronLeft({ width: 18, height: 18 })}
                      </button>
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#5B6AD0]/10 text-sm font-bold text-[#5B6AD0]">
                        {contact.initials}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-ink">{active.from}</p>
                        <p className="flex items-center gap-1.5 truncate text-xs text-ink-muted">
                          <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${contact.online ? 'bg-emerald-500' : 'bg-ink-muted/50'}`} />
                          {contact.online ? t('messages.online') : t('messages.lastSeen', { time: contact.status })}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setView('call')}
                      aria-label={t('messages.startCall')}
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-canvas hover:text-[#5B6AD0]"
                    >
                      {Icons.phone({ width: 18, height: 18 })}
                    </button>
                  </div>
                  <div className="flex-1 space-y-3 overflow-y-auto p-5">
                    {thread.map((msg, i) =>
                      msg.voice ? (
                        <div key={i} className="flex justify-start">
                          <div className="bubble-received flex items-center gap-3 bg-canvas px-4 py-3 shadow-card-soft">
                            <button
                              type="button"
                              aria-label="Play voice message"
                              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#5B6AD0] text-white transition-colors hover:bg-[#4a58b8]"
                            >
                              {Icons.play({ width: 14, height: 14 })}
                            </button>
                            <div className="flex h-6 items-center gap-[3px]">
                              {WAVE.map((h, j) => (
                                <span key={j} className="w-[3px] rounded-full bg-ink-muted/60" style={{ height: `${h}px` }} />
                              ))}
                            </div>
                            <span className="text-[10px] font-semibold text-ink-muted">0:14</span>
                          </div>
                        </div>
                      ) : msg.file ? (
                        <div key={i} className={`flex ${msg.from === 'me' ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-[85%] px-3 py-3 shadow-card-soft ${msg.from === 'me' ? 'bubble-sent' : 'bubble-received bg-canvas text-ink'}`}>
                            <div className="flex items-center gap-3">
                              <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${msg.from === 'me' ? 'bg-white/15 text-white' : 'bg-surface text-ink-muted'}`}>
                                {Icons.fileText({ width: 16, height: 16 })}
                              </span>
                              <div className="min-w-0">
                                <p className={`truncate text-xs font-semibold ${msg.from === 'me' ? 'text-white' : 'text-ink'}`}>{msg.file.name}</p>
                                <p className={`text-[10px] ${msg.from === 'me' ? 'text-white/70' : 'text-ink-muted'}`}>{msg.file.size}</p>
                              </div>
                              <button
                                type="button"
                                aria-label={`Download ${msg.file.name}`}
                                className={`shrink-0 transition-colors ${msg.from === 'me' ? 'text-white/80 hover:text-white' : 'text-ink-muted hover:text-[#5B6AD0]'}`}
                              >
                                {Icons.download({ width: 16, height: 16 })}
                              </button>
                            </div>
                            <p className={`mt-1 text-right text-[10px] ${msg.from === 'me' ? 'text-white/70' : 'text-ink-muted'}`}>{msg.time}</p>
                          </div>
                        </div>
                      ) : (
                        <div key={i} className={`flex ${msg.from === 'me' ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-[80%] px-4 py-2.5 shadow-card-soft ${msg.from === 'me' ? 'bubble-sent' : 'bubble-received bg-canvas text-ink'}`}>
                            <p className="text-sm leading-relaxed">{msg.text}</p>
                            <p className={`mt-1 text-right text-[10px] ${msg.from === 'me' ? 'text-white/70' : 'text-ink-muted'}`}>{msg.time}</p>
                          </div>
                        </div>
                      ),
                    )}
                    <div ref={endRef} />
                  </div>
                  {/* Composer — pill container with attach preview */}
                  <div className="border-t border-line p-3">
                    {attachment && (
                      <div className="mb-2 flex items-center gap-3 rounded-xl border border-line bg-canvas px-3 py-2">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface text-ink-muted">
                          {Icons.fileText({ width: 14, height: 14 })}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-semibold text-ink">{attachment.name}</p>
                          <p className="text-[10px] text-ink-muted">{fmtSize(attachment.size)}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setAttachment(null)}
                          aria-label={t('messages.removeAttachment')}
                          className="shrink-0 text-ink-muted transition-colors hover:text-danger"
                        >
                          {Icons.x({ width: 14, height: 14 })}
                        </button>
                      </div>
                    )}
                    <input
                      ref={fileRef}
                      type="file"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) setAttachment(f);
                        e.target.value = '';
                      }}
                    />
                    <div className="flex items-end gap-1.5 rounded-full border border-line bg-canvas py-1 pl-1.5 pr-1 transition-colors focus-within:border-[#5B6AD0]">
                      <button
                        type="button"
                        onClick={() => fileRef.current?.click()}
                        aria-label={t('messages.attachFile')}
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-surface hover:text-[#5B6AD0]"
                      >
                        {Icons.plus({ width: 16, height: 16 })}
                      </button>
                      <textarea
                        ref={composerRef}
                        rows={1}
                        value={draft}
                        placeholder={t('messages.typePlaceholder')}
                        onChange={(e) => {
                          setDraft(e.target.value);
                          e.target.style.height = 'auto';
                          e.target.style.height = `${Math.min(e.target.scrollHeight, 96)}px`;
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            sendMessage();
                          }
                        }}
                        className="max-h-24 min-w-0 flex-1 resize-none bg-transparent py-2 text-sm leading-relaxed text-ink outline-none"
                      />
                      <button
                        type="button"
                        onClick={sendMessage}
                        disabled={!draft.trim() && !attachment}
                        aria-label={t('messages.sendMessage')}
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#5B6AD0] text-white transition-all hover:bg-[#4a58b8] disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {Icons.send({ width: 16, height: 16 })}
                      </button>
                    </div>
                  </div>
                </div>
              )
            ) : (
              <div className="flex min-h-[420px] flex-1 items-center justify-center rounded-3xl bg-surface px-5 text-center text-sm text-ink-muted shadow-card-soft">
                {t('messages.noConversation')}
              </div>
            )}
          </section>

          {/* Right column — doctor info + shared files */}
          <aside className="hidden min-h-0 flex-col gap-5 lg:flex">
              <section className="rounded-3xl bg-surface p-5 shadow-card-soft">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#5B6AD0]/10 text-sm font-bold text-[#5B6AD0]">
                  {activeStaff ? initials(activeStaff.fullName) : '—'}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-ink">{activeStaff?.fullName ?? 'No staff selected'}</p>
                  <p className="truncate text-xs text-ink-muted">{contact?.role ?? 'Select a conversation'}</p>
                </div>
              </div>
              <p className="mt-4 text-xs text-ink-muted">Presence is not available from the backend.</p>
            </section>

            <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-3xl bg-surface shadow-card-soft">
              <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
                <h3 className="text-sm font-bold text-ink">Shared files</h3>
                <span className="text-[10px] font-semibold text-ink-muted">{files.length} items</span>
              </div>
              <div className="flex-1 space-y-1 overflow-y-auto p-3">
                {files.map((f) => (
                  <div key={f.name} className="flex items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-canvas/60">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-canvas text-ink-muted">
                      {Icons.fileText({ width: 16, height: 16 })}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-semibold text-ink">{f.name}</p>
                      <p className="text-[10px] text-ink-muted">{f.size}</p>
                    </div>
                    <button
                      type="button"
                      aria-label={`Download ${f.name}`}
                      className="shrink-0 text-ink-muted transition-colors hover:text-[#5B6AD0]"
                    >
                      {Icons.download({ width: 16, height: 16 })}
                    </button>
                  </div>
                ))}
              </div>
            </section>
          </aside>
        </div>
      </div>
      </>
      )}
    </div>
  );
}
