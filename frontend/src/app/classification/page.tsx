"use client";
import Image from "next/image";
import { type Classification, type VisionAnalysis } from "@/types/api";
import React, { useState, useRef, useEffect } from "react";
import { Upload, ImageIcon, Scan, CheckCircle2, ShieldAlert, Loader2, Activity, Sparkles, Cpu, X } from "lucide-react";
import { useActiveCyclone } from "@/hooks/useActiveCyclone";
import { useDataSource } from "@/hooks/useDataSource";
import { getApiBaseUrl } from "@/lib/api";

const unavailableClassification = (): Classification => ({
  is_cyclone: null, category: "Classification unavailable", category_short: "UNAVAILABLE",
  confidence: null, dvorak_t: null, wind_speed_knots: null,
  checkpoint_status: "BACKEND_UNAVAILABLE", is_trained_weights: false,
  scientifically_validated: false, is_reliable: false, operational_status: "UNAVAILABLE", probabilities: {}
});
const unavailableVision: VisionAnalysis = {
  status: "ANALYSIS_UNAVAILABLE", scientifically_validated: false,
  category: "Not independently validated", dvorak_t_number: null, estimated_knots: null,
  eye_characterization: "Not verified", convective_signature: "Not verified", recommended_actions: []
};

export default function ClassificationPage() {
  const { selectedCycloneId, selectedCycloneName } = useActiveCyclone();
  const { getSourceBadge } = useDataSource();
  const sourceBadge = getSourceBadge();
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [geminiLoading, setGeminiLoading] = useState(false);
  const [result, setResult] = useState<Classification | null>(null);
  const [geminiResult, setGeminiResult] = useState<VisionAnalysis | null>(null);
  const [selectedFrame, setSelectedFrame] = useState<number | null>(null);
  const analysisController = useRef<AbortController | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setPreviewUrl(URL.createObjectURL(selectedFile));
      setResult(null);
      setGeminiResult(null);
      setSelectedFrame(null);
      await analyzeImage(selectedFile);
    }
  };

  async function analyzeImage(imageFile: File) {
    analysisController.current?.abort();
    const controller = new AbortController();
    analysisController.current = controller;
    const timer = setTimeout(() => controller.abort(), 65000);
    setAnalyzing(true);
    setGeminiLoading(false);
    setGeminiResult(unavailableVision);
    try {
      if (imageFile.size > 5 * 1024 * 1024 || !['image/png', 'image/jpeg'].includes(imageFile.type)) {
        throw new Error('Unsupported image');
      }
      const formData = new FormData();
      formData.append('file', imageFile);
      const response = await fetch(`${getApiBaseUrl()}/api/classify`, {
        method: 'POST', body: formData, signal: controller.signal
      });
      if (!response.ok) throw new Error('Classification unavailable');
      const data = await response.json();
      if (!data?.prediction || typeof data.prediction.category !== 'string' ||
          !(data.prediction.confidence === null || (typeof data.prediction.confidence === 'number' &&
            Number.isFinite(data.prediction.confidence) && data.prediction.confidence >= 0 && data.prediction.confidence <= 100))) {
        throw new Error('Invalid classification response');
      }
      if (analysisController.current === controller) setResult(data.prediction);
    } catch {
      if (analysisController.current === controller) setResult(unavailableClassification());
    } finally {
      clearTimeout(timer);
      if (analysisController.current === controller) setAnalyzing(false);
    }
  }

  useEffect(() => () => analysisController.current?.abort(), []);
  useEffect(() => () => { if (previewUrl?.startsWith('blob:')) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

  useEffect(() => {
    const handleGlobalPaste = async (e: ClipboardEvent) => {
      if (e.clipboardData && e.clipboardData.files && e.clipboardData.files.length > 0) {
        const pastedFile = e.clipboardData.files[0];
        if (pastedFile.type.startsWith("image/")) {
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
  }, []);

  const handleDemoFrameSelect = async (i: number) => {
    analysisController.current?.abort();
    const controller = new AbortController();
    analysisController.current = controller;
    setSelectedFrame(i);
    const frameUrl = `/demo_frames/demo_${i}.jpg`;
    setPreviewUrl(frameUrl);
    setResult(null);
    setGeminiResult(unavailableVision);
    setAnalyzing(true);
    try {
      const response = await fetch(frameUrl, {signal: AbortSignal.any([controller.signal, AbortSignal.timeout(10000)])});
      if (!response.ok) throw new Error('Sample unavailable');
      const blob = await response.blob();
      if (analysisController.current !== controller) return;
      const sampleFile = new File([blob], `demo_${i}.jpg`, {type:'image/jpeg'});
      await analyzeImage(sampleFile);
    } catch {
      if (analysisController.current === controller) {
        setResult(unavailableClassification());
        setAnalyzing(false);
      }
    }
  };

  const handleClearFrame = (e: React.MouseEvent) => {
    e.stopPropagation();
    analysisController.current?.abort();
    analysisController.current = null;
    setAnalyzing(false);
    setPreviewUrl(null);
    setSelectedFrame(null);
    setResult(null);
    setGeminiResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-500">
      <div className="glass-card p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-heading font-semibold text-foreground mb-1">Experimental Image Classification</h2>
          <p className="text-sm text-muted-foreground">
            Upload an image or select an illustrative sample. Predictions are experimental and are not verified meteorological measurements.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className={`px-2.5 py-1 rounded-xl text-xs font-semibold border ${sourceBadge.badgeClass}`}>
            Experimental image analysis
          </span>
          {selectedCycloneId && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs shrink-0">
              <Activity className="w-3.5 h-3.5 text-emerald-400" />
              <span suppressHydrationWarning>Target Context: <strong suppressHydrationWarning>{selectedCycloneName || selectedCycloneId}</strong></span>
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
            onClick={() => !analyzing && fileInputRef.current?.click()}
            className={`glass-card p-6 flex-1 min-h-[280px] flex flex-col items-center justify-center border-dashed border-2 transition-all cursor-pointer group relative overflow-hidden ${
              previewUrl ? 'border-primary/50 bg-secondary/20' : 'border-border/60 hover:border-primary/50 bg-secondary/10'
            }`}
          >
            {previewUrl ? (
              <div className="relative w-full h-full flex flex-col items-center justify-center">
                <div className="relative max-h-[220px] w-full flex items-center justify-center rounded-lg overflow-hidden border border-border/80 bg-black/40">
                  <Image width={500} height={500} unoptimized
                    src={previewUrl} 
                    alt="Active Frame" 
                    className="max-h-[200px] w-auto object-contain rounded-md transition-transform group-hover:scale-105 duration-300" 
                  />
                  {analyzing && (
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-xs flex flex-col items-center justify-center gap-2 text-primary">
                      <Loader2 className="w-7 h-7 animate-spin text-primary" />
                      <span className="text-xs font-semibold tracking-wide text-white">Running PyTorch Inference...</span>
                      <div className="w-32 h-1 bg-secondary rounded-full overflow-hidden">
                        <div className="w-full h-full bg-primary animate-pulse" />
                      </div>
                    </div>
                  )}
                </div>

                <div className="mt-4 flex items-center justify-between w-full px-2">
                  <span className="text-xs font-medium text-emerald-400 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    {selectedFrame ? `Sample Frame #${selectedFrame} Loaded` : "Uploaded Frame Active"}
                  </span>
                  <button 
                    onClick={handleClearFrame}
                    className="text-xs text-muted-foreground hover:text-destructive flex items-center gap-1 px-2 py-1 rounded bg-secondary/60 hover:bg-secondary transition-colors"
                  >
                    <X className="w-3 h-3" /> Clear Frame
                  </button>
                </div>
              </div>
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
              Illustrative sample images — acquisition unverified
            </h3>
            <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
              {[1, 2, 3, 4].map((i) => (
                <button
                  type="button"
                  aria-label={`Select illustrative sample frame ${i}`}
                  aria-pressed={selectedFrame === i}
                  key={i} 
                  onClick={() => handleDemoFrameSelect(i)}
                  className={`min-w-[130px] aspect-square rounded-lg border-2 cursor-pointer transition-all relative overflow-hidden group ${selectedFrame === i ? 'border-primary shadow-lg shadow-primary/30 scale-105 ring-2 ring-primary/40' : 'border-border hover:border-primary/50'}`}
                >
                  <Image fill sizes="130px" src={`/demo_frames/demo_${i}.jpg`} alt={`Demo Frame ${i}`} className="absolute inset-0 w-full h-full object-cover group-hover:scale-110 transition-transform duration-300" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                  <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded bg-black/60 text-[9px] text-white/90 font-mono border border-white/10">
                    Sample
                  </div>
                  <div className="absolute bottom-2 left-2 text-[11px] font-semibold text-white">Frame #{i}</div>
                </button>
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
              Experimental image classification
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
                  {result?.operational_status === 'UNAVAILABLE' ? 'Unavailable' : 'Not scientifically validated'}
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
                <span>Experimental visual classifier</span>
                <span className="font-mono text-emerald-400 font-bold">{result?.confidence != null ? `${result.confidence}% model score — uncalibrated` : "Unavailable"}</span>
              </p>
              <p className="text-base font-bold text-foreground truncate">
                {result ? result.category : "Awaiting Frame"}
              </p>
              {result && (
                <div className="pt-1 flex items-center gap-1.5 text-[10px] font-mono">
                  {result.is_offline_preset ? (
                    <span className="text-blue-400 font-semibold flex items-center gap-1">
                      Illustrative example — not an inference
                    </span>
                  ) : result.is_trained_weights === true ? (
                    <span className="text-emerald-400 font-semibold flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Trained PyTorch Weights
                    </span>
                  ) : (
                    <span className="text-amber-400 font-semibold flex items-center gap-1">
                      Model availability not verified
                    </span>
                  )}
                </div>
              )}
            </div>

            <div className="p-3.5 rounded-xl bg-primary/10 border border-primary/30 space-y-1">
              <p className="text-[11px] text-primary font-medium flex items-center justify-between">
                <span className="flex items-center gap-1"><Sparkles className="w-3 h-3" /> Vision analysis disabled</span>
                {geminiLoading ? (
                  <span className="flex items-center gap-1 font-mono text-[10px] text-primary">
                    <Loader2 className="w-2.5 h-2.5 animate-spin" /> Reasoning...
                  </span>
                ) : (
                  <span className="font-mono text-primary font-bold">Unavailable</span>
                )}
              </p>
              <p className="text-base font-bold text-foreground truncate">
                {geminiLoading ? (
                  <span className="text-xs font-normal text-muted-foreground animate-pulse">Checking availability...</span>
                ) : geminiResult ? (
                  geminiResult.category
                ) : (
                  "Not independently validated"
                )}
              </p>
            </div>
          </div>

          {/* Uncalibrated model warning banner (Fix #6) */}
          {result?.is_uncalibrated_demo && (
            <div className="mb-4 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-start gap-2.5">
              <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <strong className="font-semibold block text-amber-200">Demonstration Mode Notice:</strong>
                <span>{result.warning || "Trained model checkpoint not detected; inference is executing with uncalibrated demonstration initializations."}</span>
              </div>
            </div>
          )}

          {/* Domain Notice (#59) */}
          <div className="mb-4 p-2.5 px-3 rounded-lg bg-blue-500/10 border border-blue-500/20 text-xs text-blue-300 flex items-start gap-2 font-mono">
            <Cpu className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
            <div className="text-[11px] leading-relaxed">
              <span className="font-bold text-blue-300 block mb-0.5">Scientific validation required:</span>
              <span>Model scores are not calibrated probabilities or measured wind. Independent imagery, labels and held-out evaluation are required before scientific validation.</span>
            </div>
          </div>

          {/* Grad-CAM & Satellite Image Viewport (Fix #7) */}
          <div className="h-[240px] bg-secondary/30 rounded-xl border border-border relative overflow-hidden flex items-center justify-center group mb-4">
             {previewUrl ? (
                <Image fill unoptimized src={previewUrl} className="absolute inset-0 w-full h-full object-cover opacity-80" alt="Analyzed" />
             ) : (
                <div className="absolute inset-0 bg-secondary/40 flex items-center justify-center text-muted-foreground text-xs font-mono">
                  Satellite viewport awaiting image input
                </div>
             )}
             
             {result && result.is_cyclone !== false && (
                <>
                 {result.gradcam_data_url ? (
                   <>
                     <div className="absolute top-3 left-3 z-10 bg-black/60 backdrop-blur px-2.5 py-1 rounded-md border border-white/10 text-[11px] text-white/90">
                       Grad-CAM ResNet-50 Heatmap
                     </div>
                     <Image fill unoptimized
                       src={result.gradcam_data_url} 
                       alt="Grad-CAM Layer4 Attribution" 
                       className="absolute inset-0 w-full h-full object-cover mix-blend-screen opacity-85 pointer-events-none" 
                     />
                     <div className="absolute bottom-3 right-3 flex items-center gap-2 bg-black/60 backdrop-blur px-2.5 py-1 rounded-md border border-white/10">
                        <span className="text-[10px] text-white/60 uppercase">Low</span>
                        <div className="w-20 h-1.5 rounded-full bg-gradient-to-r from-cyan-500 via-yellow-400 to-red-500" />
                        <span className="text-[10px] text-white/60 uppercase">High</span>
                     </div>
                   </>
                 ) : (
                   <div className="absolute top-3 left-3 z-10 bg-black/70 backdrop-blur px-2.5 py-1 rounded-md border border-white/10 text-[10px] text-amber-300 font-mono">
                     Grad-CAM activation unavailable (Requires live PyTorch ResNet inference)
                   </div>
                 )}
                </>
             )}
          </div>

          {/* Vision analysis disabled Multimodal Diagnostic Breakdown */}
          {geminiResult && (
            <div className="p-4 rounded-xl bg-secondary/30 border border-border space-y-3 mb-4 animate-in fade-in text-xs">
              <h4 className="font-bold text-foreground flex items-center gap-1.5 text-xs">
                <Sparkles className="w-3.5 h-3.5 text-primary" />
                Vision measurements unavailable
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

              <p className="text-muted-foreground">No calibrated image-derived wind, pressure, Dvorak estimate or operational recommendation is available.</p>
            </div>
          )}

          <div className="flex items-center justify-between gap-3 mt-auto">
             <div className="flex justify-end gap-3 ml-auto">
               <button 
                  disabled={!result || analyzing}
                  onClick={() => {
                    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({ result, geminiResult }, null, 2));
                    const a = document.createElement('a');
                    a.href = dataStr;
                    a.download = `cyclonet_classification_${Date.now()}.json`;
                    a.click();
                  }}
                  className="disabled:opacity-50 px-4 py-2 rounded-lg border border-border bg-secondary/30 hover:bg-secondary text-xs font-semibold transition-colors cursor-pointer"
               >
                  Export Analysis
               </button>

             </div>
          </div>
        </div>

      </div>
    </div>
  );
}
