import React, { useState } from "react";
import {
  Search, Code2, AlignLeft, ImageIcon, History, X,
  Trash2, Sun, Moon, Link as LinkIcon, Send, Loader2,
  ChevronDown, ChevronUp, BarChart2, Clock, Cpu
} from "lucide-react";
import {
  useAiQuery, useGetHistory, getGetHistoryQueryKey,
  useClearHistory, useDeleteHistoryItem, useGetStats
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type TaskType = "search" | "code" | "summarize" | "image";

const TASK_TYPES: { type: TaskType; icon: React.ReactNode; label: string; description: string }[] = [
  { type: "search",    icon: <Search className="w-4 h-4" />,    label: "Search",     description: "Web & knowledge search" },
  { type: "code",      icon: <Code2 className="w-4 h-4" />,     label: "Code",       description: "Generate & explain code" },
  { type: "summarize", icon: <AlignLeft className="w-4 h-4" />, label: "Summarize",  description: "Condense any content" },
  { type: "image",     icon: <ImageIcon className="w-4 h-4" />, label: "Image",      description: "AI image generation" },
];

const TASK_COLORS: Record<TaskType, string> = {
  search:    "text-blue-500",
  code:      "text-emerald-500",
  summarize: "text-violet-500",
  image:     "text-rose-500",
};

export default function Home() {
  const [query, setQuery] = useState("");
  const [taskType, setTaskType] = useState<TaskType>("search");
  const [url, setUrl] = useState("");
  const [showUrl, setShowUrl] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [activeResult, setActiveResult] = useState<null | (typeof history)[0]>(null);

  const queryClient = useQueryClient();

  const { mutate: submitQuery, isPending, data: latestResult } = useAiQuery({
    mutation: {
      onSuccess: (data) => {
        setActiveResult(data as any);
        queryClient.invalidateQueries({ queryKey: getGetHistoryQueryKey() });
      },
      onError: () => {
        toast.error("Failed to generate response. Please try again.");
      },
    },
  });

  const { data: history = [], isLoading: isLoadingHistory } = useGetHistory({ limit: 30 });
  const { data: stats } = useGetStats();
  const { mutate: clearHistory } = useClearHistory({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetHistoryQueryKey() });
        setActiveResult(null);
      },
    },
  });
  const { mutate: deleteItem } = useDeleteHistoryItem({
    mutation: {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetHistoryQueryKey() }),
    },
  });

  const handleSubmit = () => {
    if (!query.trim() || isPending) return;
    submitQuery({ data: { query, taskType, url: showUrl && url ? url : undefined } });
  };

  const toggleTheme = () => {
    setIsDarkMode((d) => !d);
    document.documentElement.classList.toggle("dark");
  };

  const displayResult = activeResult ?? (history.length > 0 ? history[0] : null);
  const displayResultTaskType = displayResult?.taskType as TaskType | undefined;

  return (
    <div className={cn("min-h-screen flex flex-col bg-background text-foreground transition-colors duration-300 font-sans")}>

      {/* ── Top Navigation Bar ── */}
      <header className="neu-panel rounded-none border-b border-border/60 px-6 py-3 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl neu-button flex items-center justify-center">
            <Cpu className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h1 className="text-base font-bold tracking-tight leading-none">Lunar Ascent</h1>
            <p className="text-xs text-muted-foreground mt-0.5">Licensed to Labibuddin Pranto</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {stats && (
            <div className="hidden sm:flex items-center gap-2 px-4 py-2 neu-panel-inset rounded-full text-xs text-muted-foreground">
              <BarChart2 className="w-3.5 h-3.5 text-primary" />
              <span><strong className="text-foreground">{stats.totalQueries}</strong> total queries</span>
            </div>
          )}
          <button
            onClick={() => setShowHistory((v) => !v)}
            className={cn("w-10 h-10 rounded-xl flex items-center justify-center transition-all", showHistory ? "neu-button-active text-primary" : "neu-button text-muted-foreground")}
            title="Toggle History"
          >
            <Clock className="w-4 h-4" />
          </button>
          <button
            onClick={toggleTheme}
            className="w-10 h-10 rounded-xl neu-button flex items-center justify-center text-muted-foreground"
            title="Toggle Theme"
          >
            {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* ── Body ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── Main Panel ── */}
        <main className="flex-1 overflow-y-auto custom-scrollbar">
          <div className="max-w-3xl mx-auto px-4 md:px-8 py-8 space-y-6">

            {/* Task Type Selector */}
            <section>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3 pl-1">Select Task</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {TASK_TYPES.map(({ type, icon, label, description }) => (
                  <button
                    key={type}
                    onClick={() => setTaskType(type)}
                    className={cn(
                      "flex flex-col items-start gap-1.5 p-4 rounded-2xl text-left transition-all",
                      taskType === type ? "neu-button-active" : "neu-button"
                    )}
                  >
                    <span className={cn("transition-colors", taskType === type ? TASK_COLORS[type] : "text-muted-foreground")}>
                      {icon}
                    </span>
                    <span className={cn("text-sm font-semibold", taskType === type ? "text-foreground" : "text-muted-foreground")}>
                      {label}
                    </span>
                    <span className="text-xs text-muted-foreground/70 leading-tight hidden sm:block">{description}</span>
                  </button>
                ))}
              </div>
            </section>

            {/* Query Input Card */}
            <section className="neu-panel p-5 rounded-2xl space-y-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Your Query</p>

              <textarea
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); handleSubmit(); } }}
                placeholder={`Ask anything for ${taskType}...`}
                rows={4}
                className="w-full neu-input resize-none text-sm leading-relaxed text-foreground placeholder:text-muted-foreground/60"
              />

              {/* URL Input (collapsible) */}
              <div>
                <button
                  onClick={() => setShowUrl((v) => !v)}
                  className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  <LinkIcon className="w-3.5 h-3.5" />
                  <span>{showUrl ? "Remove URL context" : "Add URL for content extraction"}</span>
                  {showUrl ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </button>
                {showUrl && (
                  <div className="mt-3 flex items-center gap-3 animate-in fade-in slide-in-from-top-2 duration-200">
                    <input
                      type="url"
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      placeholder="https://example.com/article"
                      className="flex-1 neu-input py-2 text-xs"
                    />
                  </div>
                )}
              </div>

              {/* Submit */}
              <div className="flex items-center justify-between pt-1">
                <span className="text-xs text-muted-foreground/60">
                  {query.length > 0 ? `${query.length} characters · Ctrl+Enter to submit` : "Ctrl+Enter to submit"}
                </span>
                <button
                  onClick={handleSubmit}
                  disabled={isPending || !query.trim()}
                  className={cn(
                    "neu-button flex items-center gap-2 px-6 py-2.5 font-semibold text-sm transition-all",
                    isPending || !query.trim() ? "opacity-50 cursor-not-allowed" : TASK_COLORS[taskType]
                  )}
                >
                  {isPending
                    ? <><Loader2 className="w-4 h-4 animate-spin" /><span>Generating...</span></>
                    : <><Send className="w-4 h-4" /><span>Generate</span></>
                  }
                </button>
              </div>
            </section>

            {/* Result Card */}
            {(isPending || displayResult) && (
              <section className="space-y-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest pl-1">Result</p>

                <div className="neu-panel-inset rounded-2xl p-5 min-h-[200px]">
                  {isPending ? (
                    <div className="flex flex-col items-center justify-center py-16 space-y-4 text-muted-foreground">
                      <div className="w-14 h-14 rounded-full neu-panel flex items-center justify-center">
                        <Loader2 className="w-7 h-7 animate-spin text-primary" />
                      </div>
                      <p className="text-sm font-medium animate-pulse">Processing your request...</p>
                      <p className="text-xs opacity-60">Routing to best AI services</p>
                    </div>
                  ) : displayResult ? (
                    <div className="space-y-5 animate-in fade-in duration-400">

                      {/* Result Header */}
                      <div className="flex items-start justify-between gap-4 pb-4 border-b border-border/40">
                        <div className="space-y-1 min-w-0">
                          <div className={cn("text-xs font-bold uppercase tracking-widest", displayResultTaskType ? TASK_COLORS[displayResultTaskType] : "text-primary")}>
                            {displayResult.taskType}
                          </div>
                          <p className="text-sm font-semibold text-foreground/80 line-clamp-2">{displayResult.query}</p>
                        </div>
                        <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0 mt-1">
                          {new Date(displayResult.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>

                      {/* Image */}
                      {displayResult.taskType === "image" && displayResult.imageUrl && (
                        <div className="rounded-xl overflow-hidden neu-panel-inset">
                          <img src={displayResult.imageUrl} alt={displayResult.query} className="w-full h-auto" />
                        </div>
                      )}

                      {/* Text content */}
                      <div className="text-sm leading-relaxed text-foreground/85 whitespace-pre-wrap">
                        {displayResult.result}
                      </div>

                      {/* Sources */}
                      {displayResult.sources?.length > 0 && (
                        <div className="pt-4 border-t border-border/40">
                          <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">Sources consulted</p>
                          <div className="flex flex-wrap gap-2">
                            {displayResult.sources.map((source, i) => (
                              <span key={i} className="text-xs px-3 py-1 rounded-full neu-panel-inset text-muted-foreground">
                                {source}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : null}
                </div>
              </section>
            )}

            {/* Stats Row */}
            {stats && stats.totalQueries > 0 && (
              <section>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3 pl-1">Usage Breakdown</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {TASK_TYPES.map(({ type, icon, label }) => (
                    <div key={type} className="neu-panel-inset rounded-xl p-4 flex items-center gap-3">
                      <span className={cn("shrink-0", TASK_COLORS[type])}>{icon}</span>
                      <div className="min-w-0">
                        <p className="text-xs text-muted-foreground truncate">{label}</p>
                        <p className="text-lg font-bold text-foreground">{stats.byTaskType?.[type] ?? 0}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

          </div>
        </main>

        {/* ── History Sidebar ── */}
        <aside
          className={cn(
            "h-full border-l border-border/60 flex flex-col shrink-0 transition-all duration-300 overflow-hidden z-20",
            showHistory ? "w-72" : "w-0"
          )}
        >
          {showHistory && (
            <>
              <div className="p-4 border-b border-border/60 flex items-center justify-between bg-background/70 backdrop-blur-sm">
                <h2 className="text-sm font-semibold flex items-center gap-2">
                  <History className="w-4 h-4 text-primary" /> Query History
                </h2>
                <div className="flex items-center gap-1">
                  {history.length > 0 && (
                    <button
                      onClick={() => clearHistory()}
                      className="p-1.5 text-muted-foreground hover:text-destructive transition-colors rounded-lg"
                      title="Clear All"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button
                    onClick={() => setShowHistory(false)}
                    className="p-1.5 text-muted-foreground hover:text-foreground transition-colors rounded-lg"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-2">
                {isLoadingHistory ? (
                  <div className="flex justify-center py-10">
                    <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                  </div>
                ) : history.length === 0 ? (
                  <div className="text-center py-10 text-muted-foreground text-xs">No history yet</div>
                ) : (
                  history.map((item) => {
                    const t = item.taskType as TaskType;
                    const taskMeta = TASK_TYPES.find((tt) => tt.type === t);
                    return (
                      <div
                        key={item.id}
                        onClick={() => setActiveResult(item as any)}
                        className="neu-panel-inset p-3 rounded-xl group relative cursor-pointer hover:shadow-none transition-all"
                      >
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className={cn("shrink-0", TASK_COLORS[t] ?? "text-primary")}>
                            {taskMeta?.icon}
                          </span>
                          <span className={cn("text-xs font-bold uppercase tracking-wider", TASK_COLORS[t] ?? "text-primary")}>
                            {item.taskType}
                          </span>
                        </div>
                        <p className="text-xs font-medium line-clamp-2 mb-1 text-foreground/80">{item.query}</p>
                        <p className="text-xs text-muted-foreground line-clamp-1 opacity-70">{item.result}</p>

                        <button
                          onClick={(e) => { e.stopPropagation(); deleteItem({ id: item.id }); }}
                          className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 p-1 rounded-md text-muted-foreground hover:text-destructive transition-all"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </>
          )}
        </aside>
      </div>
    </div>
  );
}
