import { useRef, useState } from 'react';
import { Box, Download, FileImage, Loader2, TriangleAlert, Upload } from 'lucide-react';
import { WallDetectionResult } from '../types/blueprint';
import { FloorPlanData } from '../types/floorplan';
import { convertDetectionToFloorPlan } from '../utils/detectionToFloorPlan';
import { ImportReview } from './ImportReview';
import { generateSampleBlueprintFile } from '../utils/sampleBlueprintGenerator';

// Keep in sync with MAX_UPLOAD_BYTES in backend/main.py
const MAX_UPLOAD_MB = 15;
const ACCEPTED_EXTENSIONS = /\.(png|jpe?g|dxf)$/i;

interface StartScreenProps {
  onPlanReady: (plan: FloorPlanData, fileName: string) => void;
}

export function StartScreen({ onPlanReady }: StartScreenProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [busyFile, setBusyFile] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [review,setReview] = useState<WallDetectionResult | null>(null);

  const processFile = async (file: File) => {
    setError(null);

    if (!ACCEPTED_EXTENSIONS.test(file.name)) {
      setError('Please upload a PNG, JPG or DXF drawing.');
      return;
    }
    if (file.size > MAX_UPLOAD_MB * 1024 * 1024) {
      setError(`That file is larger than ${MAX_UPLOAD_MB} MB. Please upload a smaller image.`);
      return;
    }

    setBusyFile(file.name);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const response = await fetch('/api/blueprint/detect', { method: 'POST', body: formData });

      if (!(response.headers.get('content-type') || '').includes('application/json')) {
        throw new Error('The server sent an unexpected response. Is the backend running?');
      }
      const data = (await response.json()) as WallDetectionResult & { success: boolean; error?: string };
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Could not read walls from that image.');
      }
      if (data.mode==='reference' || data.import_info?.reviewRequired) setReview(data);
      else onPlanReady(convertDetectionToFloorPlan(data), file.name);
    } catch (err) {
      setError(
        err instanceof TypeError
          ? 'Could not reach the server. Make sure the backend is running (npm run dev starts both).'
          : err instanceof Error
            ? err.message
            : 'Something went wrong while processing the plan.'
      );
    } finally {
      setBusyFile(null);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const downloadSample = async () => {
    const file = await generateSampleBlueprintFile();
    const url = URL.createObjectURL(file);
    const link = document.createElement('a');
    link.href = url;
    link.download = file.name;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const isBusy = busyFile !== null;

  if (review) return <ImportReview result={review} onReady={plan=>onPlanReady(plan,review.filename)} onBack={()=>setReview(null)}/>;

  return (
    <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-slate-950 px-4">
      <div className="absolute top-5 left-6 flex items-center gap-2 text-slate-300">
        <Box className="w-5 h-5 text-sky-400" />
        <span className="text-sm font-semibold tracking-tight">Blueprint3D</span>
      </div>

      <div className="w-full max-w-xl text-center">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
          Turn a 2D floor plan into a 3D model you can walk through
        </h1>
        <p className="mt-2 text-sm text-slate-400">Upload a floor plan image or DXF drawing to get started.</p>

        <div
          onDragOver={(e) => {
            e.preventDefault();
            if (!isBusy) setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragging(false);
            const file = e.dataTransfer.files?.[0];
            if (file && !isBusy) processFile(file);
          }}
          className={`mt-8 rounded-3xl border-2 border-dashed transition-colors ${
            isDragging ? 'border-sky-400 bg-sky-500/10' : 'border-slate-700 bg-slate-900/60 hover:border-slate-500'
          }`}
        >
          <input
            ref={inputRef}
            id="blueprint-file-input"
            type="file"
            accept=".png,.jpg,.jpeg,.dxf,image/png,image/jpeg,application/dxf"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) processFile(file);
            }}
          />

          {isBusy ? (
            <div className="flex flex-col items-center gap-3 px-6 py-14" role="status" aria-live="polite">
              <Loader2 className="w-9 h-9 text-sky-400 animate-spin" />
              <div className="text-sm font-semibold text-white">Importing your drawing...</div>
              <div className="text-xs text-slate-400">Reading drawing geometry from {busyFile}</div>
            </div>
          ) : (
            <button
              type="button"
              id="upload-dropzone-btn"
              onClick={() => inputRef.current?.click()}
              className="flex w-full flex-col items-center gap-3 rounded-3xl px-6 py-14 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
            >
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl border border-sky-400/40 bg-sky-500/15 text-sky-400">
                <Upload className="w-7 h-7" />
              </span>
              <span className="text-base font-semibold text-white">Drop your floor plan here, or click to browse</span>
              <span className="flex items-center gap-1.5 text-xs text-slate-400">
                <FileImage className="w-3.5 h-3.5" />
                PNG, JPG or DXF | up to {MAX_UPLOAD_MB} MB | automatic reconstruction or wall tracing
              </span>
            </button>
          )}
        </div>

        {error && (
          <div
            role="alert"
            className="mt-4 flex items-start gap-2 rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2.5 text-left text-xs text-red-200"
          >
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
            <span>{error}</span>
          </div>
        )}

        <p className="mt-6 text-xs text-slate-500">
          No plan handy?{' '}
          <button
            type="button"
            id="download-sample-btn"
            onClick={downloadSample}
            className="inline-flex items-center gap-1 font-medium text-sky-400 underline-offset-2 hover:underline focus:outline-none focus-visible:underline"
          >
            <Download className="w-3.5 h-3.5" />
            Download a sample floor plan (PNG)
          </button>{' '}
          and upload it above.
        </p>
      </div>
    </div>
  );
}
