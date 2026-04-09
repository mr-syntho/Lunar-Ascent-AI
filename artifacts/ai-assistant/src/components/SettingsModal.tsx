import React, { useState, useRef } from "react";
import {
  X, Plus, Trash2, Eye, EyeOff, Bot, User,
  ChevronDown, Check, Camera, Save
} from "lucide-react";
import { cn } from "@/lib/utils";

export type TaskType = "search" | "code" | "summarize" | "image";

export interface BotConfig {
  id: string;
  name: string;
  apiKey: string;
  provider: "openai" | "deepseek";
  model: string;
  tasks: TaskType[];
}

export interface UserProfile {
  username: string;
  avatarColor: string;
  avatarInitials: string;
}

const PROVIDER_OPTIONS = [
  { value: "openai" as const, label: "OpenAI", defaultModel: "gpt-4o" },
  { value: "deepseek" as const, label: "DeepSeek", defaultModel: "deepseek-chat" },
];

const TASK_OPTIONS: { type: TaskType; label: string }[] = [
  { type: "search", label: "Search" },
  { type: "code", label: "Code" },
  { type: "summarize", label: "Summarize" },
  { type: "image", label: "Image" },
];

const AVATAR_COLORS = [
  "#6366f1", "#8b5cf6", "#ec4899", "#f43f5e",
  "#f97316", "#eab308", "#22c55e", "#06b6d4", "#3b82f6",
];

function newBot(): BotConfig {
  return {
    id: crypto.randomUUID(),
    name: "My Bot",
    apiKey: "",
    provider: "openai",
    model: "gpt-4o",
    tasks: ["search"],
  };
}

interface BotEditorProps {
  bot: BotConfig;
  onChange: (bot: BotConfig) => void;
  onDelete: () => void;
}

