import React, { useRef, useState } from 'react';
import {
  Upload,
  Image as ImageIcon,
  Trash2,
  Maximize2,
  X,
  FileCode,
  Sparkles,
  Home,
  CheckCircle2,
  AlertCircle,
  Scan,
  Loader2,
  Layers,
  Box,
  Sliders,
  Eye,
  Info,
  Building2,
  Check,
  ShieldCheck,
  Compass,
  DoorOpen,
  Maximize,
  GraduationCap,
} from 'lucide-react';
import { UploadedBlueprint, WallDetectionResult, DetectedWall } from '../types/blueprint';
import { FloorPlanData } from '../types/floorplan';
import { generateSampleBlueprintFile } from '../utils/sampleBlueprintGenerator';
import { convertDetectionToFloorPlan } from '../utils/detectionToFloorPlan';

interface BlueprintUploaderProps {
  blueprint: UploadedBlueprint | null;
  onBlueprintUploaded: (blueprint: UploadedBlueprint) => void;
  onClearBlueprint: () => void;
  onLoadSampleHouse: () => void;
  onLoadCollegeFloorPlan?: () => void;
  onLoadGeneratedFloorPlan?: (plan: FloorPlanData) => void;
  onEnterFirstPerson: () => void;
  onViewFloorPlan: () => void;
  onOpenJsonSchema: () => void;
}

export type PipelineLayerKey =
  | 'original'
  | 'preprocessed'
  | 'mask'
  | 'polygons'
  | 'centerlines'
  | 'openings'
  | 'rooms'
  | 'final2d';

