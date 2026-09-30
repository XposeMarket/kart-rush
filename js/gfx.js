import * as THREE from './vendor/three.module.js';
import { EffectComposer } from './vendor/addons/postprocessing/EffectComposer.js';
import { RenderPass } from './vendor/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from './vendor/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from './vendor/addons/postprocessing/ShaderPass.js';
import { RoomEnvironment } from './vendor/addons/environments/RoomEnvironment.js';

// Post-processing: render -> bloom -> one combined grade pass that also does ACES tone mapping and
// sRGB output (saves a full-screen pass vs a separate OutputPass).
// Quality levels: low (no post), med (post, lighter bloom, fewer samples), high.
// Adaptive: frame time is watched while racing; resolution drops first, then the level.
const GradeShader = {
  uniforms: {
    tDiffuse: { value: null }, time: { value: 0 }, speed: { value: 0 }, boost: { value: 0 },
    sat: { value: 1.18 }, contrast: { value: 1.06 }, vignette: { value: 0.32 }, tint: { value: new THREE.Color('#ffffff') }, aspect: { value: 1 }
  },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }',
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float time, speed, boost, sat, contrast, vignette, aspect; uniform vec3 tint; varying vec2 vUv;
    float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    void main(){
      vec2 c = vUv - 0.5; float r = length(c * vec2(aspect, 1.0));
      vec4 col = texture2D(tDiffuse, vUv);
      float zb = boost * 0.018 * smoothstep(0.25, 0.8, r);
      if (zb > 0.0001) { vec4 acc = col; for (int i = 1; i < 4; i++) acc += texture2D(tDiffuse, vUv - c * zb * float(i)); col = acc / 4.0; }
      vec3 rgb = col.rgb * tint;
      float l = dot(rgb, vec3(0.2126, 0.7152, 0.0722));
      rgb = mix(vec3(l), rgb, sat);
      rgb = (rgb - 0.18) * contrast + 0.18;
      float a = atan(c.y, c.x); float band = floor(a * 38.0);
      float h = hash(vec2(band, floor(time * 14.0)));
      rgb += vec3(step(0.82, h) * smoothstep(0.35, 0.75, r) * speed * 0.35);
      rgb *= 1.0 - vignette * smoothstep(0.35, 0.95, r);
      gl_FragColor = vec4(max(rgb, 0.0), 1.0);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`
};

const LEVELS = ['low', 'med', 'high'];
export function detectQuality(isTouch) {
  const q = new URLSearchParams(location.search).get('q') || localStorage.getItem('kr-q');
  if (LEVELS.includes(q)) return { level: q, auto: false };
  return { level: isTouch ? 'med' : 'high', auto: true };
}
export function saveQuality(q) { if (q === 'auto') localStorage.removeItem('kr-q'); else localStorage.setItem('kr-q', q); }

export function createGfx(renderer, isTouch) {
  const pick = detectQuality(isTouch);
  let quality = pick.level, auto = pick.auto;
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  // Base render scale per level (device pixels per CSS pixel); adaptive scale multiplies this.
  const baseRatio = () => quality === 'high' ? Math.min(dpr, isTouch ? 1.5 : 1.75) : quality === 'med' ? Math.min(dpr, isTouch ? 1.15 : 1.25) : Math.min(dpr, 1);
  let scale = 1, W = innerWidth, H = innerHeight, theme = 'meadow', sun = null;
  let composer = null, bloom = null, grade = null, renderPass = null, rt = null;
  const looks = {
    meadow: { sat: 1.2, contrast: 1.06, vignette: 0.28, bloom: 0.35, threshold: 0.9, tint: '#fff8ec' },
    snow: { sat: 1.22, contrast: 1.12, vignette: 0.3, bloom: 0.12, threshold: 1.0, tint: '#e9f1ff' },
    lava: { sat: 1.2, contrast: 1.08, vignette: 0.4, bloom: 0.6, threshold: 0.85, tint: '#fff0e6' },
    rainbow: { sat: 1.25, contrast: 1.06, vignette: 0.38, bloom: 0.55, threshold: 0.88, tint: '#ffffff' }
  };

  function build() {
    if (composer) { composer.dispose(); rt.dispose(); bloom.dispose(); composer = bloom = grade = renderPass = rt = null; }
    if (quality !== 'low') {
      rt = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: quality === 'high' ? 4 : 2 });
      composer = new EffectComposer(renderer, rt);
      renderPass = new RenderPass(new THREE.Scene(), new THREE.PerspectiveCamera());
      composer.addPass(renderPass);
      bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.4, 0.3, 0.88);
      composer.addPass(bloom);
      grade = new ShaderPass(GradeShader); composer.addPass(grade);
    }
    applyShadows(); applyLook(); applySize();
  }
  function applySize() {
    const pr = Math.max(0.5, baseRatio() * scale);
    renderer.setPixelRatio(pr); renderer.setSize(W, H, false);
    if (composer) { composer.setPixelRatio(pr); composer.setSize(W, H); grade.uniforms.aspect.value = W / H; }
  }
  function applyShadows() {
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = quality === 'high' ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
    if (sun) {
      const size = quality === 'high' ? 2048 : quality === 'med' ? 1024 : 512;
      if (sun.shadow.mapSize.x !== size) { sun.shadow.mapSize.set(size, size); if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; } }
    }
  }
  function applyLook() {
    const L = looks[theme] || looks.meadow;
    if (!grade) return;
    grade.uniforms.sat.value = L.sat; grade.uniforms.contrast.value = L.contrast; grade.uniforms.vignette.value = L.vignette;
    grade.uniforms.tint.value.set(L.tint); bloom.strength = L.bloom * (quality === 'med' ? 0.85 : 1); bloom.threshold = L.threshold;
  }

  // Adaptive performance: sample frame times while racing.
  let acc = 0, frames = 0, good = 0, cooldown = 2;
  function tick(ms, racing) {
    if (!auto || !racing || document.hidden || ms > 250) return;
    acc += ms; frames++;
    if (acc < 1500) return;
    const avg = acc / frames; acc = 0; frames = 0;
    if (cooldown > 0) { cooldown--; return; }
    if (avg > 21) {
      good = 0; cooldown = 1;
      if (scale > 0.72) { scale = Math.max(0.7, scale - 0.15); applySize(); }
      else if (quality !== 'low') { quality = LEVELS[LEVELS.indexOf(quality) - 1]; scale = 0.85; build(); }
    } else if (avg < 14.5 && scale < 1) {
      if (++good >= 3) { good = 0; scale = Math.min(1, scale + 0.1); applySize(); cooldown = 1; }
    } else good = 0;
  }

  build();
  return {
    envTex,
    get quality() { return quality; }, get auto() { return auto; }, get scale() { return scale; },
    get composer() { return composer; }, get bloom() { return bloom; }, get grade() { return grade; },
    setQuality(q) {
      auto = q === 'auto'; saveQuality(q);
      const next = auto ? (isTouch ? 'med' : 'high') : q;
      scale = 1; acc = frames = good = 0; cooldown = 2;
      if (next !== quality) { quality = next; build(); } else applySize();
    },
    attachSun(light) { sun = light; applyShadows(); },
    setTheme(t) { theme = t; applyLook(); },
    resize(w, h) { W = w; H = h; applySize(); },
    tick,
    render(scene, camera, t, speedK, boostK) {
      if (!composer) { renderer.render(scene, camera); return; }
      renderPass.scene = scene; renderPass.camera = camera;
      grade.uniforms.time.value = t;
      grade.uniforms.speed.value += (speedK - grade.uniforms.speed.value) * 0.1;
      grade.uniforms.boost.value += (boostK - grade.uniforms.boost.value) * 0.12;
      composer.render();
    }
  };
}
