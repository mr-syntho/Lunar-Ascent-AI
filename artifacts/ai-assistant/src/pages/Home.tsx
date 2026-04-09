import React, { useState } from "react";
import { Link } from "wouter";
import { Search, Code2, AlignLeft, ImageIcon, History, X, Trash2, Sun, Moon, Link as LinkIcon, RefreshCw, Send, Loader2 } from "lucide-react";
import { useAiQuery, useGetHistory, getGetHistoryQueryKey, useClearHistory, useDeleteHistoryItem, useGetStats } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AiQueryRequestTaskType } from "@workspace/api-zod/src/generated/types";
import { cn } from "@/lib/utils";

export default function Home() {
  const [query, setQuery] = useState("");
  const [taskType, setTaskType] = useState<AiQueryRequestTaskType>("search");
  const [url, setUrl] = useState("");
  const [showUrl, setShowUrl] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);

  const queryClient = useQueryClient();

  const { mutate: submitQuery, isPending } = useAiQuery({
    mutation: {
      onSuccess: (data) => {
        queryClient.invalidateQueries({ queryKey: getGetHistoryQueryKey() });
      },
      onError: (error) => {
        toast.error(error.error || "Failed to generate response");
      }
    }
  });

  const { data: history = [], isLoading: isLoadingHistory } = useGetHistory({ limit: 20 });
  const { data: stats } = useGetStats();
  const { mutate: clearHistory } = useClearHistory({
    mutation: {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetHistoryQueryKey() })
    }
  });

  const { mutate: deleteHistoryItem } = useDeleteHistoryItem({
    mutation: {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetHistoryQueryKey() })
    }
  });

  const handleSubmit = () => {
    if (!query.trim()) return;
    submitQuery({ data: { query, taskType, url: showUrl ? url : undefined } });
  };

  const toggleTheme = () => {
    setIsDarkMode(!isDarkMode);
    if (!isDarkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  };

  // Get the most recent item from history to display if not currently loading a new one
  const currentResult = history.length > 0 ? history[0] : null;

  return (
    <div className="min-h-screen w-full flex bg-background text-foreground transition-colors duration-500 overflow-hidden font-sans">
      
      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden relative z-10">
        
        {/* Header */}
        <header className="px-8 py-6 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full neu-panel flex items-center justify-center text-primary">
              <Code2 className="w-5 h-5" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-foreground/80">Command Center</h1>
          </div>
          
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setShowHistory(!showHistory)}
              className={cn("w-12 h-12 flex items-center justify-center", showHistory ? "neu-button-active" : "neu-button")}
              title="History"
            >
              <History className="w-5 h-5" />
            </button>
            <button 
              onClick={toggleTheme}
              className="w-12 h-12 neu-button flex items-center justify-center"
              title="Toggle Theme"
            >
              {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
          </div>
        </header>

        {/* Scrollable Workspace */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar">
          <div className="max-w-4xl mx-auto space-y-8 pb-20">
            
            {/* Input Section */}
            <div className="neu-panel p-6 md:p-8 space-y-6">
              
              {/* Task Type Selector */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <TaskButton 
                  icon={<Search className="w-5 h-5" />} 
                  label="Search" 
                  active={taskType === "search"} 
                  onClick={() => setTaskType("search")} 
                />
                <TaskButton 
                  icon={<Code2 className="w-5 h-5" />} 
                  label="Code" 
                  active={taskType === "code"} 
                  onClick={() => setTaskType("code")} 
                />
                <TaskButton 
                  icon={<AlignLeft className="w-5 h-5" />} 
                  label="Summarize" 
                  active={taskType === "summarize"} 
                  onClick={() => setTaskType("summarize")} 
                />
                <TaskButton 
                  icon={<ImageIcon className="w-5 h-5" />} 
                  label="Image" 
                  active={taskType === "image"} 
                  onClick={() => setTaskType("image")} 
                />
              </div>

              {/* Main Input */}
              <div className="relative">
                <textarea 
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Enter your command..."
                  className="w-full h-32 neu-input resize-none text-lg text-foreground placeholder:text-muted-foreground"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                      e.preventDefault();
                      handleSubmit();
                    }
                  }}
                />
                
                <div className="absolute bottom-4 right-4 flex items-center gap-3">
                  <button
                    onClick={() => setShowUrl(!showUrl)}
                    className={cn("p-2 rounded-lg transition-colors", showUrl ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground")}
                    title="Add URL Context"
                  >
                    <LinkIcon className="w-5 h-5" />
                  </button>
                  <button 
                    onClick={handleSubmit}
                    disabled={isPending || !query.trim()}
                    className="neu-button px-6 py-2 flex items-center gap-2 font-semibold text-primary disabled:opacity-50"
                  >
                    {isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                    <span>Generate</span>
                  </button>
                </div>
              </div>

              {/* URL Input */}
              {showUrl && (
                <div className="animate-in fade-in slide-in-from-top-4 duration-300">
                  <div className="flex items-center gap-3">
                    <LinkIcon className="w-5 h-5 text-muted-foreground" />
                    <input 
                      type="url" 
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      placeholder="https://example.com"
                      className="flex-1 neu-input py-2 text-sm"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Results Area */}
            {(isPending || currentResult) && (
              <div className="neu-panel-inset p-6 md:p-8 min-h-[300px] relative">
                {isPending ? (
                  <div className="flex flex-col items-center justify-center h-full text-muted-foreground space-y-4 py-12">
                    <div className="w-16 h-16 rounded-full neu-panel flex items-center justify-center animate-pulse">
                      <Loader2 className="w-8 h-8 animate-spin text-primary" />
                    </div>
                    <p className="font-medium animate-pulse">Processing request...</p>
                  </div>
                ) : currentResult ? (
                  <div className="space-y-6 animate-in fade-in duration-500">
                    <div className="flex justify-between items-start border-b border-border/50 pb-4">
                      <div>
                        <div className="text-sm font-medium text-primary uppercase tracking-wider mb-1">
                          {currentResult.taskType}
                        </div>
                        <h3 className="text-lg font-semibold">{currentResult.query}</h3>
                      </div>
                    </div>
                    
                    <div className="prose prose-sm md:prose-base dark:prose-invert max-w-none prose-pre:bg-black/5 dark:prose-pre:bg-white/5 prose-pre:border prose-pre:border-border prose-pre:shadow-neumorphic-inset">
                      {currentResult.taskType === 'image' && currentResult.imageUrl ? (
                        <div className="rounded-xl overflow-hidden shadow-neumorphic border border-border my-6 bg-muted/30">
                          <img src={currentResult.imageUrl} alt={currentResult.query} className="w-full h-auto object-cover" />
                        </div>
                      ) : null}
                      
                      <div className="whitespace-pre-wrap font-sans text-foreground/90 leading-relaxed">
                        {currentResult.result}
                      </div>
                    </div>
                    
                    {currentResult.sources && currentResult.sources.length > 0 && (
                      <div className="pt-6 mt-6 border-t border-border/50">
                        <h4 className="text-sm font-semibold text-muted-foreground mb-3">Sources</h4>
                        <div className="flex flex-wrap gap-2">
                          {currentResult.sources.map((source, i) => (
                            <span key={i} className="text-xs px-3 py-1.5 rounded-full neu-panel-inset text-muted-foreground">
                              {source}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
            )}

            {/* Stats Snippet */}
            {stats && (
              <div className="flex justify-center gap-8 text-sm text-muted-foreground pt-4">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-primary"></span>
                  Total Queries: <strong className="text-foreground">{stats.totalQueries}</strong>
                </div>
              </div>
            )}
            
          </div>
        </div>
      </main>

      {/* History Sidebar */}
      <aside 
        className={cn(
          "w-80 h-screen neu-panel rounded-none border-l border-border transition-all duration-300 flex flex-col z-20 relative",
          showHistory ? "translate-x-0" : "translate-x-full absolute right-0"
        )}
      >
        <div className="p-6 border-b border-border flex justify-between items-center bg-background/50 backdrop-blur-sm">
          <h2 className="font-semibold flex items-center gap-2">
            <History className="w-4 h-4" /> History
          </h2>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => clearHistory()}
              className="p-2 text-muted-foreground hover:text-destructive transition-colors rounded-lg"
              title="Clear History"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <button 
              onClick={() => setShowHistory(false)}
              className="p-2 text-muted-foreground hover:text-foreground transition-colors rounded-lg md:hidden"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
          {isLoadingHistory ? (
            <div className="flex justify-center p-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
          ) : history.length === 0 ? (
            <div className="text-center p-8 text-muted-foreground text-sm">No history yet</div>
          ) : (
            history.map((item) => (
              <div key={item.id} className="neu-panel-inset p-4 group relative">
                <div className="text-xs font-semibold text-primary mb-1 uppercase tracking-wider">{item.taskType}</div>
                <div className="text-sm font-medium line-clamp-2 mb-2">{item.query}</div>
                <div className="text-xs text-muted-foreground line-clamp-2">{item.result}</div>
                
                <button 
                  onClick={() => deleteHistoryItem({ id: item.id })}
                  className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity bg-background/80 p-1 rounded backdrop-blur-sm"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))
          )}
        </div>
      </aside>

    </div>
  );
}

function TaskButton({ icon, label, active, onClick }: { icon: React.ReactNode, label: string, active: boolean, onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex flex-col items-center justify-center py-4 px-2 gap-3 transition-all",
        active ? "neu-button-active" : "neu-button"
      )}
    >
      <div className={cn("transition-colors", active ? "text-primary" : "text-muted-foreground")}>
        {icon}
      </div>
      <span className="text-sm font-semibold">{label}</span>
    </button>
  );
}