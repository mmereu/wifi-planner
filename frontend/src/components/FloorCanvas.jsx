import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Stage, Layer, Image, Line, Circle, Text } from 'react-konva';
import useStore from '../store/useStore';

function getImageUrl(floor) {
  if (!floor) return null;
  // Only use thumbnail_path (PNG) - never try to render PDF/DWG directly
  const imgPath = floor.thumbnail_path;
  if (!imgPath) return null;
  // Strip /app prefix for nginx static serving
  return imgPath.replace('/app', '');
}

export default function FloorCanvas() {
  const { currentFloor, walls, accessPoints, placeAP, processFloor, loading } = useStore();
  const containerRef = useRef();
  const [size, setSize] = useState({ width: 800, height: 600 });
  const [bgImage, setBgImage] = useState(null);
  const [imgError, setImgError] = useState(false);
  const [scale, setScale] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [placingMode, setPlacingMode] = useState(false);

  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect;
      setSize({ width, height });
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    setBgImage(null);
    setImgError(false);
    setScale(1);
    setPos({ x: 0, y: 0 });
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

  const handleWheel = (e) => {
    e.evt.preventDefault();
    const scaleBy = 1.1;
    const stage = e.target.getStage();
    const oldScale = stage.scaleX();
    const pointer = stage.getPointerPosition();
    const mousePointTo = {
      x: (pointer.x - stage.x()) / oldScale,
      y: (pointer.y - stage.y()) / oldScale,
    };
    const newScale = e.evt.deltaY > 0 ? oldScale / scaleBy : oldScale * scaleBy;
    setScale(newScale);
    setPos({
      x: pointer.x - mousePointTo.x * newScale,
      y: pointer.y - mousePointTo.y * newScale,
    });
  };

  const handleCanvasClick = useCallback(async (e) => {
    if (!placingMode || !currentFloor) return;
    const stage = e.target.getStage();
    const pointer = stage.getPointerPosition();
    const x = (pointer.x - pos.x) / scale;
    const y = (pointer.y - pos.y) / scale;
    const name = prompt('Nome AP (es. AP-01):') || ('AP-' + (accessPoints.length + 1));
    await placeAP(x, y, name);
    setPlacingMode(false);
  }, [placingMode, currentFloor, pos, scale, accessPoints.length, placeAP]);

  if (!currentFloor) {
    return (
      <div ref={containerRef} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#555', background: '#1a1a2e' }}>
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: 20, marginBottom: 8, color: '#4a9eff' }}>Nessun piano selezionato</p>
          <p style={{ fontSize: 14 }}>Carica un piano dalla sidebar</p>
        </div>
      </div>
    );
  }

  const hasNoThumbnail = !currentFloor.thumbnail_path;

  return (
    <div ref={containerRef} style={{ flex: 1, position: 'relative', overflow: 'hidden', background: '#1a1a2e' }}>
      {hasNoThumbnail && (
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
          justifyContent: 'center', flexDirection: 'column', gap: 16, zIndex: 5
        }}>
          <p style={{ color: '#aaa', fontSize: 16 }}>
            Piano: <strong style={{ color: '#fff' }}>{currentFloor.name}</strong>
          </p>
          <p style={{ color: '#777', fontSize: 13 }}>Clicca per elaborare e visualizzare la pianta</p>
          <button
            onClick={processFloor}
            disabled={loading}
            style={{ background: '#27ae60', color: '#fff', padding: '12px 24px', fontSize: 15, borderRadius: 8, border: 'none', cursor: 'pointer' }}
          >
            {loading ? 'Elaborazione...' : 'Riconosci Muri e Visualizza'}
          </button>
        </div>
      )}

      {imgError && (
        <div style={{ position: 'absolute', top: 10, left: '50%', transform: 'translateX(-50%)', zIndex: 20, background: '#e74c3c', color: '#fff', borderRadius: 8, padding: '8px 16px', fontSize: 13 }}>
          Errore immagine — riprova a processare il piano
        </div>
      )}

      <div style={{ position: 'absolute', top: 10, right: 10, zIndex: 10, display: 'flex', gap: 6 }}>
        <button
          onClick={() => setPlacingMode(!placingMode)}
          style={{ background: placingMode ? '#f39c12' : '#2c3e50', color: '#fff', fontSize: 12, padding: '6px 12px', border: 'none', borderRadius: 6, cursor: 'pointer' }}
        >
          {placingMode ? 'Click canvas per AP...' : '+ Piazza AP'}
        </button>
        <button
          onClick={() => { setScale(1); setPos({ x: 0, y: 0 }); }}
          style={{ background: '#2c3e50', color: '#ccc', fontSize: 12, padding: '6px 10px', border: 'none', borderRadius: 6, cursor: 'pointer' }}
        >Reset</button>
      </div>

      <Stage
        width={size.width}
        height={size.height}
        scaleX={scale}
        scaleY={scale}
        x={pos.x}
        y={pos.y}
        onWheel={handleWheel}
        draggable={!placingMode}
        onDragEnd={e => setPos({ x: e.target.x(), y: e.target.y() })}
        onClick={handleCanvasClick}
        style={{ cursor: placingMode ? 'crosshair' : 'grab' }}
      >
        <Layer>
          {bgImage && <Image image={bgImage} />}
          {walls.map((wall, i) => (
            <Line key={i} points={[wall.x1, wall.y1, wall.x2, wall.y2]}
              stroke="#e74c3c" strokeWidth={Math.max(1, wall.thickness || 2)} opacity={0.85} />
          ))}
          {accessPoints.map(ap => (
            <React.Fragment key={ap.id}>
              <Circle x={ap.x} y={ap.y} radius={12} fill="#4a9eff" opacity={0.9} />
              <Text x={ap.x - 20} y={ap.y + 15} text={ap.name} fontSize={10} fill="#fff" width={40} align="center" />
            </React.Fragment>
          ))}
        </Layer>
      </Stage>

      <div style={{ position: 'absolute', bottom: 10, left: 10, background: 'rgba(0,0,0,0.7)', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#ccc' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
          <div style={{ width: 20, height: 3, background: '#e74c3c' }}></div>
          <span>Muri ({walls.length})</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#4a9eff' }}></div>
          <span>AP ({accessPoints.length})</span>
        </div>
      </div>
    </div>
  );
}
