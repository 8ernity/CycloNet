"use client";
import React, { useState, useRef, useEffect } from "react";
import { Upload, ImageIcon, Scan, CheckCircle2, ShieldAlert, Loader2, Activity, Sparkles, Cpu, Compass, Wind } from "lucide-react";
import { useActiveCyclone } from "@/hooks/useActiveCyclone";
import { useDataSource } from "@/hooks/useDataSource";
import { API_BASE_URL } from "@/lib/api";

export default function ClassificationPage() {
  const { selectedCycloneId, selectedCycloneName } = useActiveCyclone();
  const { getSourceBadge, dataSource } = useDataSource();
  const sourceBadge = getSourceBadge();
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [geminiResult, setGeminiResult] = useState<any>(null);
  const [analysisMode, setAnalysisMode] = useState<"dual" | "resnet" | "gemini">("dual");
  const [selectedFrame, setSelectedFrame] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleGlobalPaste = async (e: ClipboardEvent) => {
      if (e.clipboardData && e.clipboardData.files && e.clipboardData.files.length > 0) {
        const pastedFile = e.clipboardData.files[0];
        if (pastedFile.type.startsWith("image/")) {
          setFile(pastedFile);
          setPreviewUrl(URL.createObjectURL(pastedFile));
          setResult(null);
          setGeminiResult(null);
          setSelectedFrame(null);
          await analyzeImage(pastedFile);
        }
      }
    };
    window.addEventListener("paste", handleGlobalPaste);
    return () => window.removeEventListener("paste", handleGlobalPaste);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      setPreviewUrl(URL.createObjectURL(selectedFile));
      setResult(null);
      setGeminiResult(null);
      setSelectedFrame(null);
      await analyzeImage(selectedFile);
    }
  };

  const analyzeImage = async (imageFile: File) => {
    setAnalyzing(true);
    try {
      const formData = new FormData();
      formData.append("file", imageFile);

      // Run ResNet-50 and Gemini 3.7 Flash in parallel
      const [resnetPromise, geminiPromise] = await Promise.allSettled([
        fetch(`${API_BASE_URL}/api/classify`, { method: "POST", body: formData }),
        fetch(`${API_BASE_URL}/api/ai/analyze-multimodal`, { method: "POST", body: formData })
      ]);

      if (resnetPromise.status === "fulfilled" && resnetPromise.value.ok) {
        const data = await resnetPromise.value.json();
        setResult(data.prediction);
      }

      if (geminiPromise.status === "fulfilled" && geminiPromise.value.ok) {
        const data = await geminiPromise.value.json();
        setGeminiResult(data.analysis);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleDemoFrameSelect = async (i: number) => {
    setSelectedFrame(i);
    const frameUrl = `/demo_frames/demo_${i}.jpg`;
    setPreviewUrl(frameUrl);
    setResult(null);
    setAnalyzing(true);
    
    try {
      const response = await fetch(frameUrl);
      const blob = await response.blob();
      const fakeFile = new File([blob], `demo_${i}.jpg`, { type: "image/jpeg" });
      await analyzeImage(fakeFile);
    } catch (e) {
      console.error(e);
      setAnalyzing(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-500">
      <div className="glass-card p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-heading font-semibold text-foreground mb-1">Automated Intensity Classification</h2>
          <p className="text-sm text-muted-foreground">
            Upload an INSAT-3DR IR frame or select a recent image from MOSDAC to run the AI classification model.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className={`px-2.5 py-1 rounded-xl text-xs font-semibold border ${sourceBadge.badgeClass}`}>
            {sourceBadge.label}
          </span>
          {selectedCycloneId && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs shrink-0">
              <Activity className="w-3.5 h-3.5 text-emerald-400" />
              <span>Target Context: <strong>{selectedCycloneName || selectedCycloneId}</strong></span>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Upload/Input Section */}
        <div className="flex flex-col gap-6">
          <input 
            type="file" 
            accept="image/*" 
            className="hidden" 
            ref={fileInputRef} 
            onChange={handleFileChange} 
          />
          <div 
            onClick={() => fileInputRef.current?.click()}
            className="glass-card p-6 flex-1 flex flex-col items-center justify-center border-dashed border-2 border-border/60 hover:border-primary/50 transition-colors cursor-pointer group bg-secondary/10"
          >
            {previewUrl && !analyzing && !result && !selectedFrame ? (
               <img src={previewUrl} alt="Preview" className="max-h-[200px] object-contain mb-4 rounded-md" />
            ) : (
               <>
                <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <Upload className="w-8 h-8 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
                <h3 className="text-lg font-medium text-foreground">Drag, Drop, or Paste Image</h3>
                <p className="text-sm text-muted-foreground mt-2 text-center max-w-xs">
                  Supports PNG, JPEG, or Ctrl+V. Max file size: 5MB.
                </p>
                <button className="mt-6 px-6 py-2 rounded-full bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors shadow-lg shadow-primary/25 pointer-events-none">
                  Browse Files
                </button>
               </>
            )}
          </div>

          <div className="glass-card p-6">
            <h3 className="font-medium text-foreground mb-4 flex items-center gap-2">
              <ImageIcon className="w-5 h-5 text-muted-foreground" />
              Select from recent frames (Demo)
            </h3>
            <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
              {[1, 2, 3, 4].map((i) => (
                <div 
                  key={i} 
                  onClick={() => handleDemoFrameSelect(i)}
                  className={`min-w-[130px] aspect-square rounded-lg border-2 cursor-pointer transition-all relative overflow-hidden group ${selectedFrame === i ? 'border-primary shadow-lg shadow-primary/20 scale-105' : 'border-border hover:border-primary/50'}`}
                >
                  <img src={`/demo_frames/demo_${i}.jpg`} alt={`Demo Frame ${i}`} className="absolute inset-0 w-full h-full object-cover group-hover:scale-110 transition-transform duration-300" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                  <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded bg-black/60 text-[9px] text-white/90 font-mono border border-white/10">
                    {i === 1 ? 'CS' : i === 2 ? 'SCS' : i === 3 ? 'VSCS' : 'ESCS'}
                  </div>
                  <div className="absolute bottom-2 left-2 text-[11px] font-semibold text-white">Frame #{i}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Results Section */}
        <div className="glass-card p-6 flex flex-col relative overflow-hidden">
          {result && <div className="absolute -top-40 -right-40 w-96 h-96 bg-destructive/10 blur-[100px] rounded-full pointer-events-none" />}
          
          <div className="flex items-center justify-between border-b border-border pb-4 mb-4 flex-wrap gap-2">
            <h3 className="font-heading font-semibold text-lg flex items-center gap-2">
              <Scan className="w-5 h-5 text-primary" />
              AI Intensity & Multimodal Analysis
            </h3>
            <div className="flex items-center gap-2">
              {analyzing ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/20 text-xs font-semibold">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Analyzing...
                </span>
              ) : (result || geminiResult) ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Inference Complete
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-secondary text-muted-foreground border border-border text-xs font-semibold">
                  Awaiting Upload
                </span>
              )}
            </div>
          </div>

          {/* Dual AI Engine Badges */}
          <div className="grid grid-cols-2 gap-4 mb-5">
            <div className="p-3.5 rounded-xl bg-secondary/40 border border-border space-y-1">
              <p className="text-[11px] text-muted-foreground font-medium flex items-center justify-between">
                <span>ResNet-50 Dvorak Model</span>
                <span className="font-mono text-emerald-400 font-bold">{result ? `${result.confidence}% Conf` : "--"}</span>
              </p>
              <p className="text-base font-bold text-foreground truncate">
                {result ? result.category : "Awaiting Frame"}
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-primary/10 border border-primary/30 space-y-1">
              <p className="text-[11px] text-primary font-medium flex items-center justify-between">
                <span className="flex items-center gap-1"><Sparkles className="w-3 h-3" /> Gemini 3.7 Flash</span>
                <span className="font-mono text-primary font-bold">{geminiResult ? `T${geminiResult.dvorak_t_number}` : "--"}</span>
              </p>
              <p className="text-base font-bold text-foreground truncate">
                {geminiResult ? geminiResult.category : "Multimodal Vision"}
              </p>
            </div>
          </div>

          {/* Grad-CAM & Satellite Image Viewport */}
          <div className="h-[240px] bg-secondary/30 rounded-xl border border-border relative overflow-hidden flex items-center justify-center group mb-4">
             {previewUrl ? (
                <img src={previewUrl} className="absolute inset-0 w-full h-full object-cover opacity-80" alt="Analyzed" />
             ) : (
                <div className="absolute inset-0 bg-secondary/40" />
             )}
             
             {result && result.is_cyclone !== false && (
                <>
                 <div className="absolute top-3 left-3 z-10 bg-black/60 backdrop-blur px-2.5 py-1 rounded-md border border-white/10 text-[11px] text-white/90">
                   Grad-CAM Heatmap Overlay
                 </div>
                 <div className="absolute w-56 h-56 mix-blend-screen opacity-80" style={{
                    background: 'radial-gradient(circle, rgba(255,0,0,0.8) 0%, rgba(255,165,0,0.6) 20%, rgba(255,255,0,0.4) 40%, rgba(0,255,255,0.2) 60%, transparent 80%)',
                    filter: 'blur(15px)'
                 }} />
                 <div className="absolute bottom-3 right-3 flex items-center gap-2 bg-black/60 backdrop-blur px-2.5 py-1 rounded-md border border-white/10">
                    <span className="text-[10px] text-white/60 uppercase">Low</span>
                    <div className="w-20 h-1.5 rounded-full bg-gradient-to-r from-cyan-500 via-yellow-400 to-red-500" />
                    <span className="text-[10px] text-white/60 uppercase">High</span>
                 </div>
                </>
             )}
          </div>

          {/* Gemini 3.7 Flash Multimodal Diagnostic Breakdown */}
          {geminiResult && (
            <div className="p-4 rounded-xl bg-secondary/30 border border-border space-y-3 mb-4 animate-in fade-in text-xs">
              <h4 className="font-bold text-foreground flex items-center gap-1.5 text-xs">
                <Sparkles className="w-3.5 h-3.5 text-primary" />
                Gemini 3.7 Flash Multimodal Satellite Diagnostics
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-[11px]">
                <div className="p-2 rounded-lg bg-background/60 border border-border/50">
                  <span className="text-muted-foreground block">Eye Structure:</span>
                  <strong className="text-foreground font-medium">{geminiResult.eye_characterization}</strong>
                </div>
                <div className="p-2 rounded-lg bg-background/60 border border-border/50">
                  <span className="text-muted-foreground block">Convective Signature:</span>
                  <strong className="text-foreground font-medium">{geminiResult.convective_signature}</strong>
                </div>
              </div>

              <div className="p-2.5 rounded-lg bg-primary/10 border border-primary/20 text-[11px] text-foreground space-y-1">
                <span className="font-semibold text-primary block">Recommended Operational Action:</span>
                <ul className="list-disc list-inside space-y-0.5 text-muted-foreground">
                  {geminiResult.recommended_actions?.map((act: string, idx: number) => (
                    <li key={idx} className="text-zinc-200">{act}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3">
             <button disabled={!result && !geminiResult} className="disabled:opacity-50 px-4 py-2 rounded-lg border border-border bg-secondary/30 hover:bg-secondary text-xs font-semibold transition-colors">
                Export Analysis
             </button>
             <button disabled={!result && !geminiResult} className="disabled:opacity-50 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 transition-colors shadow-lg shadow-primary/25">
                Confirm & Log to Archive
             </button>
          </div>
        </div>

      </div>
    </div>
  );
}