function BotEditor({ bot, onChange, onDelete }: BotEditorProps) {
  const [showKey, setShowKey] = useState(false);
  const [open, setOpen] = useState(true);

  const toggleTask = (task: TaskType) => {
    const already = bot.tasks.includes(task);
    onChange({
      ...bot,
      tasks: already ? bot.tasks.filter((t) => t !== task) : [...bot.tasks, task],
    });
  };

  const setProvider = (provider: "openai" | "deepseek") => {
    const pm = PROVIDER_OPTIONS.find((p) => p.value === provider);
    onChange({ ...bot, provider, model: pm?.defaultModel ?? bot.model });
  };

  return (
    <div className="neu-panel rounded-2xl overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-4 py-3 text-left"
        onClick={() => setOpen((v) => !v)}
      >
        <div className="flex items-center gap-2 min-w-0">
          <Bot className="w-4 h-4 text-primary shrink-0" />
          <span className="text-sm font-semibold truncate">{bot.name || "Unnamed Bot"}</span>
          {bot.tasks.length > 0 && (
            <span className="hidden sm:flex items-center gap-1 ml-1">
              {bot.tasks.map((t) => (
                <span key={t} className="text-[10px] px-1.5 py-0.5 rounded-full neu-panel-inset text-muted-foreground">
                  {t}
                </span>
              ))}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive transition-colors"
            title="Delete bot"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform duration-200", open && "rotate-180")} />
        </div>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-4 border-t border-border/40">
          <div className="pt-4">
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Bot Name</label>
            <input
              className="w-full neu-input text-sm"
              value={bot.name}
              onChange={(e) => onChange({ ...bot, name: e.target.value })}
              placeholder="e.g. My Search Bot"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Provider</label>
            <div className="flex gap-2">
              {PROVIDER_OPTIONS.map((p) => (
                <button
                  key={p.value}
                  onClick={() => setProvider(p.value)}
                  className={cn(
                    "flex-1 py-2 rounded-xl text-xs font-semibold transition-all",
                    bot.provider === p.value ? "neu-button-active text-primary" : "neu-button text-muted-foreground"
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">API Token</label>
            <div className="flex gap-2">
              <input
                className="flex-1 neu-input text-sm font-mono text-xs"
                type={showKey ? "text" : "password"}
                value={bot.apiKey}
                onChange={(e) => onChange({ ...bot, apiKey: e.target.value })}
                placeholder={bot.provider === "openai" ? "sk-..." : "sk-..."}
                autoComplete="off"
              />
              <button
                onClick={() => setShowKey((v) => !v)}
                className="w-10 h-10 rounded-xl neu-button flex items-center justify-center text-muted-foreground shrink-0"
              >
                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Model</label>
            <input
              className="w-full neu-input text-sm"
              value={bot.model}
              onChange={(e) => onChange({ ...bot, model: e.target.value })}
              placeholder={bot.provider === "openai" ? "gpt-4o" : "deepseek-chat"}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Tasks This Bot Handles</label>
            <div className="flex flex-wrap gap-2">
              {TASK_OPTIONS.map(({ type, label }) => (
                <button
                  key={type}
                  onClick={() => toggleTask(type)}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all",
                    bot.tasks.includes(type)
                      ? "neu-button-active text-primary"
                      : "neu-button text-muted-foreground"
                  )}
                >
                  {bot.tasks.includes(type) && <Check className="w-3 h-3" />}
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: UserProfile;
  onProfileChange: (p: UserProfile) => void;
  bots: BotConfig[];
  onBotsChange: (b: BotConfig[]) => void;
}

export default function SettingsModal({
  isOpen, onClose, profile, onProfileChange, bots, onBotsChange
}: SettingsModalProps) {
  const [tab, setTab] = useState<"profile" | "bots">("profile");
  const [localUsername, setLocalUsername] = useState(profile.username);
  const [localColor, setLocalColor] = useState(profile.avatarColor);
  const fileRef = useRef<HTMLInputElement>(null);

  const saveProfile = () => {
    const initials = localUsername.trim().split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2) || "U";
    onProfileChange({ username: localUsername.trim() || "User", avatarColor: localColor, avatarInitials: initials });
  };

  const addBot = () => onBotsChange([...bots, newBot()]);
  const updateBot = (id: string, bot: BotConfig) => onBotsChange(bots.map((b) => (b.id === id ? bot : b)));
  const deleteBot = (id: string) => onBotsChange(bots.filter((b) => b.id !== id));

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className={cn(
        "relative ml-auto h-full w-full max-w-sm flex flex-col neu-panel rounded-none rounded-l-3xl",
        "animate-in slide-in-from-right duration-300"
      )}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-border/50">
          <h2 className="text-base font-bold">Settings</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-xl neu-button flex items-center justify-center text-muted-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex gap-1 px-4 pt-4">
          {(["profile", "bots"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                "flex-1 py-2 rounded-xl text-xs font-semibold capitalize transition-all",
                tab === t ? "neu-button-active text-primary" : "neu-button text-muted-foreground"
              )}
            >
              {t === "profile" ? "Profile" : "AI Bots"}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-5">
          {tab === "profile" && (
            <>
              <div className="flex flex-col items-center gap-4 py-4">
                <div className="relative">
                  <div
                    className="w-20 h-20 rounded-full flex items-center justify-center text-white text-2xl font-bold shadow-neumorphic cursor-pointer"
                    style={{ backgroundColor: localColor }}
                    onClick={() => fileRef.current?.click()}
                  >
                    {profile.avatarInitials || <User className="w-8 h-8" />}
                  </div>
                  <button
                    onClick={() => fileRef.current?.click()}
                    className="absolute bottom-0 right-0 w-7 h-7 rounded-full neu-button flex items-center justify-center text-muted-foreground"
                  >
                    <Camera className="w-3.5 h-3.5" />
                  </button>
                  <input ref={fileRef} type="file" accept="image/*" className="hidden" />
                </div>
                <p className="text-xs text-muted-foreground">Tap to change avatar</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Username</label>
                <input
                  className="w-full neu-input text-sm"
                  value={localUsername}
                  onChange={(e) => setLocalUsername(e.target.value)}
                  placeholder="Your name"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Avatar Color</label>
                <div className="flex flex-wrap gap-3">
                  {AVATAR_COLORS.map((c) => (
                    <button
                      key={c}
                      onClick={() => setLocalColor(c)}
                      className={cn(
                        "w-8 h-8 rounded-full transition-transform hover:scale-110",
                        localColor === c && "ring-2 ring-offset-2 ring-offset-background ring-primary scale-110"
                      )}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>

              <button
                onClick={saveProfile}
                className="w-full neu-button flex items-center justify-center gap-2 py-3 text-sm font-semibold text-primary"
              >
                <Save className="w-4 h-4" />
                Save Profile
              </button>
            </>
          )}

          {tab === "bots" && (
            <>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Configure AI bots with your own API keys. Each bot can be assigned to one or more task types. Multiple bots can handle the same task — the first matching bot is used.
              </p>

              <div className="space-y-3">
                {bots.map((bot) => (
                  <BotEditor
                    key={bot.id}
                    bot={bot}
                    onChange={(updated) => updateBot(bot.id, updated)}
                    onDelete={() => deleteBot(bot.id)}
                  />
                ))}
              </div>

              {bots.length === 0 && (
                <div className="text-center py-8 text-muted-foreground text-xs neu-panel-inset rounded-2xl">
                  No bots configured yet. Add one to use your own API keys.
                </div>
              )}

              <button
                onClick={addBot}
                className="w-full neu-button flex items-center justify-center gap-2 py-3 text-sm font-semibold text-primary border-dashed border-2 border-primary/30"
              >
                <Plus className="w-4 h-4" />
                Add Bot
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
