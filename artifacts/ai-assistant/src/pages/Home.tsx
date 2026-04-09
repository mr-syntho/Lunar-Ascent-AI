import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  Search, Code2, AlignLeft, ImageIcon, X,
  Trash2, Sun, Moon, Link as LinkIcon, Send, Loader2,
  ChevronDown, ChevronUp, Clock, Cpu, History, User
} from "lucide-react";
import {
  useAiQuery, useGetHistory, getGetHistoryQueryKey,
  useClearHistory, useDeleteHistoryItem, useGetStats
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import SettingsModal, { BotConfig, UserProfile, TaskType } from "@/components/SettingsModal";

const TASK_TYPES: { type: TaskType; icon: React.ReactNode; label: string; color: string }[] = [
  { type: "search",    icon: <Search className="w-3.5 h-3.5" />,    label: "Search",    color: "text-blue-500" },
  { type: "code",      icon: <Code2 className="w-3.5 h-3.5" />,     label: "Code",      color: "text-emerald-500" },
  { type: "summarize", icon: <AlignLeft className="w-3.5 h-3.5" />, label: "Summarize", color: "text-violet-500" },
  { type: "image",     icon: <ImageIcon className="w-3.5 h-3.5" />, label: "Image",     color: "text-rose-500" },
];

const TASK_COLORS: Record<TaskType, string> = {
  search:    "text-blue-500",
  code:      "text-emerald-500",
  summarize: "text-violet-500",
  image:     "text-rose-500",
};

const TASK_RING: Record<TaskType, string> = {
  search:    "ring-blue-400/30",
  code:      "ring-emerald-400/30",
  summarize: "ring-violet-400/30",
  image:     "ring-rose-400/30",
};

function loadFromStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function saveToStorage(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* noop */ }
}

const DEFAULT_PROFILE: UserProfile = {
  username: "User",
  avatarColor: "#6366f1",
  avatarInitials: "U",
};

interface Message {
  id: number;
  query: string;
  taskType: string;
  result: string;
  imageUrl?: string | null;
  sources: string[];
  createdAt: string;
  botName?: string;
}

function MarkdownResult({ text }: { text: string }) {
  const parts = text.split(/(```[\s\S]*?```)/g);
  return (
    <div className="space-y-3">
      {parts.map((part, i) => {
        if (part.startsWith("```")) {
          const match = part.match(/^```(\w*)\n?([\s\S]*?)```$/);
          const lang = match?.[1] ?? "";
          const code = match?.[2] ?? part.slice(3, -3);
          return (
            <div key={i} className="rounded-xl overflow-hidden border border-border/40">
              {lang && (
                <div className="px-3 py-1.5 bg-foreground/[0.04] text-[10px] font-semibold font-mono text-muted-foreground border-b border-border/30 uppercase tracking-wider">
                  {lang}
                </div>
              )}
              <pre className="p-4 overflow-x-auto text-xs font-mono bg-foreground/[0.03] text-foreground/80 leading-relaxed custom-scrollbar">
                <code>{code.trimEnd()}</code>
              </pre>
            </div>
          );
        }
        return (
          <p key={i} className="text-sm leading-[1.75] whitespace-pre-wrap text-foreground/80">
            {part}
          </p>
        );
      })}
    </div>
  );
}

