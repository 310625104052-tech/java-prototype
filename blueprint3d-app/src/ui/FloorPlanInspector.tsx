import React, { useState } from 'react';
import { FloorPlanData } from '../types/floorplan';
import { Code2, X, Layers, Box, DoorOpen, LayoutGrid, Check } from 'lucide-react';

interface FloorPlanInspectorProps {
  floorPlan: FloorPlanData;
  isOpen: boolean;
  onClose: () => void;
}

export function FloorPlanInspector({ floorPlan, isOpen, onClose }: FloorPlanInspectorProps) {
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'walls' | 'doors' | 'windows' | 'rooms'>('all');

  if (!isOpen) return null;

  const getFilteredData = () => {
    switch (activeTab) {
      case 'walls':
        return { walls: floorPlan.walls };
      case 'doors':
        return { doors: floorPlan.doors };
      case 'windows':
        return { windows: floorPlan.windows };
      case 'rooms':
        return { rooms: floorPlan.rooms };
      default:
        return floorPlan;
    }
  };

  const jsonString = JSON.stringify(getFilteredData(), null, 2);

  const handleCopy = () => {
    navigator.clipboard.writeText(jsonString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-3xl rounded-2xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-sky-500/10 border border-sky-500/30 text-sky-400">
              <Code2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">Floor Plan Data Architecture</h2>
              <p className="text-xs text-slate-400">
                Structured input object converted procedurally into 3D Three.js meshes
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filter Tabs */}
        <div className="px-6 py-2.5 bg-slate-900/90 border-b border-slate-800 flex gap-2 text-xs">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
              activeTab === 'all'
                ? 'bg-sky-500 text-white'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            Complete JSON
          </button>
          <button
            onClick={() => setActiveTab('walls')}
            className={`px-3 py-1.5 rounded-lg font-medium flex items-center gap-1.5 transition-all ${
              activeTab === 'walls'
                ? 'bg-sky-500 text-white'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            Walls ({floorPlan.walls.length})
          </button>
          <button
            onClick={() => setActiveTab('doors')}
            className={`px-3 py-1.5 rounded-lg font-medium flex items-center gap-1.5 transition-all ${
              activeTab === 'doors'
                ? 'bg-sky-500 text-white'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <DoorOpen className="w-3.5 h-3.5" />
            Doors ({floorPlan.doors.length})
          </button>
          <button
            onClick={() => setActiveTab('windows')}
            className={`px-3 py-1.5 rounded-lg font-medium flex items-center gap-1.5 transition-all ${
              activeTab === 'windows'
                ? 'bg-sky-500 text-white'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <Box className="w-3.5 h-3.5" />
            Windows ({floorPlan.windows.length})
          </button>
          <button
            onClick={() => setActiveTab('rooms')}
            className={`px-3 py-1.5 rounded-lg font-medium flex items-center gap-1.5 transition-all ${
              activeTab === 'rooms'
                ? 'bg-sky-500 text-white'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            Rooms ({floorPlan.rooms.length})
          </button>
        </div>

        {/* Code Content */}
        <div className="p-6 overflow-y-auto font-mono text-xs text-slate-300 bg-slate-950/80 selection:bg-sky-500/30">
          <pre className="whitespace-pre">{jsonString}</pre>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between">
          <span className="text-xs text-slate-400">
            {floorPlan.name} • {floorPlan.bounds.maxX}m × {floorPlan.bounds.maxY}m • Standard Units: meters
          </span>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium transition-colors"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400">Copied</span>
              </>
            ) : (
              <>
                <Code2 className="w-3.5 h-3.5" />
                <span>Copy JSON</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
