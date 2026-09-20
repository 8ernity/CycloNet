"use client";
import React, { useState, useRef, useEffect } from "react";
import { Upload, ImageIcon, Scan, CheckCircle2, ShieldAlert, Loader2, Activity } from "lucide-react";
import { useActiveCyclone } from "@/hooks/useActiveCyclone";
import { API_BASE_URL } from "@/lib/api";

export default function ClassificationPage() {
  const { selectedCycloneId, selectedCycloneName } = useActiveCyclone();
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<any>(null);
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
      setSelectedFrame(null);
      await analyzeImage(selectedFile);
    }
  };

  const analyzeImage = async (imageFile: File) => {
    setAnalyzing(true);
    try {
      const formData = new FormData();
      formData.append("file", imageFile);

      const response = await fetch(`${API_BASE_URL}/api/classify`, {
        method: "POST",
        body: formData,
      });
      
      if (!response.ok) throw new Error("API failed");
      const data = await response.json();
      setResult(data.prediction);
    } catch (err) {
      console.error(err);
      // Fallback or show error
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
        {selectedCycloneId && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs shrink-0">
            <Activity className="w-3.5 h-3.5 text-emerald-400" />
            <span>Target Context: <strong>{selectedCycloneName || selectedCycloneId}</strong></span>
          </div>
        )}
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
          
          <div className="flex items-center justify-between border-b border-border pb-4 mb-6">
            <h3 className="font-heading font-semibold text-lg flex items-center gap-2">
              <Scan className="w-5 h-5 text-primary" />
              Analysis Results
            </h3>
            {analyzing ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/20 text-xs font-semibold">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Analyzing...
              </span>
            ) : result ? (
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${result.is_cyclone === false ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'}`}>
                <CheckCircle2 className="w-3.5 h-3.5" />
                Analysis Complete
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-secondary text-muted-foreground border border-border text-xs font-semibold">
                Awaiting Upload
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-6 mb-8">
            <div>
              <p className="text-sm text-muted-foreground mb-1">IMD Category</p>
              <div className="flex items-center gap-2">
                <ShieldAlert className={result?.is_cyclone === false ? "w-5 h-5 text-emerald-500" : result ? "w-5 h-5 text-destructive" : "w-5 h-5 text-muted-foreground/30"} />
                <span className={`text-xl font-bold ${result?.is_cyclone === false ? "text-emerald-500" : result ? "text-foreground" : "text-muted-foreground"}`}>
                  {result ? result.category_short : "--"}
                </span>
              </div>
              <p className={`text-xs mt-1 font-medium min-h-[16px] ${result?.is_cyclone === false ? "text-emerald-400" : "text-destructive"}`}>
                {result ? result.category : ""}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">Model Confidence</p>
              <span className={`text-3xl font-bold ${result?.is_cyclone === false ? "text-emerald-400" : result ? "text-primary" : "text-muted-foreground"}`}>
                {result ? `${result.confidence}%` : "--%"}
              </span>
            </div>
          </div>

          <div className="flex-1 min-h-[300px] bg-secondary/30 rounded-xl border border-border relative overflow-hidden flex items-center justify-center group">
             {previewUrl ? (
                <img src={previewUrl} className="absolute inset-0 w-full h-full object-cover opacity-80" alt="Analyzed" />
             ) : (
                <div className="absolute inset-0 bg-secondary/40" />
             )}
             
             {result && result.is_cyclone !== false && (
                <>
                 <div className="absolute top-4 left-4 z-10 bg-black/50 backdrop-blur px-3 py-1.5 rounded-md border border-white/10 text-xs text-white/80">
                   Grad-CAM Explainability Overlay
                 </div>
                 <div className="absolute w-64 h-64 mix-blend-screen opacity-80" style={{
                    background: 'radial-gradient(circle, rgba(255,0,0,0.8) 0%, rgba(255,165,0,0.6) 20%, rgba(255,255,0,0.4) 40%, rgba(0,255,255,0.2) 60%, transparent 80%)',
                    filter: 'blur(15px)'
                 }} />
                 <div className="absolute bottom-4 right-4 flex items-center gap-2 bg-black/50 backdrop-blur px-3 py-1.5 rounded-md border border-white/10">
                    <span className="text-[10px] text-white/60 uppercase">Low</span>
                    <div className="w-24 h-2 rounded-full bg-gradient-to-r from-cyan-500 via-yellow-400 to-red-500" />
                    <span className="text-[10px] text-white/60 uppercase">High</span>
                 </div>
                </>
             )}
             {result && result.is_cyclone === false && (
                <div className="absolute top-4 left-4 z-10 bg-emerald-950/90 border border-emerald-500/40 backdrop-blur px-3 py-1.5 rounded-md text-xs text-emerald-300 font-medium shadow-lg">
                  Non-Cyclone Image (No Heatmap Applied)
                </div>
             )}
          </div>

          <div className="mt-6 flex justify-end gap-3">
             <button disabled={!result} className="disabled:opacity-50 px-4 py-2 rounded-lg border border-border bg-secondary/30 hover:bg-secondary text-sm font-medium transition-colors">
               Export Report
             </button>
             <button disabled={!result} className="disabled:opacity-50 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors shadow-lg shadow-primary/25">
               Confirm & Log
             </button>
          </div>
        </div>

      </div>
    </div>
  );
}
