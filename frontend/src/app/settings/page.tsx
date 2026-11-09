"use client";
import { useMounted } from "@/hooks/useBrowserState";
import { useState } from "react";
import { Moon, Sun, Bell, Database, Check, RefreshCw, Radio, Globe, Shield, Info } from "lucide-react";
import { useTheme } from "next-themes";
import { NeonThemeToggle } from "@/components/NeonThemeToggle";
import { useDataSource, type DataSourceType } from "@/hooks/useDataSource";
import { normalizeBackendUrl } from "@/lib/backendUrl";

const options = [
  {id:"IMD", title:"IMD categories", subtitle:"Regional category display", icon:Database,
   description:"Use IMD category thresholds to display the reported wind value."},
  {id:"JTWC", title:"JTWC categories", subtitle:"Alternative category display", icon:Radio,
   description:"Compare category thresholds without changing the reported wind or its averaging period."},
  {id:"CUSTOM", title:"Custom backend", subtitle:"Local or research service", icon:Globe,
   description:"Use a compatible CycloNet API. Save a valid endpoint before switching."},
] as const;
const panel = "min-w-0 rounded-2xl border border-border bg-card/85 p-5 sm:p-6";

export default function SettingsPage() {
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useMounted();
  const { dataSource, customApiUrl, setDataSource, setCustomApiUrl } = useDataSource();
  const [customOpen, setCustomOpen] = useState(false);
  const [draft, setDraft] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [notifying, setNotifying] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const customValue = draft ?? customApiUrl;

  const selectSource = (source: DataSourceType) => {
    setMessage(null); setError(null);
    if (source === "CUSTOM") {setCustomOpen(true);return;}
    setDataSource(source); setCustomOpen(false);
    setMessage(`${source} category display saved in this browser. Reported wind is unchanged.`);
  };
  const saveEndpoint = () => {
    setError(null); setMessage(null);
    try {
      const url = normalizeBackendUrl(customValue);
      setCustomApiUrl(url); setDataSource("CUSTOM"); setDraft(url);
      setMessage("Backend address saved in this browser. API compatibility and availability are not yet verified.");
    } catch (e) {setError(e instanceof Error ? e.message : "Could not save this preference.");}
  };
  const testEndpoint = async () => {
    setError(null); setMessage(null); setTesting(true);
    try {
      const url = normalizeBackendUrl(customValue);
      const response = await fetch(`${url}/health`, {credentials:"omit", redirect:"error", signal:AbortSignal.timeout(8000)});
      if (!response.ok) throw new Error(`Endpoint returned HTTP ${response.status}.`);
      setMessage("Health endpoint responded. This does not verify weather data or full API compatibility.");
    } catch (e) {setError(e instanceof Error && e.name !== "TimeoutError" ? e.message : "Endpoint check timed out. Check the URL and try again.");}
    finally {setTesting(false);}
  };
  const testNotification = async () => {
    setMessage(null); setError(null); setNotifying(true);
    try {
      if (!("Notification" in window)) throw new Error("Browser notifications are not supported here.");
      const permission = Notification.permission === "default" ? await Notification.requestPermission() : Notification.permission;
      if (permission !== "granted") throw new Error("Notification permission is blocked. You can change it in your browser settings.");
      new Notification("CycloNet — test notification", {body:"Local display test only. No weather warning or live alert subscription.",icon:"/icon.svg"});
      setMessage("Test notification requested. This does not enable live alert delivery.");
    } catch (e) {setError(e instanceof Error ? e.message : "Notification test unavailable.");}
    finally {setNotifying(false);}
  };
  if (!mounted) return <div className="p-6 text-muted-foreground" role="status">Loading settings…</div>;
  const dark = resolvedTheme === "dark";
  const permission = typeof Notification === "undefined" ? "Not supported" : Notification.permission;

  return (
    <div className="mx-auto flex w-full min-w-0 max-w-6xl flex-col gap-5 pb-8" data-testid="settings-page">
      <div className="flex flex-col gap-3 border-b border-border pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-primary mb-2">Workspace preferences</p>
          <h2 className="text-2xl font-heading font-bold text-foreground">Settings</h2>
          <p className="mt-1 text-sm text-muted-foreground">Personalize your view and configure the API used by this browser.</p>
        </div>
        <span className="inline-flex w-fit shrink-0 items-center gap-1.5 rounded-full border border-border bg-secondary/40 px-3 py-1.5 text-xs text-muted-foreground"><Check className="h-3.5 w-3.5" /> Preferences save locally</span>
      </div>

      {(message || error) && <div role={error ? "alert" : "status"} className={`rounded-xl border px-4 py-3 text-sm break-words ${error ? "border-red-500/30 bg-red-500/10 text-red-500" : "border-primary/30 bg-primary/10 text-foreground"}`}>{error || message}</div>}

      <div className="grid min-w-0 gap-5 lg:grid-cols-2">
        <section className={panel} aria-labelledby="appearance-heading">
          <h3 id="appearance-heading" className="flex items-center gap-2 text-base font-semibold"><Moon className="h-4 w-4 text-primary" /> Appearance</h3>
          <p className="mt-1 text-xs text-muted-foreground">Choose the theme for this browser.</p>
          <div className="my-5 flex items-center justify-between gap-4 rounded-xl bg-secondary/30 p-4">
            <div><p className="text-sm font-semibold">{dark ? "Dark theme" : "Light theme"}</p><p className="mt-1 text-xs text-muted-foreground">{dark ? "Low-light interface with neon accents" : "Bright interface with high-contrast text"}</p></div>
            <NeonThemeToggle size="md" className="shrink-0" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[{id:"light",label:"Light",icon:Sun},{id:"dark",label:"Dark",icon:Moon}].map(({id,label,icon:Icon})=><button key={id} onClick={()=>setTheme(id)} aria-pressed={resolvedTheme===id} className={`flex items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium focus-visible:outline-2 focus-visible:outline-primary ${resolvedTheme===id ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-secondary"}`}><Icon className="h-4 w-4" />{label}</button>)}
          </div>
        </section>

        <section className={panel} aria-labelledby="notifications-heading">
          <div className="flex flex-wrap items-center justify-between gap-2"><h3 id="notifications-heading" className="flex items-center gap-2 text-base font-semibold"><Bell className="h-4 w-4 text-amber-500" /> Notifications</h3><span className="rounded-full bg-secondary px-2.5 py-1 text-[11px] text-muted-foreground">Local test only</span></div>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">No push subscription or live alert delivery is connected. Browser permission alone does not subscribe you to weather warnings.</p>
          <div className="my-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border px-3 py-2.5 text-xs"><span className="text-muted-foreground">Browser permission</span><span className="capitalize font-medium">{permission}</span></div>
          <button onClick={testNotification} disabled={notifying || permission==="Not supported"} className="rounded-lg border border-border bg-secondary/40 px-3 py-2.5 text-sm font-medium hover:bg-secondary disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-primary">{notifying ? "Requesting permission…" : "Send test notification"}</button>
          <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">Siren delivery and emergency dispatch are not connected.</p>
        </section>
      </div>

      <section className={panel} aria-labelledby="source-heading">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div><h3 id="source-heading" className="flex items-center gap-2 text-base font-semibold"><Database className="h-4 w-4 text-primary" /> Data display and backend</h3><p className="mt-1 text-xs text-muted-foreground">A display preference does not change which agency observed a storm.</p></div>
          <span className="w-fit shrink-0 rounded-full bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary">{dataSource === "CUSTOM" ? "Custom backend selected" : `${dataSource} category display`}</span>
        </div>
        <div className="mt-5 grid min-w-0 gap-3 md:grid-cols-3">
          {options.map(({id,title,subtitle,description,icon:Icon})=><button key={id} aria-pressed={dataSource===id} onClick={()=>selectSource(id)} className={`flex min-w-0 flex-col rounded-xl border p-4 text-left transition-colors focus-visible:outline-2 focus-visible:outline-primary ${dataSource===id ? "border-primary bg-primary/10" : "border-border bg-secondary/20 hover:bg-secondary/50"}`}>
            <span className="mb-3 flex w-full items-center justify-between"><Icon className="h-5 w-5 text-primary" />{dataSource===id && <Check className="h-4 w-4 text-primary" />}</span>
            <span className="block text-sm font-semibold">{title}</span><span className="mt-1 block text-[11px] font-medium text-primary">{subtitle}</span><span className="mt-2 block text-xs leading-relaxed text-muted-foreground">{description}</span>
          </button>)}
        </div>
        {(customOpen || dataSource==="CUSTOM") && <div className="mt-4 rounded-xl border border-border bg-secondary/20 p-4">
          <label htmlFor="backend-url" className="block text-sm font-semibold">Backend URL</label>
          <p className="mb-3 mt-1 text-xs text-muted-foreground">Use a trusted CycloNet-compatible API. Authentication tokens are not sent to untrusted origins.</p>
          <div className="flex min-w-0 flex-col gap-2 sm:flex-row">
            <input id="backend-url" type="url" value={customValue} onChange={e=>{setDraft(e.target.value);setError(null);}} placeholder="https://your-backend.example" className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2.5 text-sm focus:outline-2 focus:outline-primary" />
            <button onClick={testEndpoint} disabled={testing} className="flex shrink-0 items-center justify-center gap-2 rounded-lg border border-border px-3 py-2.5 text-xs font-semibold disabled:opacity-50">{testing && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}{testing ? "Checking…" : "Test endpoint"}</button>
            <button onClick={saveEndpoint} className="shrink-0 rounded-lg bg-primary px-3 py-2.5 text-xs font-semibold text-primary-foreground">Save endpoint</button>
          </div>
        </div>}
        <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-border bg-secondary/25 p-4"><Shield className="mt-0.5 h-4 w-4 shrink-0 text-primary" /><div><p className="text-xs font-semibold">No automatic wind conversion</p><p className="mt-1 text-xs leading-relaxed text-muted-foreground">Reported wind values and source averaging periods are preserved. Changing category display does not create an IMD or JTWC observation.</p></div></div>
      </section>

      <div className="flex items-start gap-2.5 px-1 text-xs leading-relaxed text-muted-foreground"><Info className="mt-0.5 h-4 w-4 shrink-0" /><p>Live observations refresh from the backend. Use <strong className="font-medium text-foreground">Refresh live data</strong> on the dashboard to reload them. Starting a new ingestion job requires a backend-verified administrator role; signing in alone does not grant it.</p></div>
    </div>
  );
}
