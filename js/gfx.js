import * as THREE from './vendor/three.module.js';
import { EffectComposer } from './vendor/addons/postprocessing/EffectComposer.js';
import { RenderPass } from './vendor/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from './vendor/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from './vendor/addons/postprocessing/ShaderPass.js';
import { OutputPass } from './vendor/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from './vendor/addons/environments/RoomEnvironment.js';

// Post-processing stack: bloom -> grade (saturation, contrast, vignette, speed lines, boost tint) -> tone map.
// Quality: ?q=low|med|high overrides; phones default to med.
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
      // Radial zoom blur at the edges when boosting.
      vec4 col = texture2D(tDiffuse, vUv);
      float zb = boost * 0.018 * smoothstep(0.25, 0.8, r);
      if (zb > 0.0001) { vec4 acc = col; for (int i = 1; i < 5; i++) acc += texture2D(tDiffuse, vUv - c * zb * float(i)); col = acc / 5.0; }
      vec3 rgb = col.rgb * tint;
      float l = dot(rgb, vec3(0.2126, 0.7152, 0.0722));
      rgb = mix(vec3(l), rgb, sat);
      rgb = (rgb - 0.18) * contrast + 0.18;
      // Anime speed lines streaking from the center.
      float a = atan(c.y, c.x); float band = floor(a * 38.0);
      float h = hash(vec2(band, floor(time * 14.0)));
      float line = step(0.82, h) * smoothstep(0.35, 0.75, r) * speed;
      rgb += vec3(line * 0.35);
      rgb *= 1.0 - vignette * smoothstep(0.35, 0.95, r);
      gl_FragColor = vec4(max(rgb, 0.0), col.a);
    }`
};

export function detectQuality(isTouch) {
  const q = new URLSearchParams(location.search).get('q');
  if (q === 'low' || q === 'med' || q === 'high') return q;
  return isTouch ? 'med' : 'high';
}

export function createGfx(renderer, isTouch) {
  const quality = detectQuality(isTouch);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  let composer = null, bloom = null, grade = null, renderPass = null;
  if (quality !== 'low') {
    // Multisampled HDR target so post-processing keeps anti-aliased edges.
    const rt = new THREE.WebGLRenderTarget(innerWidth, innerHeight, { type: THREE.HalfFloatType, samples: quality === 'high' ? 4 : 2 });
    composer = new EffectComposer(renderer, rt);
    composer.setPixelRatio(Math.min(window.devicePixelRatio, quality === 'high' ? 1.75 : 1.25));
    renderPass = new RenderPass(new THREE.Scene(), new THREE.PerspectiveCamera());
    composer.addPass(renderPass);
    bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.4, 0.3, 0.88);
    composer.addPass(bloom);
    grade = new ShaderPass(GradeShader); composer.addPass(grade);
    composer.addPass(new OutputPass());
  }
  const looks = {
    meadow: { sat: 1.2, contrast: 1.06, vignette: 0.28, bloom: 0.35, threshold: 0.9, tint: '#fff8ec' },
    snow: { sat: 1.22, contrast: 1.12, vignette: 0.3, bloom: 0.12, threshold: 1.0, tint: '#e9f1ff' },
    lava: { sat: 1.2, contrast: 1.08, vignette: 0.4, bloom: 0.6, threshold: 0.85, tint: '#fff0e6' },
    rainbow: { sat: 1.25, contrast: 1.06, vignette: 0.38, bloom: 0.55, threshold: 0.88, tint: '#ffffff' }
  };
  return {
    quality, envTex,
    shadowSize: quality === 'high' ? 2048 : quality === 'med' ? 1024 : 512,
    setTheme(theme) {
      const L = looks[theme] || looks.meadow;
      if (!grade) return;
      grade.uniforms.sat.value = L.sat; grade.uniforms.contrast.value = L.contrast; grade.uniforms.vignette.value = L.vignette;
      grade.uniforms.tint.value.set(L.tint); bloom.strength = L.bloom; bloom.threshold = L.threshold;
    },
    resize(w, h) { if (composer) { composer.setSize(w, h); bloom.resolution.set(w / 2, h / 2); grade.uniforms.aspect.value = w / h; } },
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
