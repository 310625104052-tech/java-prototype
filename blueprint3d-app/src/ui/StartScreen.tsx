import { useRef, useState } from 'react';
import {
  ArrowUpRight,
  Building2,
  Download,
  Home,
  Loader2,
  Pause,
  Play,
  Sparkles,
  TriangleAlert,
} from 'lucide-react';
import { StudioMark } from './StudioMark';
import { PlanIllustration } from './PlanIllustration';
import { WallDetectionResult } from '../types/blueprint';
import { FloorPlanData } from '../types/floorplan';
import { convertDetectionToFloorPlan } from '../utils/detectionToFloorPlan';
import { ImportReview } from './ImportReview';
import { generateSampleBlueprintFile } from '../utils/sampleBlueprintGenerator';
import { sampleCollegeFloorPlan } from '../data/sampleCollegeFloorPlan';
import { sampleFloorPlan } from '../data/sampleFloorPlan';

// Backend base URL. Empty in dev (Vite proxies /api); set VITE_API_URL in production.
const API_BASE = (import.meta.env.VITE_API_URL ?? '').replace(/\/+$/, '');
// Keep in sync with MAX_UPLOAD_BYTES in backend/main.py
const MAX_UPLOAD_MB = 15;
const ACCEPTED_EXTENSIONS = /\.(png|jpe?g|dxf)$/i;

interface StartScreenProps {
  onPlanReady: (plan: FloorPlanData, fileName: string) => void;
}

