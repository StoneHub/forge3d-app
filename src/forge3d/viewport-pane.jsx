import { useState } from 'react';
import Icons from './icons.jsx';
import {
  BACKGROUND_PRESETS,
  DEFAULT_RENDER_APPEARANCE,
  MATERIAL_SWATCHES,
  RENDER_APPEARANCE_CONTROLS,
  getViewportBackgroundGradient,
  normalizeRenderAppearance,
} from './render-appearance.js';

export default function ViewportPane({
  buildElapsedMs = 0,
  buildStatusText = '',
  building = false,
  canvasRef,
  colors,
  minViewportWidth,
  mode = 'design',
  onCaptureRender,
  selectedAssemblyPart,
  setViewSettings,
  viewSettings,
}) {
  const [appearanceOpen, setAppearanceOpen] = useState(false);
  const appearance = normalizeRenderAppearance(viewSettings.appearance);
  const viewportBackground = getViewportBackgroundGradient(colors, appearance.background);
  const buttonStyle = (active) => ({
    background: active ? `${colors.accent}33` : `${colors.bgDarker}cc`,
    border: `1px solid ${active ? colors.accent : colors.border}`,
    color: active ? colors.accent : colors.textMuted,
    padding: '5px 8px',
    borderRadius: '5px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    fontSize: '11px',
    fontWeight: 700,
    backdropFilter: 'blur(8px)',
  });
  const formatElapsed = (ms) => {
    const totalSeconds = Math.max(0, Math.floor((ms || 0) / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return minutes > 0
      ? `${minutes}m ${String(seconds).padStart(2, '0')}s`
      : `${seconds}s`;
  };
  const updateAppearance = (patch) => {
    setViewSettings((settings) => ({
      ...settings,
      appearance: normalizeRenderAppearance({ ...settings.appearance, ...patch }),
    }));
  };
  const labelStyle = {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '12px',
    color: colors.textMuted,
    fontSize: '11px',
    fontWeight: 800,
  };
  const rangeStyle = {
    width: '100%',
    accentColor: colors.accent,
  };
  const presetButtonStyle = (active) => ({
    border: `1px solid ${active ? colors.accent : colors.border}`,
    background: active ? `${colors.accent}22` : colors.bgDarker,
    color: active ? colors.accent : colors.textMuted,
    borderRadius: '7px',
    padding: '6px 8px',
    fontSize: '11px',
    fontWeight: 800,
    cursor: 'pointer',
  });

  return (
    <div style={{ flex: 1, minWidth: minViewportWidth, display: 'flex', flexDirection: 'column', position: 'relative', background: viewportBackground }}>
      <style>{`
        @keyframes forge-loader-rotate {
          0% { transform: rotateX(18deg) rotateY(0deg) rotateZ(0deg) scale(0.96); }
          50% { transform: rotateX(28deg) rotateY(180deg) rotateZ(8deg) scale(1.03); }
          100% { transform: rotateX(18deg) rotateY(360deg) rotateZ(0deg) scale(0.96); }
        }
        @keyframes forge-loader-pulse {
          0%, 100% { opacity: 0.32; transform: scale(0.92); }
          50% { opacity: 0.72; transform: scale(1.08); }
        }
        @keyframes forge-loader-drift {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-8px); }
        }
      `}</style>
      <div style={{ position: 'absolute', top: '10px', left: '10px', zIndex: 10, display: 'flex', gap: '4px' }}>
        {[
          { icon: Icons.Grid, key: 'grid', label: 'Grid' },
          { icon: Icons.Layers, key: 'axes', label: 'Axes' },
          { icon: Icons.Eye, key: 'wireframe', label: 'Edges' },
          { icon: Icons.Ruler, key: 'dimensions', label: 'Dimensions' }
        ].map(({ icon: Icon, key, label }) => (
          <button key={key} title={label} onClick={() => setViewSettings(settings => ({ ...settings, [key]: !settings[key] }))} style={buttonStyle(viewSettings[key])}><Icon /></button>
        ))}
        <button title="Capture Render" onClick={() => onCaptureRender?.()} style={buttonStyle(false)}><Icons.Camera /></button>
        <button title="Render Appearance" onClick={() => setAppearanceOpen((open) => !open)} style={buttonStyle(appearanceOpen)}><Icons.Sliders /></button>
      </div>

      {appearanceOpen && (
        <div
          style={{
            position: 'absolute',
            top: '46px',
            left: '10px',
            zIndex: 12,
            width: '250px',
            background: colors.surfaceOverlay || `${colors.bg}f2`,
            border: `1px solid ${colors.borderHover}`,
            borderRadius: '8px',
            boxShadow: colors.viewportAppearanceShadow,
            backdropFilter: 'blur(14px)',
            padding: '12px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
            <div style={{ color: colors.textSoft, fontSize: '12px', fontWeight: 900 }}>Render look</div>
            <button
              type="button"
              onClick={() => updateAppearance(DEFAULT_RENDER_APPEARANCE)}
              style={{ border: `1px solid ${colors.border}`, background: colors.bgDarker, color: colors.textMuted, borderRadius: '7px', padding: '5px 7px', fontSize: '10px', fontWeight: 800, cursor: 'pointer' }}
            >
              Reset
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '6px' }}>
            {BACKGROUND_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => updateAppearance({ background: preset.id })}
                style={presetButtonStyle(appearance.background === preset.id)}
              >
                {preset.label}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', gap: '7px', alignItems: 'center' }}>
            {MATERIAL_SWATCHES.map((swatch) => (
              <button
                key={swatch.id}
                type="button"
                title={swatch.label}
                onClick={() => updateAppearance({ material: swatch.id })}
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '999px',
                  border: `2px solid ${appearance.material === swatch.id ? colors.accent : colors.border}`,
                  background: swatch.color,
                  cursor: 'pointer',
                  boxShadow: appearance.material === swatch.id ? `0 0 0 2px ${colors.accent}22` : 'none',
                }}
              />
            ))}
          </div>

          {RENDER_APPEARANCE_CONTROLS.map((control) => (
            <label key={control.key} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <span style={labelStyle}>
                <span>{control.label}</span>
                <span>{Math.round(appearance[control.key] * 100)}%</span>
              </span>
              <input
                type="range"
                min={control.min}
                max={control.max}
                step={control.step}
                value={appearance[control.key]}
                onChange={(event) => updateAppearance({ [control.key]: Number(event.target.value) })}
                style={rangeStyle}
              />
            </label>
          ))}
        </div>
      )}

      <div style={{ position: 'absolute', bottom: '10px', left: '10px', zIndex: 10, background: colors.surfaceOverlay || `${colors.bg}dd`, borderRadius: '10px', padding: '8px 11px', fontSize: '11px', color: colors.textMuted, fontWeight: 700, backdropFilter: 'blur(10px)', border: `1px solid ${colors.borderHover}`, boxShadow: colors.viewportHudShadow, display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
        {mode === 'assembly' ? (
          <>
            <span>Orbit: LMB</span><span>Pan: RMB</span><span>Move: Amber handle</span><span>Rotate: Amber ring</span><span>Undo: Ctrl+Z</span><span>{selectedAssemblyPart ? `Selected: ${selectedAssemblyPart.name}` : 'Select a part to edit'}</span>
          </>
        ) : (
          <>
            <span>Orbit: LMB</span><span>Build: Shift+Enter</span><span>Undo: Ctrl+Z</span><span>Redo: Ctrl+Y</span><span>Zoom: Ctrl+= / - / 0</span>
          </>
        )}
      </div>

      {building && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 9,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none',
            background: colors.viewportBuildingOverlay,
          }}
        >
          <div
            style={{
              position: 'relative',
              width: '220px',
              height: '220px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              animation: 'forge-loader-drift 2.6s ease-in-out infinite',
            }}
          >
            <div
              style={{
                position: 'absolute',
                width: '140px',
                height: '140px',
                borderRadius: '50%',
                background: `radial-gradient(circle, ${colors.accent}3d, transparent 68%)`,
                animation: 'forge-loader-pulse 1.9s ease-in-out infinite',
                filter: 'blur(2px)',
              }}
            />
            <div
              style={{
                position: 'relative',
                width: '108px',
                height: '108px',
                transformStyle: 'preserve-3d',
                animation: 'forge-loader-rotate 2.8s linear infinite',
              }}
            >
              {[
                { transform: 'translateZ(34px)' },
                { transform: 'translateZ(-34px)' },
                { transform: 'rotateY(90deg) translateZ(34px)' },
                { transform: 'rotateY(90deg) translateZ(-34px)' },
                { transform: 'rotateX(90deg) translateZ(34px)' },
                { transform: 'rotateX(90deg) translateZ(-34px)' },
              ].map((face, index) => (
                <div
                  key={index}
                  style={{
                    position: 'absolute',
                    inset: '18px',
                    border: `2px solid ${index % 2 === 0 ? colors.accent : colors.textSoft}`,
                    background: index % 2 === 0 ? `${colors.accent}12` : 'transparent',
                    boxShadow: index % 2 === 0 ? `0 0 18px ${colors.accent}22 inset` : 'none',
                    ...face,
                  }}
                />
              ))}
            </div>
            <div
              style={{
                position: 'absolute',
                bottom: '-8px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '4px',
                textAlign: 'center',
              }}
            >
              <div style={{ color: colors.textSoft, fontSize: '13px', fontWeight: 800, letterSpacing: '0.25px' }}>
                {buildStatusText || 'Forging geometry...'}
              </div>
              <div style={{ color: colors.textMuted, fontSize: '11px', fontWeight: 700 }}>
                {formatElapsed(buildElapsedMs)}
              </div>
            </div>
          </div>
        </div>
      )}

      <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
    </div>
  );
}
