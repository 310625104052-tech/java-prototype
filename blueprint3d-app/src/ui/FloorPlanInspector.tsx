import { useEffect, useState } from 'react';
import { FloorPlanData } from '../types/floorplan';
import { Box, Check, Code2, Copy, DoorOpen, Layers, LayoutGrid, X } from 'lucide-react';
import { StudioMark } from './StudioMark';

interface FloorPlanInspectorProps {
  floorPlan: FloorPlanData;
  isOpen: boolean;
  onClose: () => void;
}

type InspectorTab = 'all' | 'walls' | 'doors' | 'windows' | 'rooms';

export function FloorPlanInspector({ floorPlan, isOpen, onClose }: FloorPlanInspectorProps) {
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<InspectorTab>('all');

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

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
    setTimeout(() => setCopied(false), 1800);
  };

  const tabs: { id: InspectorTab; label: string; count?: number; icon?: typeof Layers }[] = [
    { id: 'all', label: 'Complete Schema' },
    { id: 'walls', label: 'Walls', count: floorPlan.walls.length, icon: Layers },
    { id: 'doors', label: 'Doors', count: floorPlan.doors.length, icon: DoorOpen },
    { id: 'windows', label: 'Windows', count: floorPlan.windows.length, icon: Box },
    { id: 'rooms', label: 'Rooms', count: floorPlan.rooms.length, icon: LayoutGrid },
  ];

  const widthM = (floorPlan.bounds.maxX - floorPlan.bounds.minX).toFixed(1);
  const depthM = (floorPlan.bounds.maxY - floorPlan.bounds.minY).toFixed(1);

  return (
    <div className="studio-modal-backdrop" onClick={onClose} data-ui>
      <section
        className="studio-modal-sheet studio-inspector-sheet"
        aria-label="Model data inspector"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="studio-modal-header">
          <div className="studio-modal-title-group">
            <StudioMark compact />
            <span className="studio-toolbar-divider" aria-hidden="true" />
            <div>
              <div className="studio-modal-kicker">STRUCTURAL SPECIFICATION // JSON</div>
              <h2>Model data</h2>
            </div>
          </div>

          <div className="studio-modal-header-actions">
            <button
              type="button"
              onClick={handleCopy}
              className="studio-secondary"
            >
              {copied ? (
                <>
                  <Check size={15} aria-hidden="true" />
                  <span>Copied to clipboard</span>
                </>
              ) : (
                <>
                  <Copy size={15} aria-hidden="true" />
                  <span>Copy JSON</span>
                </>
              )}
            </button>
            <button
              type="button"
              aria-label="Close model data"
              onClick={onClose}
              className="studio-icon-button"
            >
              <X size={18} aria-hidden="true" />
            </button>
          </div>
        </header>

        <div className="studio-data-tabs" role="tablist" aria-label="Filter model data sections">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setActiveTab(tab.id)}
                className={`studio-data-tab${isActive ? ' is-active' : ''}`}
              >
                {Icon && <Icon size={14} aria-hidden="true" />}
                <span>{tab.label}</span>
                {typeof tab.count === 'number' && (
                  <span className="studio-tab-count">{tab.count}</span>
                )}
              </button>
            );
          })}
        </div>

        <div className="studio-code-well">
          <pre>{jsonString}</pre>
        </div>

        <footer className="studio-data-footer">
          <span>
            <strong>{floorPlan.name}</strong> · {widthM}m × {depthM}m footprint · Units: meters
          </span>
          <span className="studio-data-meta">
            <Code2 size={14} aria-hidden="true" />
            <span>{jsonString.split('\n').length} lines</span>
          </span>
        </footer>
      </section>
    </div>
  );
}