export function StartScreen({ onPlanReady }: StartScreenProps) {
  const [motionPaused, setMotionPaused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [busyFile, setBusyFile] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [review, setReview] = useState<WallDetectionResult | null>(null);

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
      const response = await fetch(`${API_BASE}/api/blueprint/detect`, {
        method: 'POST',
        body: formData,
      });

      if (!(response.headers.get('content-type') || '').includes('application/json')) {
        throw new Error('The server sent an unexpected response. Is the backend running?');
      }
      const data = (await response.json()) as WallDetectionResult & {
        success: boolean;
        error?: string;
      };
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Could not read walls from that image.');
      }
      if (data.mode === 'reference' || data.import_info?.reviewRequired) setReview(data);
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

  const runSampleThroughPipeline = async () => {
    if (busyFile !== null) return;
    const file = await generateSampleBlueprintFile();
    await processFile(file);
  };

  const isBusy = busyFile !== null;

  if (review) {
    return (
      <ImportReview
        result={review}
        onReady={(plan) => onPlanReady(plan, review.filename)}
        onBack={() => setReview(null)}
      />
    );
  }

  return (
    <div className={`studio-home${motionPaused ? ' is-motion-paused' : ''}`} data-ui>
      <main className="studio-sheet">
        <header className="studio-sheet-header">
          <StudioMark />
          <div className="studio-header-meta">
            <span className="studio-header-note">From drawing to perspective.</span>
          </div>
          <button
            type="button"
            className="studio-motion"
            aria-pressed={motionPaused}
            onClick={() => setMotionPaused((value) => !value)}
          >
            {motionPaused ? <Play aria-hidden="true" /> : <Pause aria-hidden="true" />}
            <span>{motionPaused ? 'Resume motion' : 'Pause motion'}</span>
          </button>
        </header>

        <div className="studio-home-content">
          <div className="studio-intro">
            <div className="studio-kicker">
<span>Floor plan studio</span>
            </div>

            <h1 aria-label="Make room for possibility.">
              <span className="studio-title-line" aria-hidden="true">
                <span>Make room</span>
              </span>
              <span className="studio-title-line" aria-hidden="true">
                <span>
                  for <span className="studio-title-word">possibility.</span>
                </span>
              </span>
            </h1>

            <p className="studio-lead">
              Turn a floor plan into a space you can explore. Start with your drawing,
              then review the details and step inside.
            </p>

            <div
              className={`studio-upload${isDragging ? ' is-dragging' : ''}${isBusy ? ' is-busy' : ''}`}
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
            >
              <span className="studio-corner-tick tl" aria-hidden="true" />
              <span className="studio-corner-tick br" aria-hidden="true" />

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
                <div className="studio-upload-busy" role="status" aria-live="polite">
                  <Loader2 className="studio-spinner" aria-hidden="true" />
                  <div>
                    <strong>Reading your drawing…</strong>
                    <span title={busyFile || undefined}>
                      Tracing wall geometry &amp; openings · {busyFile}
                    </span>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  id="upload-dropzone-btn"
                  className="studio-upload-button"
                  onClick={() => inputRef.current?.click()}
                >
                  <span>
                    <strong>{isDragging ? 'Drop your drawing here' : 'Choose a drawing'}</strong>
                    <span>or drag and drop it here</span>
                  </span>
                  <span className="studio-upload-icon-box" aria-hidden="true">
                    <ArrowUpRight />
                  </span>
                </button>
              )}

              <div className="studio-upload-formats">
                <span>PNG · JPG · DXF</span>
                <span>Up to {MAX_UPLOAD_MB} MB</span>
              </div>
            </div>

            {error && (
              <div role="alert" className="studio-error">
                <TriangleAlert aria-hidden="true" />
                <span>{error}</span>
              </div>
            )}

            {/* Instant Interactive Studio Specimens */}
            <div className="studio-specimens" aria-label="Sample floor plans">
              <div className="studio-specimens-header">
                <span className="studio-specimens-title">Or explore a sample</span>
              </div>
              <div className="studio-specimens-grid">
                <button
                  type="button"
                  className="studio-specimen-card"
                  disabled={isBusy}
                  onClick={() =>
                    onPlanReady(sampleCollegeFloorPlan, 'college_engineering_level2_blueprint.png')
                  }
                >
                  <span className="studio-specimen-icon">
                    <Building2 size={15} aria-hidden="true" />
                  </span>
                  <span className="studio-specimen-body">
                    <strong>Science &amp; technology</strong>
                    <span className="studio-specimen-meta">{sampleCollegeFloorPlan.rooms.length} rooms · {Math.round((sampleCollegeFloorPlan.bounds.maxX - sampleCollegeFloorPlan.bounds.minX) * (sampleCollegeFloorPlan.bounds.maxY - sampleCollegeFloorPlan.bounds.minY))} m²</span>
                  </span>
                  <ArrowUpRight className="studio-specimen-arrow" size={14} aria-hidden="true" />
                </button>

                <button
                  type="button"
                  className="studio-specimen-card"
                  disabled={isBusy}
                  onClick={() => onPlanReady(sampleFloorPlan, 'modern_suburban_residence.png')}
                >
                  <span className="studio-specimen-icon">
                    <Home size={15} aria-hidden="true" />
                  </span>
                  <span className="studio-specimen-body">
                    <strong>Suburban residence</strong>
                    <span className="studio-specimen-meta">{sampleFloorPlan.rooms.length} rooms · {Math.round((sampleFloorPlan.bounds.maxX - sampleFloorPlan.bounds.minX) * (sampleFloorPlan.bounds.maxY - sampleFloorPlan.bounds.minY))} m²</span>
                  </span>
                  <ArrowUpRight className="studio-specimen-arrow" size={14} aria-hidden="true" />
                </button>
              </div>

              <div className="studio-sample-actions">
                <button
                  type="button"
                  id="download-sample-btn"
                  className="studio-sample"
                  onClick={downloadSample}
                >
                  <Download aria-hidden="true" />
                  <span>Download sample PNG</span>
                </button>

                <span className="studio-sample-divider" aria-hidden="true">·</span>

                <button
                  type="button"
                  className="studio-sample"
                  disabled={isBusy}
                  onClick={runSampleThroughPipeline}
                >
                  <Sparkles aria-hidden="true" />
                  <span>Scan sample drawing</span>
                </button>
              </div>
            </div>
          </div>

          <PlanIllustration motionPaused={motionPaused} />
        </div>

        <footer className="studio-sheet-footer">
          <span>YOUR DRAWING. A NEW DIMENSION.</span>
          <div className="studio-footer-steps" aria-hidden="true">
            <span>Import</span>
            <span>→</span>
            <span>Review</span>
            <span>→</span>
            <span>Explore</span>
          </div>
        </footer>
      </main>
    </div>
  );
}
