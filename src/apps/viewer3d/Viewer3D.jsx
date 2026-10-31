/**
 * 3D Viewer: .glb/.gltf models from content/media.json (or a local file
 * dropped in), orbit controls, turntable, wireframe, lighting presets,
 * background colour, fullscreen, and a gallery of renders.
 */
import { Component, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { Bounds, ContactShadows, Environment, Html, Lightformer, OrbitControls, useBounds, useGLTF } from '@react-three/drei';
import { Box, RotateCw, Grid3x3, Maximize, RefreshCcw, Upload, Images, AlertTriangle } from 'lucide-react';
import { useData } from '@/data/store.js';
import Spinner from '@/os/ui/Spinner.jsx';
import { Button, Chip, EmptyState, Tabs } from '../kit/ui.jsx';
import PlaceholderModel from './PlaceholderModel.jsx';

const LIGHTING = {
  studio: { label: 'Studio', ambient: 0.5, key: ['#ffffff', 2.2], fill: '#cfe3ff', forms: ['#ffffff', '#ffffff'] },
  sunset: { label: 'Sunset', ambient: 0.35, key: ['#ffb36b', 2.4], fill: '#7a5cff', forms: ['#ff9a5a', '#5a3cff'] },
  night: { label: 'Night', ambient: 0.15, key: ['#8fb4ff', 1.4], fill: '#1b2a7a', forms: ['#3355ff', '#0b1020'] },
  neon: { label: 'Neon', ambient: 0.25, key: ['#ff4fd8', 2], fill: '#00e5ff', forms: ['#ff4fd8', '#00e5ff'] },
};
const BACKGROUNDS = ['#1b1d24', '#f2f2f2', '#0c2340', '#2b1d3a', '#10251c'];

/** Local, offline environment for reflections (no HDRI download). */
function Lighting({ preset }) {
  const l = LIGHTING[preset];
  return (
    <>
      <ambientLight intensity={l.ambient} />
      <directionalLight position={[4, 6, 3]} color={l.key[0]} intensity={l.key[1]} castShadow shadow-mapSize={[1024, 1024]} />
      <directionalLight position={[-5, 2, -3]} color={l.fill} intensity={0.8} />
      <Environment resolution={128}>
        <Lightformer form="rect" intensity={2} color={l.forms[0]} position={[0, 4, -6]} scale={[10, 4, 1]} />
        <Lightformer form="rect" intensity={1} color={l.forms[1]} position={[-6, 1, 2]} rotation-y={Math.PI / 2} scale={[6, 4, 1]} />
        <Lightformer form="ring" intensity={1.5} color="#ffffff" position={[5, 3, 3]} scale={2} />
      </Environment>
    </>
  );
}

function GltfModel({ url, wireframe }) {
  const { scene } = useGLTF(url);
  // Clone so toggling wireframe doesn't mutate the cached original.
  const clone = useMemo(() => scene.clone(true), [scene]);
  useEffect(() => {
    clone.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
        for (const m of [].concat(o.material)) if (m) m.wireframe = wireframe;
      }
    });
  }, [clone, wireframe]);
  return <primitive object={clone} />;
}

/** Re-frames the camera when the model or the reset counter changes. */
function FitOnChange({ token }) {
  const bounds = useBounds();
  useEffect(() => {
    const t = setTimeout(() => bounds.refresh().clip().fit(), 50);
    return () => clearTimeout(t);
  }, [bounds, token]);
  return null;
}

class ModelErrorBoundary extends Component {
  state = { error: null };
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidUpdate(prev) {
    if (prev.resetKey !== this.props.resetKey && this.state.error) this.setState({ error: null });
  }
  render() {
    if (this.state.error) {
      return (
        <Html center>
          <div className="flex w-64 flex-col items-center gap-2 rounded-lg bg-black/70 p-4 text-center text-xs text-white">
            <AlertTriangle size={20} className="text-amber-400" />
            This model couldn't be loaded. Use a .glb, or a .gltf with its textures embedded.
          </div>
        </Html>
      );
    }
    return this.props.children;
  }
}

