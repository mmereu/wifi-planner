import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { Stage, Layer, Image, Line, Circle, Text, Rect, Group } from 'react-konva';
import useStore from '../store/useStore';
import { getMaterial } from '../lib/wallMaterials';
import WALL_MATERIALS from '../lib/wallMaterials';
import { generateHeatmap, sampleSignal, sampleOverlap, HEATMAP_RANGE, OVERLAP_LABELS, OVERLAP_COLORS } from '../lib/heatmap';

function getImageUrl(floor) {
  if (!floor) return null;
  const imgPath = floor.thumbnail_path;
  if (!imgPath) return null;
  return imgPath.replace('/app', '');
}

const TOOL_INSTRUCTIONS = {
  scale:      'Clicca due punti con distanza nota',
  measure:    'Clicca due punti per misurare la distanza',
  drawWall:   'Clicca per iniziare un muro (Shift = dritto)',
  drawShelf:  'Clicca per iniziare uno scaffale (Shift = dritto, tasto destro = fine)',
  placeAP:    'Clicca per piazzare un Access Point',
  drawZone:   'Clicca angolo iniziale, poi angolo finale per disegnare la zona scaffali',
};

export const ZONE_TYPES = [
  { id: 'shelf_empty', name: 'Scaffale vuoto',   color: 'rgba(255,220,0,0.35)',   atten24: 5,  atten5: 8  },
  { id: 'shelf_full',  name: 'Scaffale pieno',   color: 'rgba(255,140,0,0.4)',    atten24: 12, atten5: 20 },
  { id: 'shelf_wet',   name: 'Scaffale freschi', color: 'rgba(0,140,220,0.35)',   atten24: 16, atten5: 28 },
];