export function BlueprintUploader({
  blueprint,
  onBlueprintUploaded,
  onClearBlueprint,
  onLoadSampleHouse,
  onLoadCollegeFloorPlan,
  onLoadGeneratedFloorPlan,
  onEnterFirstPerson,
  onViewFloorPlan,
  onOpenJsonSchema,
}: BlueprintUploaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isGeneratingSample, setIsGeneratingSample] = useState(false);
  const [showFullPreview, setShowFullPreview] = useState(false);

  // Structural Detection State
  const [isDetecting, setIsDetecting] = useState(false);
  const [detectionStatus, setDetectionStatus] = useState<'idle' | 'detecting' | 'success' | 'error'>('idle');
  const [detectionResult, setDetectionResult] = useState<WallDetectionResult | null>(null);
  const [detectionError, setDetectionError] = useState<string | null>(null);

  // 2D Test Mode & Approval State (MANDATORY REQUIREMENT)
  const [is2dApproved, setIs2dApproved] = useState(false);
  const [activeLayer, setActiveLayer] = useState<PipelineLayerKey>('final2d');
  const [showParameters, setShowParameters] = useState(false);
  const [showElementsList, setShowElementsList] = useState(false);
  const [hoveredWallIndex, setHoveredWallIndex] = useState<number | null>(null);
  const [generate3dNotice, setGenerate3dNotice] = useState<string | null>(null);

  // Send uploaded blueprint image to FastAPI backend for Region-Based Structural Detection
  const handleDetectWalls = async () => {
    if (!blueprint || isDetecting) return;

    setIsDetecting(true);
    setDetectionStatus('detecting');
    setDetectionError(null);
    setDetectionResult(null);
    setIs2dApproved(false);
    setGenerate3dNotice(null);

    try {
      let fileToUpload = blueprint.file;

      // If File object is not available in memory, fetch from previewUrl
      if (!fileToUpload && blueprint.previewUrl) {
        const res = await fetch(blueprint.previewUrl);
        const blob = await res.blob();
        fileToUpload = new File([blob], blueprint.fileName, { type: blueprint.mimeType || 'image/png' });
      }

      if (!fileToUpload) {
        throw new Error('No blueprint file data found to send for detection.');
      }

      const formData = new FormData();
      formData.append('file', fileToUpload);

      const response = await fetch('/api/blueprint/detect', {
        method: 'POST',
        body: formData,
      });

      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        const rawText = await response.text();
        const snippet = rawText.slice(0, 120).replace(/\s+/g, ' ');
        throw new Error(
          `Server returned a non-JSON response (${response.status} ${response.statusText || 'OK'}). Expected application/json. Response snippet: "${snippet}"`
        );
      }

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || `OpenCV pipeline failed with status ${response.status}`);
      }

      setDetectionResult(data);
      setDetectionStatus('success');
      setActiveLayer('final2d');
    } catch (err: unknown) {
      setDetectionStatus('error');
      const message = err instanceof Error ? err.message : 'Unable to connect to blueprint processing server.';
      setDetectionError(message);
    } finally {
      setIsDetecting(false);
    }
  };

  const handleClearBlueprint = () => {
    onClearBlueprint();
    setDetectionResult(null);
    setDetectionStatus('idle');
    setDetectionError(null);
    setIs2dApproved(false);
    setActiveLayer('final2d');
    setGenerate3dNotice(null);
  };

  // Drag & drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFile(e.target.files[0]);
    }
  };

  const processFile = (file: File) => {
    setErrorMessage(null);
    setDetectionResult(null);
    setDetectionStatus('idle');
    setDetectionError(null);
    setIs2dApproved(false);
    setGenerate3dNotice(null);

    const validMimeTypes = ['image/png', 'image/jpeg', 'image/jpg'];
    if (!validMimeTypes.includes(file.type)) {
      setErrorMessage('Unsupported file format. Please upload PNG or JPEG blueprint.');
      return;
    }

    const previewUrl = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      const uploaded: UploadedBlueprint = {
        file,
        fileName: file.name,
        previewUrl,
        width: img.width,
        height: img.height,
        fileSize: (file.size / 1024).toFixed(1) + ' KB',
        mimeType: file.type,
      };
      onBlueprintUploaded(uploaded);
    };

    img.onerror = () => {
      URL.revokeObjectURL(previewUrl);
      setErrorMessage('Could not decode the blueprint image file.');
    };

    img.src = previewUrl;
  };

  // Generate & Load High-Precision Academic College Blueprint Sample
  const handleGenerateSampleBlueprint = async () => {
    setIsGeneratingSample(true);
    setErrorMessage(null);
    setIs2dApproved(false);

    try {
      const sampleFile = await generateSampleBlueprintFile();
      processFile(sampleFile);
    } catch (err) {
      console.error('Failed to generate sample blueprint:', err);
      setErrorMessage('Failed to generate sample blueprint.');
    } finally {
      setIsGeneratingSample(false);
    }
  };

  // 2D Structure Approval Action
  const handleApprove2d = () => {
    setIs2dApproved(true);
    setGenerate3dNotice('2D Architectural Geometry Approved! "Generate 3D Building" is now enabled.');
  };

  // Generate 3D Building Extrusion from Approved 2D Model
  const handleGenerate3dBuilding = () => {
    if (!detectionResult || !is2dApproved) return;

    const floorPlan = convertDetectionToFloorPlan(detectionResult);
    if (onLoadGeneratedFloorPlan) {
      onLoadGeneratedFloorPlan(floorPlan);
    }
    setGenerate3dNotice(
      `Navigable 3D Building generated successfully! Extruded ${floorPlan.walls.length} walls, ${floorPlan.doors.length} doors, and ${floorPlan.rooms.length} educational spaces. Click viewport to enter first-person walkthrough.`
    );
  };

  // Resolve active image based on selected pipeline layer
  const getActiveLayerSrc = (layer: PipelineLayerKey): string => {
    if (!blueprint) return '';
    const layers = detectionResult?.debug_layers;

    if (layer === 'original' || !detectionResult) {
      return layers?.original_image || blueprint.previewUrl;
    }
    if (layer === 'preprocessed') {
      return layers?.preprocessed_image || blueprint.previewUrl;
    }
    if (layer === 'mask') {
      return layers?.structural_mask || detectionResult.binary_image || blueprint.previewUrl;
    }
    if (layer === 'polygons') {
      return layers?.wall_polygons_image || detectionResult.raw_hough_image || blueprint.previewUrl;
    }
    if (layer === 'centerlines') {
      return layers?.centerlines_image || blueprint.previewUrl;
    }
    if (layer === 'openings') {
      return layers?.openings_image || blueprint.previewUrl;
    }
    if (layer === 'rooms') {
      return layers?.rooms_image || blueprint.previewUrl;
    }
    // final2d
    return layers?.final_2d_image || detectionResult.debug_image || blueprint.previewUrl;
  };

  const activePreviewSrc = getActiveLayerSrc(activeLayer);

  return (
    <div
      id="blueprint-uploader-panel"
      className="p-4 bg-slate-900/95 backdrop-blur-md rounded-2xl border border-slate-700/70 shadow-2xl flex flex-col gap-4 text-slate-200 w-84 max-h-[calc(100vh-90px)] overflow-y-auto pointer-events-auto"
    >
      {/* Panel Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-sky-500/20 border border-sky-400/30 flex items-center justify-center text-sky-400">
            <GraduationCap className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-slate-100 leading-tight">College Blueprint 3D</h3>
            <span className="text-[10px] text-sky-400 font-medium tracking-wide">
              {detectionResult ? (is2dApproved ? '2D Structure Approved' : '2D Test Mode') : 'Floorplan to 3D Pipeline'}
            </span>
          </div>
        </div>

        {blueprint && (
          <span className="px-2 py-0.5 rounded-md bg-emerald-950/80 border border-emerald-700/60 text-[10px] text-emerald-300 font-mono">
            Loaded
          </span>
        )}
      </div>

      {/* Upload Zone (Shown when no blueprint is active) */}
      {!blueprint ? (
        <div className="flex flex-col gap-3">
          <div
            id="blueprint-drop-zone"
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-2.5 ${
              isDragging
                ? 'border-sky-400 bg-sky-500/10 scale-[1.01]'
                : 'border-slate-700 hover:border-sky-500/60 hover:bg-slate-800/50 bg-slate-950/40'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".png,.jpg,.jpeg,image/png,image/jpeg"
              onChange={handleFileChange}
              className="hidden"
              id="blueprint-file-input"
            />

            <div className="w-11 h-11 rounded-full bg-slate-800/80 border border-slate-700 flex items-center justify-center text-sky-400 shadow-inner">
              <ImageIcon className="w-5 h-5" />
            </div>

            <div className="space-y-1">
              <p className="text-xs font-semibold text-slate-200">
                Upload College Floor Drawing
              </p>
              <p className="text-[11px] text-slate-400 font-medium">PNG or JPEG CAD Drawing / Blueprint</p>
            </div>
          </div>

          {errorMessage && (
            <div
              id="blueprint-error-message"
              className="p-2.5 rounded-lg bg-rose-950/60 border border-rose-700/60 text-rose-300 text-xs flex items-center gap-2"
            >
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Quick Option: Sample College Floor Plan */}
          <div className="flex flex-col gap-2 pt-1 border-t border-slate-800/80">
            <span className="text-[11px] text-slate-400 font-medium">Quick Academic Floor Presets:</span>
            <div className="grid grid-cols-1 gap-1.5">
              <button
                id="sample-blueprint-btn"
                type="button"
                onClick={handleGenerateSampleBlueprint}
                disabled={isGeneratingSample}
                className="w-full py-2 px-3 rounded-lg text-xs font-semibold bg-sky-500/15 hover:bg-sky-500/25 border border-sky-400/30 text-sky-300 transition-all flex items-center justify-center gap-1.5 shadow-sm"
              >
                {isGeneratingSample ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-sky-400" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5 text-sky-400" />
                )}
                <span>Generate Science Wing Blueprint</span>
              </button>

              {onLoadCollegeFloorPlan && (
                <button
                  id="load-college-preset-btn"
                  type="button"
                  onClick={onLoadCollegeFloorPlan}
                  className="w-full py-2 px-3 rounded-lg text-xs font-medium bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/60 text-slate-200 transition-all flex items-center justify-center gap-1.5"
                >
                  <Building2 className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Load 3D Science Complex (Direct)</span>
                </button>
              )}

              <button
                id="load-sample-house-btn"
                type="button"
                onClick={onLoadSampleHouse}
                className="w-full py-1.5 px-3 rounded-lg text-[11px] font-medium text-slate-400 hover:text-slate-200 transition-colors text-center"
              >
                Load Residential House Sample
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* Loaded Blueprint Display */
        <div className="flex flex-col gap-3">
          {/* Metadata Card */}
          <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl space-y-1.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-200 truncate max-w-[190px]" title={blueprint.fileName}>
                {blueprint.fileName}
              </span>
              <span className="text-[10px] text-slate-400 font-mono">{blueprint.fileSize}</span>
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-400">
              <span>Resolution:</span>
              <span className="font-mono text-sky-400 font-semibold">{blueprint.width} × {blueprint.height} px</span>
            </div>
          </div>

          {/* Interactive Pipeline Layer Tabs (Test Mode Stages 1 - 8) */}
          {detectionResult && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                <span>Inspection Layer</span>
                <span className="text-sky-400 font-mono lowercase">{activeLayer}</span>
              </div>
              <div className="grid grid-cols-4 gap-1">
                <button
                  type="button"
                  onClick={() => setActiveLayer('original')}
                  className={`py-1 text-[10px] font-medium rounded transition-all text-center border ${
                    activeLayer === 'original'
                      ? 'bg-sky-500/20 text-sky-300 border-sky-400/50 font-bold'
                      : 'bg-slate-950/60 text-slate-400 border-slate-800 hover:bg-slate-800/60'
                  }`}
                  title="Original Raw Drawing"
                >
                  Original
                </button>

                <button
                  type="button"
                  onClick={() => setActiveLayer('mask')}
                  className={`py-1 text-[10px] font-medium rounded transition-all text-center border ${
                    activeLayer === 'mask'
                      ? 'bg-sky-500/20 text-sky-300 border-sky-400/50 font-bold'
                      : 'bg-slate-950/60 text-slate-400 border-slate-800 hover:bg-slate-800/60'
                  }`}
                  title="Structural Wall Region Mask"
                >
                  Mask
                </button>

                <button
                  type="button"
                  onClick={() => setActiveLayer('polygons')}
                  className={`py-1 text-[10px] font-medium rounded transition-all text-center border ${
                    activeLayer === 'polygons'
                      ? 'bg-sky-500/20 text-sky-300 border-sky-400/50 font-bold'
                      : 'bg-slate-950/60 text-slate-400 border-slate-800 hover:bg-slate-800/60'
                  }`}
                  title="Wall Polygon Contours"
                >
                  Polygons
                </button>

                <button
                  type="button"
                  onClick={() => setActiveLayer('centerlines')}
                  className={`py-1 text-[10px] font-medium rounded transition-all text-center border ${
                    activeLayer === 'centerlines'
                      ? 'bg-sky-500/20 text-sky-300 border-sky-400/50 font-bold'
                      : 'bg-slate-950/60 text-slate-400 border-slate-800 hover:bg-slate-800/60'
                  }`}
                  title="Wall Centerlines & Thickness"
                >
                  Centers
                </button>

                <button
                  type="button"
                  onClick={() => setActiveLayer('openings')}
                  className={`py-1 text-[10px] font-medium rounded transition-all text-center border ${
                    activeLayer === 'openings'
                      ? 'bg-sky-500/20 text-sky-300 border-sky-400/50 font-bold'
                      : 'bg-slate-950/60 text-slate-400 border-slate-800 hover:bg-slate-800/60'
                  }`}
                  title="Doors & Windows"
                >
                  Openings
                </button>

                <button
                  type="button"
                  onClick={() => setActiveLayer('rooms')}
                  className={`py-1 text-[10px] font-medium rounded transition-all text-center border ${
                    activeLayer === 'rooms'
                      ? 'bg-sky-500/20 text-sky-300 border-sky-400/50 font-bold'
                      : 'bg-slate-950/60 text-slate-400 border-slate-800 hover:bg-slate-800/60'
                  }`}
                  title="Enclosed Rooms & Floor Areas"
                >
                  Rooms
                </button>

                <button
                  type="button"
                  onClick={() => setActiveLayer('preprocessed')}
                  className={`py-1 text-[10px] font-medium rounded transition-all text-center border ${
                    activeLayer === 'preprocessed'
                      ? 'bg-sky-500/20 text-sky-300 border-sky-400/50 font-bold'
                      : 'bg-slate-950/60 text-slate-400 border-slate-800 hover:bg-slate-800/60'
                  }`}
                  title="Preprocessed Denoised Image"
                >
                  Preproc
                </button>

                <button
                  type="button"
                  onClick={() => setActiveLayer('final2d')}
                  className={`py-1 text-[10px] font-medium rounded transition-all text-center border ${
                    activeLayer === 'final2d'
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/50 font-bold'
                      : 'bg-slate-950/60 text-slate-400 border-slate-800 hover:bg-slate-800/60'
                  }`}
                  title="Final 2D Architectural Composite"
                >
                  Final 2D
                </button>
              </div>
            </div>
          )}

          {/* Interactive Image Preview with Layer Overlay */}
          <div className="relative group rounded-xl overflow-hidden border border-slate-800 bg-slate-950 aspect-[4/3] flex items-center justify-center">
            {activePreviewSrc ? (
              <img
                src={activePreviewSrc}
                alt="Blueprint Layer Preview"
                className="w-full h-full object-contain cursor-pointer transition-transform duration-200 group-hover:scale-[1.02]"
                onClick={() => setShowFullPreview(true)}
              />
            ) : (
              <div className="flex flex-col items-center justify-center text-slate-600 gap-1 text-xs">
                <ImageIcon className="w-8 h-8 opacity-40" />
                <span>No Preview</span>
              </div>
            )}

            {/* Quick action overlay */}
            <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                type="button"
                onClick={() => setShowFullPreview(true)}
                className="p-1.5 rounded-lg bg-slate-900/80 hover:bg-slate-900 text-slate-300 border border-slate-700 shadow-md backdrop-blur-sm"
                title="Open High-Resolution Layer Inspector"
              >
                <Maximize2 className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Scale Bar badge */}
            {detectionResult?.scale && (
              <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded bg-slate-900/90 border border-slate-700/80 text-[10px] text-sky-300 font-mono shadow-sm">
                1m = {detectionResult.scale.pixelsPerMeter}px
              </div>
            )}
          </div>

          {/* Detection Status / Error */}
          {detectionStatus === 'error' && detectionError && (
            <div className="p-2.5 rounded-lg bg-rose-950/70 border border-rose-700/60 text-rose-300 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span className="leading-snug text-[11px]">{detectionError}</span>
            </div>
          )}

          {/* Structural Detection Metrics Card */}
          {detectionResult && (
            <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800/80 space-y-2 text-xs">
              <div className="flex items-center justify-between pb-1.5 border-b border-slate-800/70">
                <div className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>College Structure Extracted</span>
                </div>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-950 border border-sky-800 text-sky-300 font-mono">
                  {detectionResult.scale?.status || 'calibrated'}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div className="p-1.5 rounded-lg bg-slate-900/90 border border-slate-800 flex justify-between items-center">
                  <span className="text-slate-400">Walls:</span>
                  <span className="font-bold text-emerald-400 font-mono">{detectionResult.wall_count}</span>
                </div>
                <div className="p-1.5 rounded-lg bg-slate-900/90 border border-slate-800 flex justify-between items-center">
                  <span className="text-slate-400">Regions:</span>
                  <span className="font-bold text-sky-400 font-mono">{detectionResult.wall_regions?.length || 0}</span>
                </div>
                <div className="p-1.5 rounded-lg bg-slate-900/90 border border-slate-800 flex justify-between items-center">
                  <span className="text-slate-400">Openings:</span>
                  <span className="font-bold text-amber-400 font-mono">{detectionResult.openings?.length || 0}</span>
                </div>
                <div className="p-1.5 rounded-lg bg-slate-900/90 border border-slate-800 flex justify-between items-center">
                  <span className="text-slate-400">Rooms:</span>
                  <span className="font-bold text-indigo-400 font-mono">{detectionResult.rooms?.length || 0}</span>
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons: Detect Walls -> Approve 2D -> Generate 3D */}
          <div className="flex flex-col gap-2 pt-1">
            {/* Step 1: Detect Walls */}
            <button
              id="detect-walls-btn"
              type="button"
              disabled={isDetecting}
              onClick={handleDetectWalls}
              className={`w-full py-2.5 px-3 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-2 shadow-md ${
                isDetecting
                  ? 'bg-slate-800 text-slate-400 cursor-not-allowed'
                  : 'bg-sky-600 hover:bg-sky-500 text-white shadow-sky-950/40 cursor-pointer'
              }`}
            >
              {isDetecting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-sky-300" />
                  <span>Interpreting Structural Regions...</span>
                </>
              ) : (
                <>
                  <Scan className="w-3.5 h-3.5 text-sky-200" />
                  <span>{detectionResult ? 'Re-run Region Detection' : 'Detect Structural Walls'}</span>
                </>
              )}
            </button>

            {/* Step 2: Approve 2D Structure (MANDATORY TEST MODE REQUIREMENT) */}
            {detectionResult && (
              <button
                id="approve-2d-structure-btn"
                type="button"
                onClick={handleApprove2d}
                className={`w-full py-2 px-3 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-2 border ${
                  is2dApproved
                    ? 'bg-emerald-950/60 border-emerald-500/80 text-emerald-300'
                    : 'bg-amber-500/20 hover:bg-amber-500/30 border-amber-400/50 text-amber-200'
                }`}
              >
                {is2dApproved ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span>2D Structure Approved ✓</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-3.5 h-3.5 text-amber-300" />
                    <span>Approve 2D Structure</span>
                  </>
                )}
              </button>
            )}

            {/* Step 3: Generate 3D Building (Unlocked ONLY after 2D approval) */}
            <button
              id="generate-3d-walls-btn"
              type="button"
              disabled={!detectionResult || !is2dApproved}
              onClick={handleGenerate3dBuilding}
              title={
                !detectionResult
                  ? 'Run detection first'
                  : !is2dApproved
                  ? 'Click "Approve 2D Structure" above to unlock 3D extrusion'
                  : 'Generate navigable 3D building model from approved 2D geometry'
              }
              className={`w-full py-2.5 px-3 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-2 ${
                detectionResult && is2dApproved
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-950/50 cursor-pointer'
                  : 'bg-slate-800/80 text-slate-500 border border-slate-700/50 cursor-not-allowed'
              }`}
            >
              <Box className="w-3.5 h-3.5" />
              <span>Generate 3D Building</span>
              {(!detectionResult || !is2dApproved) && (
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-700/60 text-slate-400 font-normal">
                  Locked
                </span>
              )}
            </button>

            {/* Status Notifications */}
            {generate3dNotice && (
              <div className="p-2.5 rounded-lg bg-emerald-950/60 border border-emerald-700/60 text-emerald-200 text-xs flex items-start gap-2 shadow-sm">
                <Info className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <p className="text-[11px] leading-relaxed">{generate3dNotice}</p>
              </div>
            )}

            {/* Auxiliary Tools: Parameters & Elements Drawer Toggle */}
            {detectionResult && (
              <div className="flex gap-1.5 pt-1">
                <button
                  id="toggle-parameters-btn"
                  type="button"
                  onClick={() => setShowParameters(!showParameters)}
                  className={`flex-1 py-1.5 px-2 rounded-lg text-[11px] font-medium transition-all flex items-center justify-center gap-1 border ${
                    showParameters
                      ? 'bg-slate-800 text-sky-300 border-sky-600/50'
                      : 'bg-slate-900 hover:bg-slate-800 text-slate-400 border-slate-800'
                  }`}
                >
                  <Sliders className="w-3 h-3" />
                  <span>Parameters</span>
                </button>

                <button
                  id="toggle-wall-list-btn"
                  type="button"
                  onClick={() => setShowElementsList(!showElementsList)}
                  className={`flex-1 py-1.5 px-2 rounded-lg text-[11px] font-medium transition-all flex items-center justify-center gap-1 border ${
                    showElementsList
                      ? 'bg-slate-800 text-emerald-300 border-emerald-600/50'
                      : 'bg-slate-900 hover:bg-slate-800 text-slate-400 border-slate-800'
                  }`}
                >
                  <Layers className="w-3 h-3" />
                  <span>Elements ({detectionResult.wall_count}W / {detectionResult.rooms?.length || 0}R)</span>
                </button>
              </div>
            )}

            {/* Parameters Drawer */}
            {showParameters && detectionResult?.parameters && (
              <div className="p-2.5 rounded-xl bg-slate-950/90 border border-slate-800 text-[11px] space-y-1.5 font-mono">
                <div className="text-[10px] uppercase font-bold text-slate-400 font-sans tracking-wider border-b border-slate-800 pb-1">
                  Structural Pipeline Parameters
                </div>
                {Object.entries(detectionResult.parameters).map(([k, v]) => (
                  <div key={k} className="flex justify-between text-slate-300">
                    <span className="text-slate-500">{k}:</span>
                    <span className="text-sky-400 font-semibold">{String(v)}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Elements Drawer (Walls, Openings, Rooms) */}
            {showElementsList && detectionResult && (
              <div className="p-2.5 rounded-xl bg-slate-950/90 border border-slate-800 text-[11px] space-y-2 max-h-56 overflow-y-auto">
                <div className="text-[10px] uppercase font-bold text-slate-400 font-sans tracking-wider border-b border-slate-800 pb-1 flex justify-between items-center">
                  <span>Detected Elements</span>
                  <span className="text-emerald-400 font-mono font-semibold">
                    {detectionResult.wall_count} walls • {detectionResult.rooms?.length || 0} rooms
                  </span>
                </div>

                {/* Rooms list */}
                {detectionResult.rooms && detectionResult.rooms.length > 0 && (
                  <div className="space-y-1">
                    <span className="text-[10px] text-indigo-400 font-semibold uppercase">Rooms / Floor Zones</span>
                    {detectionResult.rooms.map((rm) => (
                      <div key={rm.id} className="p-1.5 rounded bg-slate-900 border border-slate-800 flex justify-between items-center text-[10px]">
                        <span className="font-semibold text-slate-200">{rm.name}</span>
                        <span className="text-sky-400 font-mono">{rm.areaM2} m²</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Walls list */}
                <div className="space-y-1 pt-1">
                  <span className="text-[10px] text-emerald-400 font-semibold uppercase">Walls</span>
                  {detectionResult.walls.map((wall: DetectedWall, index: number) => (
                    <div
                      key={index}
                      onMouseEnter={() => setHoveredWallIndex(index)}
                      onMouseLeave={() => setHoveredWallIndex(null)}
                      className={`p-2 rounded-lg border transition-all flex flex-col gap-1 ${
                        hoveredWallIndex === index
                          ? 'bg-emerald-950/80 border-emerald-500 text-emerald-100 shadow-sm'
                          : 'bg-slate-900/70 border-slate-800 text-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-emerald-400 font-bold">{wall.id || `wall-${index + 1}`}</span>
                        <div className="flex items-center gap-1.5">
                          <span className="px-1.5 py-0.5 rounded bg-sky-950 border border-sky-800 text-sky-300 text-[9px]">
                            {wall.orientation || 'wall'}
                          </span>
                          <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-200 text-[9px] font-semibold">
                            T: {wall.thickness}px
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-slate-400 text-[10px]">
                        <span className="text-sky-300 truncate">
                          ({wall.x1}, {wall.y1}) → ({wall.x2}, {wall.y2})
                        </span>
                        <span className="text-slate-300 font-semibold">{wall.length || 0}px</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Clear Blueprint */}
            <button
              id="clear-blueprint-btn"
              type="button"
              onClick={handleClearBlueprint}
              className="w-full py-1.5 px-3 rounded-lg text-slate-400 hover:text-rose-300 hover:bg-rose-950/30 transition-colors text-xs flex items-center justify-center gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear Blueprint</span>
            </button>
          </div>
        </div>
      )}

      {/* Fullscreen High-Resolution Inspection Modal */}
      {showFullPreview && blueprint && (
        <div
          id="blueprint-preview-modal"
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex flex-col p-4 md:p-6"
          onClick={() => setShowFullPreview(false)}
        >
          <div
            className="relative flex-1 bg-slate-950 border border-slate-800 rounded-2xl flex flex-col overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/60">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-sky-500/20 text-sky-400 border border-sky-400/30">
                  <Eye className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white leading-tight">
                    {blueprint.fileName}
                  </h3>
                  <p className="text-xs text-slate-400">
                    Resolution: {blueprint.width} × {blueprint.height} px • Active Layer: <span className="text-sky-400 font-mono font-semibold">{activeLayer}</span>
                  </p>
                </div>
              </div>

              {/* Layer Selection Pills in Modal Header */}
              {detectionResult && (
                <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
                  {(['original', 'mask', 'polygons', 'centerlines', 'openings', 'rooms', 'final2d'] as PipelineLayerKey[]).map((l) => (
                    <button
                      key={l}
                      type="button"
                      onClick={() => setActiveLayer(l)}
                      className={`px-2.5 py-1 text-xs rounded-lg font-medium transition-all ${
                        activeLayer === l
                          ? 'bg-sky-500 text-slate-950 font-bold shadow'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {l}
                    </button>
                  ))}
                </div>
              )}

              <button
                type="button"
                onClick={() => setShowFullPreview(false)}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Image Body */}
            <div className="flex-1 p-4 flex items-center justify-center overflow-auto bg-slate-950/90">
              <img
                src={activePreviewSrc}
                alt="High-Res Blueprint Inspection"
                className="max-w-full max-h-full object-contain shadow-2xl rounded-lg"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