function Scene({ model, wireframe, autoRotate, lighting, bg, resetToken }) {
  return (
    <Canvas shadows dpr={[1, 2]} camera={{ position: [3.5, 2.5, 4.5], fov: 45 }} gl={{ preserveDrawingBuffer: true }}>
      <color attach="background" args={[bg]} />
      <Lighting preset={lighting} />
      <ModelErrorBoundary resetKey={model.key}>
        <Suspense
          fallback={
            <Html center>
              <Spinner size={32} color="#ffffff" label="Loading model" />
            </Html>
          }
        >
          <Bounds fit clip margin={1.15}>
            <FitOnChange token={`${model.key}:${resetToken}`} />
            {model.url ? <GltfModel url={model.url} wireframe={wireframe} /> : <PlaceholderModel wireframe={wireframe} />}
          </Bounds>
        </Suspense>
      </ModelErrorBoundary>
      <ContactShadows position={[0, -0.62, 0]} opacity={0.45} scale={12} blur={2.4} far={4} />
      <OrbitControls makeDefault autoRotate={autoRotate} autoRotateSpeed={1.2} enableDamping />
    </Canvas>
  );
}

const SAMPLE = { key: 'sample', title: 'Sample: desk setup', description: 'Built-in placeholder. Add your own .glb models in content/media.json.', url: null };