export default function FloorCanvas() {
  const {
    currentFloor,
    walls,
    accessPoints,
    shelvingZones,
    placeAP,
    loading,
    activeTool,
    setActiveTool,
    scalePoint1,
    scalePoint2,
    setScalePoint1,
    setScalePoint2,
    applyScale,
    drawingWallStart,
    setDrawingWallStart,
    addWall,
    selectedMaterial,
    deleteWall,
    stopGroup,
    updateAP,
    deleteAP,
    addShelvingZone,
    deleteShelvingZone,
    pixelsPerMeter,
    selectedFrequency,
    showHeatmap,
    heatmapMode,
    selectedZoneType,
  } = useStore();

  const containerRef = useRef();
  const stageRef = useRef();
  const [size, setSize] = useState({ width: 800, height: 600 });
  const [bgImage, setBgImage] = useState(null);
  const [imgError, setImgError] = useState(false);
  const [scale, setScale] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [selectedGroupKey, setSelectedGroupKey] = useState(null); // wall.id or wall.group_id
  const [mousePos, setMousePos] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [signalAtCursor, setSignalAtCursor] = useState(null); // dBm value under mouse
  const [overlapAtCursor, setOverlapAtCursor] = useState(null); // AP overlap count
  const heatmapGridRef = useRef(null); // raw heatmap grid data for tooltip
  const [measureStart, setMeasureStart] = useState(null); // ruler start point
  const [measureEnd, setMeasureEnd] = useState(null); // ruler end point (confirmed)
  const [spaceHeld, setSpaceHeld] = useState(false);
  const [floorRotation, setFloorRotation] = useState(0); // 0, 90, 180, 270
  const contentGroupRef = useRef(null);
  const [zoneStart, setZoneStart] = useState(null); // {x,y} first corner of zone rect

  // Reset transient state when switching tools
  useEffect(() => {
    if (activeTool !== 'measure') { setMeasureStart(null); setMeasureEnd(null); }
    if (activeTool !== 'drawZone') { setZoneStart(null); }
  }, [activeTool]);

  // ResizeObserver
  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect;
      setSize({ width, height });
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  // Load background image
  useEffect(() => {
    setBgImage(null);
    setImgError(false);
    setScale(1);
    setPos({ x: 0, y: 0 });
    setSelectedGroupKey(null);
    setFloorRotation(0);
    if (!currentFloor) return;

    const url = getImageUrl(currentFloor);
    console.log('FloorCanvas: floor=', currentFloor.name, 'thumbnail_path=', currentFloor.thumbnail_path, 'url=', url);
    if (!url) {
      console.warn('No thumbnail_path for floor:', currentFloor.name);
      return;
    }

    const img = new window.Image();
    img.crossOrigin = 'anonymous';
    img.src = url;
    img.onload = () => {
      console.log('Image loaded OK:', url, img.width, 'x', img.height);
      setBgImage(img);
      const scaleX = (size.width - 40) / img.width;
      const scaleY = (size.height - 40) / img.height;
      const s = Math.min(scaleX, scaleY, 1);
      setScale(s);
      setPos({
        x: (size.width - img.width * s) / 2,
        y: (size.height - img.height * s) / 2,
      });
    };
    img.onerror = (e) => {
      console.error('Image load error:', url, e);
      setImgError(true);
    };
  }, [currentFloor?.id, currentFloor?.thumbnail_path]);

  // Keyboard: Delete wall + Spacebar pan
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedGroupKey !== null && activeTool === 'select') {
        deleteWall(selectedGroupKey);
        setSelectedGroupKey(null);
      }
      if (e.code === 'Space' && !e.repeat) {
        e.preventDefault();
        setSpaceHeld(true);
      }
    };
    const handleKeyUp = (e) => {
      if (e.code === 'Space') {
        e.preventDefault();
        setSpaceHeld(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [selectedGroupKey, activeTool, deleteWall]);

  // Right-click to stop wall chain + end group
  useEffect(() => {
    const handleContextMenu = (e) => {
      if (activeTool === 'drawWall' || activeTool === 'drawShelf') {
        e.preventDefault();
        if (drawingWallStart) {
          stopGroup();
          setDrawingWallStart(null);
          setMousePos(null);
        }
      }
    };
    window.addEventListener('contextmenu', handleContextMenu);
    return () => window.removeEventListener('contextmenu', handleContextMenu);
  }, [activeTool, drawingWallStart, stopGroup]);

  // Zoom toward cursor
  const handleWheel = useCallback((e) => {
    e.evt.preventDefault();
    const scaleBy = 1.1;
    const stage = e.target.getStage();
    const oldScale = scale;
    const pointer = stage.getPointerPosition();
    const mousePointTo = {
      x: (pointer.x - pos.x) / oldScale,
      y: (pointer.y - pos.y) / oldScale,
    };
    const newScale = e.evt.deltaY > 0 ? oldScale / scaleBy : oldScale * scaleBy;
    setScale(newScale);
    setPos({
      x: pointer.x - mousePointTo.x * newScale,
      y: pointer.y - mousePointTo.y * newScale,
    });
  }, [scale, pos]);

  // Mouse move: update drawing/scale preview + heatmap tooltip
  const handleMouseMove = useCallback((e) => {
    if (!contentGroupRef.current) return;
    const pt = contentGroupRef.current.getRelativePointerPosition();
    const imgX = pt.x;
    const imgY = pt.y;

    const needsPreview =
      ((activeTool === 'drawWall' || activeTool === 'drawShelf') && drawingWallStart) ||
      (activeTool === 'scale' && scalePoint1 && !scalePoint2) ||
      (activeTool === 'measure' && measureStart && !measureEnd) ||
      (activeTool === 'drawZone' && zoneStart);
    if (needsPreview) {
      setMousePos({ x: imgX, y: imgY });
    }

    // Sample heatmap signal at cursor
    if (showHeatmap && heatmapGridRef.current) {
      const dbm = sampleSignal(heatmapGridRef.current, imgX, imgY);
      const olap = sampleOverlap(heatmapGridRef.current, imgX, imgY);
      setSignalAtCursor(dbm);
      setOverlapAtCursor(olap);
    } else {
      setSignalAtCursor(null);
      setOverlapAtCursor(null);
    }
  }, [activeTool, drawingWallStart, scalePoint1, scalePoint2, measureStart, measureEnd, zoneStart, showHeatmap]);

  const handleWallClick = useCallback((wall, e) => {
    if (activeTool !== 'select') return;
    e.cancelBubble = true;
    // Use group_id if available, otherwise wall.id
    const key = wall.group_id || wall.id;
    setSelectedGroupKey(prev => prev === key ? null : key);
  }, [activeTool]);

  const handleCanvasClick = useCallback(async (e) => {
    // Ignore right-clicks (handled by contextmenu for wall chain stop)
    if (e.evt.button !== 0) return;
    // Ignore clicks during spacebar pan
    if (spaceHeld) return;
    // In select mode, ignore clicks on wall Lines (handled by handleWallClick)
    if (activeTool === 'select' && e.target !== e.target.getStage() && e.target.getClassName() === 'Line') return;

    if (!contentGroupRef.current) return;
    const pt = contentGroupRef.current.getRelativePointerPosition();
    const x = pt.x;
    const y = pt.y;

    const snap = (x1, y1, x2, y2) => {
      if (e.evt.shiftKey) {
        const dx = Math.abs(x2 - x1);
        const dy = Math.abs(y2 - y1);
        if (dx > dy) return { x: x2, y: y1 };
        return { x: x1, y: y2 };
      }
      return { x: x2, y: y2 };
    };

    switch (activeTool) {
      case 'select':
        setSelectedGroupKey(null);
        break;

      case 'scale':
        if (!scalePoint1) {
          setScalePoint1({ x, y });
          setMousePos({ x, y });
        } else {
          setScalePoint2({ x, y });
          setMousePos(null);
          const distCm = prompt('Inserisci la distanza reale in centimetri:');
          if (distCm && parseFloat(distCm) > 0) {
            await applyScale(parseFloat(distCm) / 100);
          } else {
            setScalePoint1(null);
            setScalePoint2(null);
          }
        }
        break;

      case 'drawWall':
      case 'drawShelf':
        if (!drawingWallStart) {
          setDrawingWallStart({ x, y });
          setMousePos({ x, y });
        } else {
          const end = snap(drawingWallStart.x, drawingWallStart.y, x, y);
          await addWall(drawingWallStart.x, drawingWallStart.y, end.x, end.y);
          setDrawingWallStart({ x: end.x, y: end.y });
          setMousePos({ x: end.x, y: end.y });
        }
        break;

      case 'measure':
        if (!measureStart) {
          setMeasureStart({ x, y });
          setMeasureEnd(null);
          setMousePos({ x, y });
        } else if (!measureEnd) {
          setMeasureEnd({ x, y });
          setMousePos(null);
        } else {
          // Third click resets
          setMeasureStart({ x, y });
          setMeasureEnd(null);
          setMousePos({ x, y });
        }
        break;

      case 'placeAP': {
        const name = prompt('Nome AP:') || ('AP-' + (accessPoints.length + 1));
        await placeAP(x, y, name);
        break;
      }

      case 'drawZone': {
        if (!zoneStart) {
          setZoneStart({ x, y });
          setMousePos({ x, y });
        } else {
          const rx = Math.min(zoneStart.x, x);
          const ry = Math.min(zoneStart.y, y);
          const rw = Math.abs(x - zoneStart.x);
          const rh = Math.abs(y - zoneStart.y);
          if (rw > 5 && rh > 5) {
            const zt = ZONE_TYPES.find(t => t.id === selectedZoneType) || ZONE_TYPES[1];
            await addShelvingZone(rx, ry, rw, rh, selectedZoneType, zt.atten24, zt.atten5);
          }
          setZoneStart(null);
          setMousePos(null);
        }
        break;
      }

      default:
        break;
    }
  }, [
    activeTool,
    spaceHeld,
    scalePoint1,
    drawingWallStart,
    measureStart,
    measureEnd,
    zoneStart,
    selectedZoneType,
    accessPoints.length,
    setScalePoint1,
    setScalePoint2,
    applyScale,
    setDrawingWallStart,
    addWall,
    placeAP,
    addShelvingZone,
  ]);

  // Compute distinct material types from walls on the floor
  const legendMaterials = React.useMemo(() => {
    const seen = new Set();
    const items = [];
    for (const wall of walls) {
      const key = wall.wall_type || 'drywall';
      if (!seen.has(key)) {
        seen.add(key);
        items.push(getMaterial(key));
      }
    }
    // Always show AP entry
    return items;
  }, [walls]);

  // Heatmap image generation
  const [heatmapImage, setHeatmapImage] = useState(null);
  useEffect(() => {
    if (!showHeatmap || !bgImage || accessPoints.length === 0) {
      setHeatmapImage(null);
      return;
    }
    // Use calibrated scale or estimate from image size (assume ~30m width as default)
    const ppm = pixelsPerMeter > 0 ? pixelsPerMeter : bgImage.width / 30;
    const w = bgImage.width;
    const h = bgImage.height;
    const result = generateHeatmap(w, h, accessPoints, walls, shelvingZones, ppm, selectedFrequency, heatmapMode);
    if (!result) { setHeatmapImage(null); heatmapGridRef.current = null; return; }
    heatmapGridRef.current = result;
    const offCanvas = document.createElement('canvas');
    offCanvas.width = w;
    offCanvas.height = h;
    const ctx = offCanvas.getContext('2d');
    ctx.putImageData(result.imageData, 0, 0);
    const img = new window.Image();
    img.src = offCanvas.toDataURL();
    img.onload = () => setHeatmapImage(img);
  }, [showHeatmap, bgImage, accessPoints, walls, shelvingZones, pixelsPerMeter, selectedFrequency, heatmapMode]);

  // Determine cursor style
  const cursor = (() => {
    if (spaceHeld) return isDragging ? 'grabbing' : 'grab';
    if (activeTool === 'select') return isDragging ? 'grabbing' : 'grab';
    return 'crosshair';
  })();

  // Snap helper for preview line
  const getSnappedPreview = () => {
    if (!drawingWallStart || !mousePos) return null;
    return mousePos;
  };

  if (!currentFloor) {
    return (
      <div
        ref={containerRef}
        style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#555', background: '#1a1a2e' }}
      >
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: 20, marginBottom: 8, color: '#4a9eff' }}>Nessun piano selezionato</p>
          <p style={{ fontSize: 14 }}>Carica un piano dalla sidebar</p>
        </div>
      </div>
    );
  }

  const hasNoThumbnail = !currentFloor.thumbnail_path;
  const instruction = TOOL_INSTRUCTIONS[activeTool];
  const previewEnd = getSnappedPreview();

  return (
    <div ref={containerRef} style={{ flex: 1, position: 'relative', overflow: 'hidden', background: '#1a1a2e' }}>

      {/* Force scale calibration overlay */}
      {bgImage && pixelsPerMeter <= 0 && activeTool !== 'scale' && (
        <div style={{
          position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.7)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 50, backdropFilter: 'blur(2px)',
        }}>
          <div style={{
            background: '#1a2744', borderRadius: 12, padding: '32px 40px',
            textAlign: 'center', maxWidth: 420, border: '1px solid #2a4a7a',
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
          }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📏</div>
            <h2 style={{ color: '#4a9eff', margin: '0 0 12px', fontSize: 20 }}>Calibra la scala</h2>
            <p style={{ color: '#aaa', fontSize: 14, lineHeight: 1.6, margin: '0 0 20px' }}>
              Prima di iniziare, devi calibrare la scala della planimetria.<br/>
              Clicca due punti di cui conosci la distanza reale.
            </p>
            <button
              onClick={() => setActiveTool('scale')}
              style={{
                background: '#1565c0', color: '#fff', border: 'none', borderRadius: 8,
                padding: '12px 32px', fontSize: 16, cursor: 'pointer', fontWeight: 600,
              }}
            >
              Misura la scala
            </button>
          </div>
        </div>
      )}

      {/* No thumbnail placeholder */}
      {hasNoThumbnail && (
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
          justifyContent: 'center', flexDirection: 'column', gap: 16, zIndex: 5,
        }}>
          <p style={{ color: '#aaa', fontSize: 16 }}>
            Piano: <strong style={{ color: '#fff' }}>{currentFloor.name}</strong>
          </p>
          <p style={{ color: '#777', fontSize: 13 }}>Elabora il piano dalla toolbar per visualizzare la pianta</p>
        </div>
      )}

      {/* Image error banner */}
      {imgError && (
        <div style={{
          position: 'absolute', top: 10, left: '50%', transform: 'translateX(-50%)',
          zIndex: 20, background: '#e74c3c', color: '#fff', borderRadius: 8, padding: '8px 16px', fontSize: 13,
        }}>
          Errore immagine — riprova a processare il piano
        </div>
      )}

      {/* Tool instruction bar */}
      {instruction && (
        <div style={{
          position: 'absolute', top: 10, left: '50%', transform: 'translateX(-50%)',
          zIndex: 20, background: 'rgba(0,0,0,0.75)', color: '#f0f0f0',
          borderRadius: 6, padding: '6px 16px', fontSize: 13, pointerEvents: 'none',
          whiteSpace: 'nowrap', border: '1px solid rgba(255,255,255,0.12)',
        }}>
          {instruction}
          {activeTool === 'scale' && scalePoint1 && !scalePoint2 && (
            <span style={{ marginLeft: 8, color: '#ff6b6b' }}>• Primo punto impostato — clicca il secondo</span>
          )}
          {(activeTool === 'drawWall' || activeTool === 'drawShelf') && drawingWallStart && (
            <span style={{ marginLeft: 8, color: '#ffd93d' }}>• Inizio impostato — clicca per continuare</span>
          )}
          {activeTool === 'drawZone' && !zoneStart && (
            <span style={{ marginLeft: 8, color: '#27ae60' }}>• Clicca l'angolo in alto a sinistra dello scaffale</span>
          )}
          {activeTool === 'drawZone' && zoneStart && (
            <span style={{ marginLeft: 8, color: '#ffd93d' }}>• Angolo iniziale impostato — clicca l'angolo opposto</span>
          )}
        </div>
      )}

      {/* Reset view button */}
      <div style={{ position: 'absolute', top: 10, right: 10, zIndex: 10 }}>
        <button
          onClick={() => { setScale(1); setPos({ x: 0, y: 0 }); }}
          style={{ background: '#2c3e50', color: '#ccc', fontSize: 12, padding: '6px 10px', border: 'none', borderRadius: 6, cursor: 'pointer' }}
        >
          Reset
        </button>
      </div>

      {/* Rotate buttons */}
      {bgImage && (
        <div style={{ position: 'absolute', top: 46, right: 10, zIndex: 10, display: 'flex', gap: 4 }}>
          <button
            onClick={() => setFloorRotation(r => (r - 90 + 360) % 360)}
            title="Ruota 90° sinistra"
            style={{ background: '#1a4a8a', color: '#fff', fontSize: 14, padding: '4px 8px', border: 'none', borderRadius: 6, cursor: 'pointer' }}
          >↺</button>
          <button
            onClick={() => setFloorRotation(r => (r + 90) % 360)}
            title="Ruota 90° destra"
            style={{ background: '#1a4a8a', color: '#fff', fontSize: 14, padding: '4px 8px', border: 'none', borderRadius: 6, cursor: 'pointer' }}
          >↻</button>
        </div>
      )}

      {/* Konva Stage */}
      <Stage
        ref={stageRef}
        width={size.width}
        height={size.height}
        scaleX={scale}
        scaleY={scale}
        x={pos.x}
        y={pos.y}
        onWheel={handleWheel}
        draggable={activeTool === 'select' || spaceHeld}
        onDragStart={() => setIsDragging(true)}
        onDragEnd={e => { setPos({ x: e.target.x(), y: e.target.y() }); setIsDragging(false); }}
        onClick={handleCanvasClick}
        onMouseMove={handleMouseMove}
        style={{ cursor }}
      >
        <Layer>
          <Group
            ref={contentGroupRef}
            rotation={floorRotation}
            x={bgImage ? bgImage.width / 2 : 0}
            y={bgImage ? bgImage.height / 2 : 0}
            offsetX={bgImage ? bgImage.width / 2 : 0}
            offsetY={bgImage ? bgImage.height / 2 : 0}
          >
          {/* Background floor image */}
          {bgImage && <Image image={bgImage} />}

          {/* Shelving zones */}
          {shelvingZones.map(zone => {
            const zt = ZONE_TYPES.find(t => t.id === zone.zone_type) || ZONE_TYPES[1];
            // Parse rgba color for Konva
            const m = zt.color.match(/rgba\((\d+),(\d+),(\d+),([\d.]+)\)/);
            const [, r, g, b, a] = m || [, 255, 140, 0, 0.4];
            return (
              <React.Fragment key={zone.id}>
                <Rect
                  x={zone.x} y={zone.y} width={zone.width} height={zone.height}
                  fill={`rgb(${r},${g},${b})`} opacity={parseFloat(a)}
                  stroke={`rgb(${r},${g},${b})`} strokeWidth={2 / scale}
                  onDblClick={(e) => {
                    if (activeTool !== 'select') return;
                    e.cancelBubble = true;
                    if (confirm(`Eliminare zona "${zt.name}"?`)) deleteShelvingZone(zone.id);
                  }}
                />
                <Text
                  x={zone.x + 4 / scale} y={zone.y + 4 / scale}
                  text={zt.name} fontSize={11 / scale} fill="#fff" fontStyle="bold"
                  stroke="#000" strokeWidth={0.4 / scale} listening={false}
                />
              </React.Fragment>
            );
          })}

          {/* Zone preview while drawing */}
          {activeTool === 'drawZone' && zoneStart && mousePos && (() => {
            const zt = ZONE_TYPES.find(t => t.id === selectedZoneType) || ZONE_TYPES[1];
            const m = zt.color.match(/rgba\((\d+),(\d+),(\d+),([\d.]+)\)/);
            const [, r, g, b, a] = m || [, 255, 140, 0, 0.4];
            return (
              <Rect
                x={Math.min(zoneStart.x, mousePos.x)} y={Math.min(zoneStart.y, mousePos.y)}
                width={Math.abs(mousePos.x - zoneStart.x)} height={Math.abs(mousePos.y - zoneStart.y)}
                fill={`rgb(${r},${g},${b})`} opacity={parseFloat(a) * 0.7}
                stroke={`rgb(${r},${g},${b})`} strokeWidth={2 / scale}
                dash={[8 / scale, 4 / scale]} listening={false}
              />
            );
          })()}

          {/* Walls + Shelves */}
          {walls.map((wall) => {
            const mat = getMaterial(wall.wall_type);
            const key = wall.group_id || wall.id;
            const isSelected = key === selectedGroupKey;
            const isShelf = wall.wall_type?.startsWith('shelf_');
            const shelfLabel = { shelf_empty: 'Scaffale vuoto', shelf_full: 'Scaffale pieno', shelf_wet: 'Scaffale freschi' }[wall.wall_type];
            const midX = (wall.x1 + wall.x2) / 2;
            const midY = (wall.y1 + wall.y2) / 2;
            const angleDeg = Math.atan2(wall.y2 - wall.y1, wall.x2 - wall.x1) * 180 / Math.PI;
            return (
              <React.Fragment key={wall.id}>
                <Line
                  points={[wall.x1, wall.y1, wall.x2, wall.y2]}
                  stroke={isSelected ? '#ff4400' : mat.color}
                  strokeWidth={isShelf ? Math.max(2, mat.thickness * 1.5) + (isSelected ? 3 : 0) : Math.max(6, mat.thickness * 3) + (isSelected ? 4 : 0)}
                  dash={mat.dashed ? [12, 6] : undefined}
                  opacity={0.92}
                  lineCap="round"
                  lineJoin="round"
                  hitStrokeWidth={18}
                  onClick={(e) => handleWallClick(wall, e)}
                  onDblClick={(e) => {
                    if (activeTool !== 'select') return;
                    e.cancelBubble = true;
                    const groupKey = wall.group_id || wall.id;
                    const count = wall.group_id ? walls.filter(w => w.group_id === wall.group_id).length : 1;
                    if (confirm(`Eliminare ${count > 1 ? count + ' elementi (gruppo)' : isShelf ? 'questo scaffale' : 'questo muro'}?`)) {
                      deleteWall(groupKey);
                      setSelectedGroupKey(null);
                    }
                  }}
                />
                {isShelf && shelfLabel && (
                  <Text
                    x={midX} y={midY}
                    text={shelfLabel}
                    fontSize={10 / scale}
                    fill={mat.color}
                    fontStyle="bold"
                    rotation={angleDeg}
                    offsetX={shelfLabel.length * 3 / scale}
                    offsetY={12 / scale}
                    stroke="#000" strokeWidth={0.3 / scale}
                    listening={false}
                  />
                )}
              </React.Fragment>
            );
          })}

          {/* Drawing preview line */}
          {(activeTool === 'drawWall' || activeTool === 'drawShelf') && drawingWallStart && previewEnd && (() => {
            const mat = getMaterial(selectedMaterial);
            return (
              <Line
                points={[drawingWallStart.x, drawingWallStart.y, previewEnd.x, previewEnd.y]}
                stroke={mat.color}
                strokeWidth={Math.max(6, mat.thickness * 3)}
                dash={[10, 6]}
                opacity={0.6}
                lineCap="round"
                listening={false}
              />
            );
          })()}

          {/* Zone start corner dot */}
          {activeTool === 'drawZone' && zoneStart && (
            <Circle x={zoneStart.x} y={zoneStart.y} radius={7 / scale} fill="#27ae60" stroke="#fff" strokeWidth={2 / scale} listening={false} />
          )}

          {/* Scale calibration dots and line */}
          {scalePoint1 && (
            <Circle x={scalePoint1.x} y={scalePoint1.y} radius={6 / scale} fill="#ff2222" listening={false} />
          )}
          {scalePoint2 && (
            <Circle x={scalePoint2.x} y={scalePoint2.y} radius={6 / scale} fill="#ff2222" listening={false} />
          )}
          {/* Scale preview line: follows mouse before second click */}
          {scalePoint1 && !scalePoint2 && mousePos && (
            <Line
              points={[scalePoint1.x, scalePoint1.y, mousePos.x, mousePos.y]}
              stroke="#ff2222"
              strokeWidth={3 / scale}
              dash={[8 / scale, 4 / scale]}
              listening={false}
            />
          )}
          {/* Scale final line: between both points */}
          {scalePoint1 && scalePoint2 && (
            <Line
              points={[scalePoint1.x, scalePoint1.y, scalePoint2.x, scalePoint2.y]}
              stroke="#ff2222"
              strokeWidth={3 / scale}
              listening={false}
            />
          )}

          {/* Ruler / measure tool */}
          {activeTool === 'measure' && measureStart && (() => {
            const endPt = measureEnd || (mousePos ? mousePos : null);
            if (!endPt) return null;
            const dx = endPt.x - measureStart.x;
            const dy = endPt.y - measureStart.y;
            const distPx = Math.sqrt(dx * dx + dy * dy);
            const ppm = pixelsPerMeter > 0 ? pixelsPerMeter : (bgImage ? bgImage.width / 30 : 100);
            const distM = distPx / ppm;
            const midX = (measureStart.x + endPt.x) / 2;
            const midY = (measureStart.y + endPt.y) / 2;
            return (
              <>
                <Line
                  points={[measureStart.x, measureStart.y, endPt.x, endPt.y]}
                  stroke="#00bcd4"
                  strokeWidth={3 / scale}
                  dash={measureEnd ? undefined : [8 / scale, 4 / scale]}
                  listening={false}
                />
                <Circle x={measureStart.x} y={measureStart.y} radius={5 / scale} fill="#00bcd4" listening={false} />
                {measureEnd && <Circle x={measureEnd.x} y={measureEnd.y} radius={5 / scale} fill="#00bcd4" listening={false} />}
                <Text
                  x={midX - 50 / scale} y={midY - 20 / scale}
                  text={distM >= 1 ? `${distM.toFixed(2)} m` : `${(distM * 100).toFixed(0)} cm`}
                  fontSize={16 / scale} fill="#fff" fontStyle="bold"
                  width={100 / scale} align="center"
                  stroke="#000" strokeWidth={0.8 / scale}
                  listening={false}
                />
              </>
            );
          })()}

          {/* Heatmap overlay */}
          {heatmapImage && (
            <Image image={heatmapImage} opacity={0.55} listening={false} />
          )}

          {/* Access Points - large red icons with name */}
          {accessPoints.map(ap => {
            const r = 18 / scale;
            return (
              <React.Fragment key={ap.id}>
                {/* Draggable AP group */}
                <Circle
                  x={ap.x} y={ap.y} radius={r}
                  fill="#1565c0" stroke="#fff" strokeWidth={3 / scale} opacity={0.95}
                  draggable={activeTool === 'select'}
                  onDragStart={(e) => { e.cancelBubble = true; }}
                  onDragMove={(e) => { e.cancelBubble = true; }}
                  onDragEnd={(e) => {
                    e.cancelBubble = true;
                    const node = e.target;
                    updateAP(ap.id, { x: node.x(), y: node.y() }).catch(() => {
                      node.x(ap.x);
                      node.y(ap.y);
                    });
                  }}
                  onClick={(e) => { e.cancelBubble = true; }}
                  onDblClick={(e) => {
                    e.cancelBubble = true;
                    if (confirm(`Eliminare AP "${ap.name}"?`)) deleteAP(ap.id);
                  }}
                />
                <Text
                  x={ap.x - 60 / scale} y={ap.y - 7 / scale}
                  text={ap.name} fontSize={11 / scale} fill="#fff"
                  width={120 / scale} align="center" fontStyle="bold"
                  listening={false}
                />
                <Text
                  x={ap.x - 80 / scale} y={ap.y + 20 / scale}
                  text="" fontSize={10 / scale} fill="#aac8ff"
                  width={160 / scale} align="center"
                  stroke="#000" strokeWidth={0.3 / scale}
                  listening={false}
                />
              </React.Fragment>
            );
          })}
          </Group>
        </Layer>
      </Stage>

      {/* Bottom-left legend */}
      <div style={{
        position: 'absolute', bottom: 10, left: 10,
        background: 'rgba(0,0,0,0.72)', borderRadius: 8, padding: '8px 12px',
        fontSize: 12, color: '#ccc', minWidth: 140,
      }}>
        {legendMaterials.length > 0 && (
          <>
            {legendMaterials.map(mat => (
              <div key={mat.id} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <div style={{
                  width: 20, height: mat.dashed ? 2 : 3,
                  background: mat.color,
                  borderTop: mat.dashed ? `2px dashed ${mat.color}` : 'none',
                  flexShrink: 0,
                }} />
                <span>{mat.name} ({walls.filter(w => (w.wall_type || 'drywall') === mat.id).length})</span>
              </div>
            ))}
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', marginTop: 4, paddingTop: 4 }} />
          </>
        )}
        {legendMaterials.length === 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <div style={{ width: 20, height: 3, background: '#7f8c8d' }} />
            <span>Muri ({walls.length})</span>
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#1565c0', flexShrink: 0 }} />
          <span>AP ({accessPoints.length})</span>
        </div>
      </div>

      {/* Heatmap legend bar */}
      {showHeatmap && heatmapMode === 'coverage' && (
        <div style={{
          position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(0,0,0,0.85)', borderRadius: 8, padding: '8px 16px',
          display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, color: '#ccc',
          zIndex: 20,
        }}>
          <span style={{ fontWeight: 600 }}>Debole</span>
          <div style={{ position: 'relative', width: 200 }}>
            <div style={{
              width: 200, height: 12, borderRadius: 6,
              background: 'linear-gradient(to right, #8c6430, #a08840, #c8b040, #80c040, #00c853)',
            }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2, fontSize: 10, opacity: 0.6 }}>
              <span>{HEATMAP_RANGE.min}</span>
              <span>{Math.round((HEATMAP_RANGE.weak + HEATMAP_RANGE.strong) / 2)}</span>
              <span>{HEATMAP_RANGE.strong}</span>
            </div>
          </div>
          <span style={{ fontWeight: 600 }}>Forte</span>
          <span style={{ fontSize: 11, opacity: 0.5 }}>dBm</span>
          {signalAtCursor !== null && (
            <>
              <div style={{ borderLeft: '1px solid rgba(255,255,255,0.3)', height: 20 }} />
              <span style={{ fontWeight: 700, color: signalAtCursor >= -65 ? '#00c853' : signalAtCursor >= -75 ? '#c8b040' : '#c87040', fontSize: 14 }}>
                {signalAtCursor} dBm
              </span>
            </>
          )}
        </div>
      )}

      {/* Overlap legend */}
      {showHeatmap && heatmapMode === 'overlap' && (
        <div style={{
          position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(0,0,0,0.85)', borderRadius: 8, padding: '10px 18px',
          display: 'flex', alignItems: 'center', gap: 14, fontSize: 12, color: '#ccc',
          zIndex: 20,
        }}>
          {OVERLAP_LABELS.slice(1).map((label, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 14, height: 14, borderRadius: 3, background: OVERLAP_COLORS[i + 1] }} />
              <span>{label}</span>
            </div>
          ))}
          {overlapAtCursor !== null && overlapAtCursor > 0 && (
            <>
              <div style={{ borderLeft: '1px solid rgba(255,255,255,0.3)', height: 20 }} />
              <span style={{ fontWeight: 700, color: OVERLAP_COLORS[Math.min(overlapAtCursor, 3)], fontSize: 14 }}>
                {overlapAtCursor} AP
              </span>
            </>
          )}
        </div>
      )}

      {/* Export PDF button */}
      {currentFloor && bgImage && (
        <button
          onClick={async () => {
            try {
              const { default: jsPDF } = await import('jspdf');
              const stage = stageRef.current;
              if (!stage) return;

              // Temporarily reset view to capture full image
              const oldScale = scale;
              const oldPos = pos;

              // Get image dimensions
              const imgW = bgImage.width;
              const imgH = bgImage.height;

              // Create offscreen canvas at full resolution
              const exportCanvas = document.createElement('canvas');
              const padding = 40;
              exportCanvas.width = imgW + padding * 2;
              exportCanvas.height = imgH + padding * 2;
              const ctx = exportCanvas.getContext('2d');

              // Dark background
              ctx.fillStyle = '#1a1a2e';
              ctx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);

              // Draw floor image
              ctx.drawImage(bgImage, padding, padding);

              // Draw heatmap if active
              if (heatmapImage) {
                ctx.globalAlpha = 1;
                ctx.drawImage(heatmapImage, padding, padding);
              }

              // Draw walls
              for (const wall of walls) {
                const mat = getMaterial(wall.wall_type);
                ctx.beginPath();
                ctx.moveTo(wall.x1 + padding, wall.y1 + padding);
                ctx.lineTo(wall.x2 + padding, wall.y2 + padding);
                ctx.strokeStyle = mat.color;
                ctx.lineWidth = Math.max(4, mat.thickness * 2);
                ctx.lineCap = 'round';
                ctx.stroke();
              }

              // Draw APs
              for (const ap of accessPoints) {
                ctx.beginPath();
                ctx.arc(ap.x + padding, ap.y + padding, 28, 0, Math.PI * 2);
                ctx.fillStyle = '#1565c0';
                ctx.fill();
                ctx.strokeStyle = '#fff';
                ctx.lineWidth = 2;
                ctx.stroke();
                ctx.fillStyle = '#fff';
                ctx.font = 'bold 16px sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText(ap.name, ap.x + padding, ap.y + padding + 6);
                // no subtitle
              }

              // Header
              ctx.fillStyle = '#fff';
              ctx.font = 'bold 18px sans-serif';
              ctx.textAlign = 'left';
              ctx.fillText(`${currentFloor.name} — Wifi Planner by Marcone`, padding, 26);
              ctx.font = '12px sans-serif';
              ctx.fillStyle = '#aaa';
              const info = [];
              if (pixelsPerMeter > 0) info.push(`Scala: ${pixelsPerMeter.toFixed(1)} px/m`);
              if (showHeatmap) info.push(`Freq: ${selectedFrequency} GHz`);
              info.push(`AP: ${accessPoints.length}`);
              info.push(`Muri: ${walls.length}`);
              info.push(new Date().toLocaleDateString('it-IT'));
              ctx.fillText(info.join('  |  '), padding, 26 + 16);

              // Generate PDF
              const landscape = imgW > imgH;
              const pdf = new jsPDF({ orientation: landscape ? 'landscape' : 'portrait', unit: 'mm', format: 'a4' });
              const pageW = pdf.internal.pageSize.getWidth();
              const pageH = pdf.internal.pageSize.getHeight();
              const margin = 10;
              const availW = pageW - margin * 2;
              const availH = pageH - margin * 2;
              const ratio = Math.min(availW / exportCanvas.width, availH / exportCanvas.height);
              const pdfW = exportCanvas.width * ratio;
              const pdfH = exportCanvas.height * ratio;
              const x = (pageW - pdfW) / 2;
              const y = (pageH - pdfH) / 2;

              const dataUrl = exportCanvas.toDataURL('image/jpeg', 0.92);
              pdf.addImage(dataUrl, 'JPEG', x, y, pdfW, pdfH);
              const baseName = currentFloor.original_filename
                ? currentFloor.original_filename.replace(/\.[^.]+$/, '')
                : currentFloor.name;
              const fileName = `${baseName}.pdf`;

              const blob = pdf.output('blob');
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = fileName;
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
              setTimeout(() => URL.revokeObjectURL(url), 1000);
            } catch (err) {
              console.error('PDF export failed:', err);
            }
          }}
          style={{
            position: 'absolute', top: 12, right: 70,
            background: '#1565c0', color: '#fff', border: 'none', borderRadius: 6,
            padding: '8px 14px', fontSize: 13, cursor: 'pointer', fontWeight: 600,
            zIndex: 20, display: 'flex', alignItems: 'center', gap: 6,
          }}
        >
          PDF
        </button>
      )}

      {/* Scale bar in meters (bottom-right, like Omada) */}
      {pixelsPerMeter > 0 && (
        <div style={{
          position: 'absolute', bottom: 16, right: 16,
          background: 'rgba(0,0,0,0.8)', borderRadius: 6, padding: '6px 12px',
          display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#ccc',
          zIndex: 20,
        }}>
          <span style={{ opacity: 0.6 }}>Scala:</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{ width: Math.round(pixelsPerMeter * scale * 5), height: 3, background: '#fff', borderRadius: 2, minWidth: 30, maxWidth: 120 }} />
            <span style={{ fontWeight: 600 }}>{(5).toFixed(0)}m</span>
          </div>
        </div>
      )}
    </div>
  );
}