function MessageBubble({ msg, onDelete }: { msg: Message; onDelete: (id: number) => void }) {
  const t = msg.taskType as TaskType;
  const meta = TASK_TYPES.find((tt) => tt.type === t);
  const [expanded, setExpanded] = useState(true);

  return (
    <div className={cn(
      "group rounded-2xl border border-border/40 bg-background/60 overflow-hidden transition-all duration-200",
      "ring-1", TASK_RING[t] ?? "ring-border/20"
    )}>
      {/* Query header */}
      <div className="flex items-start justify-between gap-3 px-4 py-3 border-b border-border/30">
        <div className="flex items-start gap-2.5 min-w-0">
          <span className={cn("shrink-0 mt-0.5 opacity-70", TASK_COLORS[t])}>{meta?.icon}</span>
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground/90 leading-snug">{msg.query}</p>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className={cn("text-[10px] font-bold uppercase tracking-widest", TASK_COLORS[t])}>{msg.taskType}</span>
              {msg.botName && <span className="text-[10px] text-muted-foreground/70">· {msg.botName}</span>}
              <span className="text-[10px] text-muted-foreground/60">
                {new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity mt-0.5">
          <button
            onClick={() => setExpanded((v) => !v)}
            className="p-1.5 rounded-lg text-muted-foreground/60 hover:text-muted-foreground transition-colors"
          >
            {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={() => onDelete(msg.id)}
            className="p-1.5 rounded-lg text-muted-foreground/60 hover:text-destructive transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Response body */}
      {expanded && (
        <div className="px-4 py-3 space-y-3 animate-in fade-in duration-150">
          {msg.taskType === "image" && msg.imageUrl ? (
            <div className="rounded-xl overflow-hidden border border-border/30">
              <img src={msg.imageUrl} alt={msg.query} className="w-full h-auto max-h-96 object-contain" />
            </div>
          ) : (
            <MarkdownResult text={msg.result} />
          )}

          {msg.sources?.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1 border-t border-border/20">
              {msg.sources.map((s, i) => (
                <span key={i} className="text-[10px] px-2.5 py-1 rounded-full bg-foreground/[0.04] border border-border/30 text-muted-foreground/70 font-medium">
                  {s}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function Home() {
  const [query, setQuery] = useState("");
  const [taskType, setTaskType] = useState<TaskType>("search");
  const [url, setUrl] = useState("");
  const [showUrl, setShowUrl] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [profile, setProfile] = useState<UserProfile>(() =>
    loadFromStorage("lunar-ascent-profile", DEFAULT_PROFILE)
  );
  const [bots, setBots] = useState<BotConfig[]>(() =>
    loadFromStorage("lunar-ascent-bots", [])
  );

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const queryClient = useQueryClient();

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages, scrollToBottom]);

  useEffect(() => {
    if (!query && textareaRef.current) {
      textareaRef.current.style.height = "44px";
    }
  }, [query]);

  const handleProfileChange = (p: UserProfile) => {
    setProfile(p);
    saveToStorage("lunar-ascent-profile", p);
  };

  const handleBotsChange = (b: BotConfig[]) => {
    setBots(b);
    saveToStorage("lunar-ascent-bots", b);
  };

  const activeBotForTask = bots.find((b) => b.tasks.includes(taskType) && b.apiKey.trim());

  const { mutate: submitQuery, isPending } = useAiQuery({
    mutation: {
      onSuccess: (data) => {
        const msg: Message = {
          id: data.id,
          query: data.query,
          taskType: data.taskType,
          result: data.result,
          imageUrl: data.imageUrl,
          sources: data.sources,
          createdAt: data.createdAt,
          botName: activeBotForTask?.name,
        };
        setMessages((prev) => [...prev, msg]);
        setQuery("");
        queryClient.invalidateQueries({ queryKey: getGetHistoryQueryKey() });
      },
      onError: () => toast.error("Failed to generate response. Please try again."),
    },
  });

  const { data: history = [], isLoading: isLoadingHistory } = useGetHistory({ limit: 30 });
  const { data: stats } = useGetStats();
  const { mutate: clearHistory } = useClearHistory({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetHistoryQueryKey() });
        setMessages([]);
      },
    },
  });
  const { mutate: deleteItem } = useDeleteHistoryItem({
    mutation: { onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetHistoryQueryKey() }) },
  });

  const handleSubmit = () => {
    if (!query.trim() || isPending) return;
    const bot = activeBotForTask;
    submitQuery({
      data: {
        query,
        taskType,
        url: showUrl && url ? url : undefined,
        ...(bot && {
          botApiKey: bot.apiKey,
          botProvider: bot.provider,
          botModel: bot.model || undefined,
          botName: bot.name,
        }),
      },
    });
  };

  const deleteMessage = (id: number) => {
    setMessages((prev) => prev.filter((m) => m.id !== id));
    deleteItem({ id });
  };

  const toggleTheme = () => {
    setIsDarkMode((d) => !d);
    document.documentElement.classList.toggle("dark");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="h-dvh flex flex-col bg-background text-foreground overflow-hidden font-sans">

      {/* ── Header ── */}
      <header className="neu-panel rounded-none border-b border-border/50 px-4 py-2.5 flex items-center justify-between shrink-0 z-30">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl neu-button flex items-center justify-center shrink-0">
            <Cpu className="w-3.5 h-3.5 text-primary" />
          </div>
          <div>
            <h1 className="text-sm font-semibold tracking-tight leading-none text-foreground">Lunar Ascent</h1>
            <p className="text-[10px] text-muted-foreground/70 mt-0.5 leading-none select-none">
              Author: Labibuddin Pranto
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {stats && stats.totalQueries > 0 && (
            <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 neu-panel-inset rounded-full text-[11px] text-muted-foreground">
              <span><strong className="text-foreground font-semibold">{stats.totalQueries}</strong> queries</span>
            </div>
          )}
          <button
            onClick={() => setShowHistory((v) => !v)}
            className={cn(
              "w-8 h-8 rounded-xl flex items-center justify-center transition-all",
              showHistory ? "neu-button-active text-primary" : "neu-button text-muted-foreground"
            )}
            title="History"
          >
            <Clock className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={toggleTheme}
            className="w-8 h-8 rounded-xl neu-button flex items-center justify-center text-muted-foreground"
            title="Toggle theme"
          >
            {isDarkMode ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={() => setShowSettings(true)}
            className="w-8 h-8 rounded-full neu-button flex items-center justify-center text-white font-semibold text-xs overflow-hidden"
            style={{ backgroundColor: profile.avatarColor }}
            title="Settings"
          >
            {profile.avatarInitials || <User className="w-3.5 h-3.5" />}
          </button>
        </div>
      </header>

      {/* ── Body ── */}
      <div className="flex flex-1 min-h-0 relative">

        {/* History sidebar / drawer */}
        {showHistory && (
          <>
            <div
              className="absolute inset-0 z-10 md:hidden"
              onClick={() => setShowHistory(false)}
            />
            <aside className={cn(
              "absolute md:relative inset-y-0 left-0 z-20 flex flex-col shrink-0",
              "border-r border-border/50 bg-background w-60",
              "animate-in slide-in-from-left duration-200"
            )}>
              <div className="px-3 py-2.5 border-b border-border/40 flex items-center justify-between">
                <h2 className="text-xs font-semibold flex items-center gap-1.5 text-foreground/80">
                  <History className="w-3.5 h-3.5 text-primary/70" /> History
                </h2>
                <div className="flex items-center gap-0.5">
                  {history.length > 0 && (
                    <button
                      onClick={() => clearHistory()}
                      className="p-1.5 text-muted-foreground/60 hover:text-destructive transition-colors rounded-lg"
                      title="Clear all"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                  <button onClick={() => setShowHistory(false)} className="p-1.5 text-muted-foreground/60 hover:text-foreground transition-colors rounded-lg">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1.5">
                {isLoadingHistory ? (
                  <div className="flex justify-center py-8"><Loader2 className="w-4 h-4 animate-spin text-muted-foreground/40" /></div>
                ) : history.length === 0 ? (
                  <div className="text-center py-10 text-muted-foreground/50 text-xs">No history yet</div>
                ) : history.map((item) => {
                  const t = item.taskType as TaskType;
                  const meta = TASK_TYPES.find((tt) => tt.type === t);
                  return (
                    <div
                      key={item.id}
                      onClick={() => {
                        const exists = messages.find((m) => m.id === item.id);
                        if (!exists) {
                          setMessages((prev) => [...prev, {
                            id: item.id, query: item.query, taskType: item.taskType,
                            result: item.result, imageUrl: item.imageUrl,
                            sources: item.sources, createdAt: item.createdAt,
                          }]);
                        }
                        setShowHistory(false);
                      }}
                      className="p-2.5 rounded-xl group relative cursor-pointer hover:bg-foreground/[0.03] transition-colors border border-transparent hover:border-border/40"
                    >
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className={cn("shrink-0 opacity-70", TASK_COLORS[t])}>{meta?.icon}</span>
                        <span className={cn("text-[10px] font-bold uppercase tracking-wider", TASK_COLORS[t])}>{item.taskType}</span>
                      </div>
                      <p className="text-xs line-clamp-2 text-foreground/70 leading-relaxed">{item.query}</p>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteItem({ id: item.id });
                          setMessages((prev) => prev.filter((m) => m.id !== item.id));
                        }}
                        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 p-1 rounded text-muted-foreground/50 hover:text-destructive transition-all"
                      >
                        <X className="w-2.5 h-2.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </aside>
          </>
        )}

        {/* Main chat area */}
        <main className="flex-1 flex flex-col min-w-0 min-h-0">

          {/* Task selector strip */}
          <div className="shrink-0 px-3 pt-2.5 pb-2 border-b border-border/40">
            <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
              {TASK_TYPES.map(({ type, icon, label, color }) => (
                <button
                  key={type}
                  onClick={() => setTaskType(type)}
                  className={cn(
                    "flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap shrink-0 transition-all",
                    taskType === type ? "neu-button-active" : "neu-button text-muted-foreground/70"
                  )}
                >
                  <span className={taskType === type ? color : "opacity-60"}>{icon}</span>
                  <span className={taskType === type ? color : ""}>{label}</span>
                  {activeBotForTask && type === taskType && (
                    <span className="ml-0.5 w-1.5 h-1.5 rounded-full bg-emerald-400/80 shrink-0" />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Messages feed */}
          <div className="flex-1 overflow-y-auto custom-scrollbar px-3 py-4 space-y-3">
            {messages.length === 0 && !isPending && (
              <div className="flex flex-col items-center justify-center h-full text-center select-none space-y-5 py-16">
                <div className="w-14 h-14 rounded-2xl neu-panel flex items-center justify-center">
                  <Cpu className="w-6 h-6 text-primary/70" />
                </div>
                <div className="space-y-1.5">
                  <p className="text-sm font-semibold text-foreground/60">How can I help?</p>
                  <p className="text-xs text-muted-foreground/50 max-w-[200px] leading-relaxed">
                    Pick a task above and type your prompt below
                  </p>
                </div>
                <div className="flex flex-wrap justify-center gap-2">
                  {TASK_TYPES.map(({ type, icon, label, color }) => (
                    <button
                      key={type}
                      onClick={() => setTaskType(type)}
                      className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-xl neu-button text-xs font-medium", color)}
                    >
                      {icon} {label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg) => (
              <MessageBubble key={msg.id} msg={msg} onDelete={deleteMessage} />
            ))}

            {isPending && (
              <div className="rounded-2xl border border-border/40 overflow-hidden">
                <div className="px-4 py-3 border-b border-border/30 flex items-center gap-2">
                  <Loader2 className={cn("w-3.5 h-3.5 animate-spin shrink-0", TASK_COLORS[taskType])} />
                  <span className="text-xs text-muted-foreground/70">
                    {activeBotForTask ? `${activeBotForTask.name} is thinking…` : "Thinking…"}
                  </span>
                </div>
                <div className="px-4 py-3 space-y-2.5">
                  <div className="h-2 bg-foreground/[0.06] rounded-full w-4/5 animate-pulse" />
                  <div className="h-2 bg-foreground/[0.06] rounded-full w-3/5 animate-pulse" />
                  <div className="h-2 bg-foreground/[0.06] rounded-full w-11/12 animate-pulse" />
                  <div className="h-2 bg-foreground/[0.06] rounded-full w-1/2 animate-pulse" />
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* ── Input bar ── */}
          <div className="shrink-0 px-3 pb-3 pt-1.5">
            <div className="neu-panel rounded-2xl p-3 space-y-2">

              {/* URL input */}
              {showUrl && (
                <div className="flex items-center gap-2 animate-in slide-in-from-bottom-2 duration-200">
                  <LinkIcon className="w-3.5 h-3.5 text-muted-foreground/50 shrink-0" />
                  <input
                    type="url"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://example.com/article"
                    className="flex-1 neu-input py-2 text-xs"
                  />
                  <button
                    onClick={() => { setShowUrl(false); setUrl(""); }}
                    className="p-1 rounded-lg text-muted-foreground/50 hover:text-foreground transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* Textarea + buttons */}
              <div className="flex items-end gap-2">
                <textarea
                  ref={textareaRef}
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    const el = e.target;
                    el.style.height = "44px";
                    el.style.height = Math.min(el.scrollHeight, 200) + "px";
                  }}
                  onKeyDown={handleKeyDown}
                  placeholder={`Ask anything for ${taskType}…`}
                  className="flex-1 neu-input auto-textarea text-sm text-foreground placeholder:text-muted-foreground/40"
                />
                <div className="flex items-center gap-1.5 shrink-0 pb-0.5">
                  <button
                    onClick={() => setShowUrl((v) => !v)}
                    className={cn(
                      "w-9 h-9 rounded-xl flex items-center justify-center transition-all",
                      showUrl ? "neu-button-active text-primary" : "neu-button text-muted-foreground/60"
                    )}
                    title="Add URL context"
                  >
                    <LinkIcon className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={isPending || !query.trim()}
                    className={cn(
                      "w-9 h-9 rounded-xl flex items-center justify-center transition-all",
                      isPending || !query.trim()
                        ? "neu-button opacity-35 cursor-not-allowed text-muted-foreground"
                        : cn("neu-button", TASK_COLORS[taskType])
                    )}
                    title="Send (Ctrl+Enter)"
                  >
                    {isPending
                      ? <Loader2 className="w-4 h-4 animate-spin" />
                      : <Send className="w-4 h-4" />
                    }
                  </button>
                </div>
              </div>

              {/* Footer hint */}
              <div className="flex items-center justify-between px-0.5">
                <span className="text-[10px] text-muted-foreground/40">
                  Ctrl+Enter to send
                </span>
                {activeBotForTask && (
                  <span className="flex items-center gap-1.5 text-[10px] text-emerald-500/80 font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400/70 inline-block" />
                    {activeBotForTask.name}
                  </span>
                )}
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* Settings modal */}
      <SettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        profile={profile}
        onProfileChange={handleProfileChange}
        bots={bots}
        onBotsChange={handleBotsChange}
      />
    </div>
  );
}