export default function Viewer3D() {
  const media = useData((s) => s.media);
  const models = useMemo(() => [...media.models.filter((m) => !m.hidden).map((m) => ({ ...m, key: m.id, url: m.src })), SAMPLE], [media.models]);
  const renders = media.renders.filter((r) => !r.hidden);
  const [tab, setTab] = useState('models');
  const [local, setLocal] = useState(null); // dropped/opened file, preview only
  const [selected, setSelected] = useState(models[0].key);
  const [wireframe, setWireframe] = useState(false);
  const [autoRotate, setAutoRotate] = useState(true);
  const [lighting, setLighting] = useState('studio');
  const [bg, setBg] = useState(BACKGROUNDS[0]);
  const [resetToken, setResetToken] = useState(0);
  const [dragging, setDragging] = useState(false);
  const stageRef = useRef(null);
  const fileRef = useRef(null);

  const all = local ? [local, ...models] : models;
  const model = all.find((m) => m.key === selected) ?? all[0];

  useEffect(() => () => local && URL.revokeObjectURL(local.url), [local]);

  const openFile = (file) => {
    if (!file || !/\.(glb|gltf)$/i.test(file.name)) return;
    const url = URL.createObjectURL(file);
    setLocal({ key: `local:${file.name}:${Date.now()}`, title: file.name, description: 'Local file, only visible to you.', url });
    setTab('models');
  };
  useEffect(() => {
    if (local) setSelected(local.key);
  }, [local]);

  const fullscreen = () => {
    const el = stageRef.current;
    if (document.fullscreenElement) document.exitFullscreen();
    else el?.requestFullscreen?.();
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-[var(--border)] px-3 py-1.5">
        <Tabs value={tab} onChange={setTab} tabs={[{ id: 'models', label: 'Models', icon: Box }, { id: 'renders', label: `Renders${renders.length ? ` (${renders.length})` : ''}`, icon: Images }]} />
        {tab === 'models' && (
          <div className="ml-auto flex flex-wrap items-center gap-1.5">
            <Chip active={autoRotate} onClick={() => setAutoRotate((v) => !v)}><RotateCw size={12} /> Turntable</Chip>
            <Chip active={wireframe} onClick={() => setWireframe((v) => !v)}><Grid3x3 size={12} /> Wireframe</Chip>
            <select value={lighting} onChange={(e) => setLighting(e.target.value)} aria-label="Lighting" className="h-7 rounded-md border border-[var(--border)] bg-[var(--surface-solid)] px-2 text-xs">
              {Object.entries(LIGHTING).map(([k, v]) => <option key={k} value={k}>{v.label} lighting</option>)}
            </select>
            <div className="flex items-center gap-1" role="radiogroup" aria-label="Background colour">
              {BACKGROUNDS.map((c) => (
                <button key={c} role="radio" aria-checked={bg === c} aria-label={`Background ${c}`} onClick={() => setBg(c)} className="h-5 w-5 rounded-full border border-[var(--border-strong)]" style={{ background: c, boxShadow: bg === c ? '0 0 0 2px var(--accent)' : undefined }} />
              ))}
              <input type="color" value={bg} onChange={(e) => setBg(e.target.value)} aria-label="Custom background" className="h-5 w-6 cursor-pointer border-0 bg-transparent p-0" />
            </div>
            <Button variant="ghost" icon={RefreshCcw} onClick={() => setResetToken((t) => t + 1)} title="Reset view" aria-label="Reset view" />
            <Button variant="ghost" icon={Maximize} onClick={fullscreen} title="Fullscreen" aria-label="Fullscreen" />
          </div>
        )}
      </div>

      {tab === 'models' ? (
        <div className="flex min-h-0 flex-1">
          <aside className="hidden w-52 shrink-0 flex-col gap-1 overflow-y-auto border-r border-[var(--border)] p-2 md:flex">
            {all.map((m) => (
              <button key={m.key} onClick={() => setSelected(m.key)} aria-current={model.key === m.key ? 'true' : undefined} className={`rounded-md p-2 text-left hover:bg-[var(--surface-hover)] ${model.key === m.key ? 'bg-[var(--surface-hover)]' : ''}`}>
                {m.poster && <img src={m.poster} alt="" className="mb-1.5 aspect-video w-full rounded object-cover" />}
                <p className="truncate text-[13px] font-medium">{m.title}</p>
                {m.description && <p className="line-clamp-2 text-[11px] text-[var(--text-dim)]">{m.description}</p>}
              </button>
            ))}
            <Button icon={Upload} className="mt-2" onClick={() => fileRef.current?.click()}>Open .glb file</Button>
            <input ref={fileRef} type="file" accept=".glb,.gltf,model/gltf-binary,model/gltf+json" className="hidden" onChange={(e) => openFile(e.target.files?.[0])} />
            <p className="px-1 text-[11px] text-[var(--text-dim)]">Or drop a .glb onto the viewer. Local files stay on your device.</p>
          </aside>
          <div
            ref={stageRef}
            className="relative min-w-0 flex-1"
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              openFile(e.dataTransfer.files?.[0]);
            }}
          >
            <Scene model={model} wireframe={wireframe} autoRotate={autoRotate} lighting={lighting} bg={bg} resetToken={resetToken} />
            <div className="pointer-events-none absolute bottom-3 left-3 rounded-md bg-black/45 px-2.5 py-1.5 text-xs text-white backdrop-blur">
              <p className="font-semibold">{model.title}</p>
              <p className="text-white/70">Drag to orbit · scroll to zoom · right-drag to pan</p>
            </div>
            {dragging && <div className="absolute inset-3 flex items-center justify-center rounded-lg border-2 border-dashed border-white/70 bg-black/40 text-sm text-white">Drop a .glb to preview it</div>}
          </div>
        </div>
      ) : renders.length === 0 ? (
        <EmptyState icon={Images} title="No renders yet">Add images to content/media.json → renders.</EmptyState>
      ) : (
        <div className="grid flex-1 grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3 overflow-y-auto p-4">
          {renders.map((r) => (
            <figure key={r.id} className="overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface-solid)]">
              <img src={r.src} alt={r.title} loading="lazy" className="aspect-video w-full object-cover" />
              <figcaption className="p-2 text-xs">{r.title}</figcaption>
            </figure>
          ))}
        </div>
      )}
    </div>
  );
}
