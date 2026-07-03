import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import styles from './index.module.css';

const vertexShader = `
varying vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

const fragmentShader = `
precision highp float;

uniform vec3 iResolution;
uniform float iTime;
uniform vec2 uSkew;
uniform float uLineThickness;
uniform vec3 uLinesColor;
uniform vec3 uScanColor;
uniform float uGridScale;
uniform float uLineJitter;
uniform float uScanOpacity;
uniform float uNoise;
uniform float uBloomOpacity;
uniform float uScanGlow;
uniform float uScanSoftness;
uniform float uScanDuration;
uniform float uScanDelay;
varying vec2 vUv;

float smoother01(float a, float b, float x) {
  float t = clamp((x - a) / max(1e-5, (b - a)), 0.0, 1.0);
  return t * t * t * (t * (t * 6.0 - 15.0) + 10.0);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 p = (2.0 * fragCoord - iResolution.xy) / iResolution.y;

  vec3 ro = vec3(0.0);
  vec3 rd = normalize(vec3(p, 2.0));
  rd.xy += clamp(uSkew, vec2(-0.42), vec2(0.42)) * rd.z;

  vec3 color = vec3(0.0);
  float minT = 1e20;
  float gridScale = max(1e-5, uGridScale);
  vec2 gridUV = vec2(0.0);

  for (int i = 0; i < 4; i++) {
    float isY = float(i < 2);
    float pos = mix(-0.22, 0.22, float(i)) * isY + mix(-0.62, 0.62, float(i - 2)) * (1.0 - isY);
    float num = pos - (isY * ro.y + (1.0 - isY) * ro.x);
    float den = isY * rd.y + (1.0 - isY) * rd.x;
    float t = num / den;
    vec3 h = ro + rd * t;
    float depthBoost = smoothstep(0.0, 3.0, h.z);
    h.xy += uSkew * 0.12 * depthBoost;

    bool use = t > 0.0 && t < minT;
    gridUV = use ? mix(h.zy, h.xz, isY) / gridScale : gridUV;
    minT = use ? t : minT;
  }

  vec3 hit = ro + rd * minT;
  float dist = length(hit - ro);
  float jitterAmt = clamp(uLineJitter, 0.0, 1.0);

  if (jitterAmt > 0.0) {
    vec2 jitter = vec2(
      sin(gridUV.y * 2.7 + iTime * 1.8),
      cos(gridUV.x * 2.3 - iTime * 1.6)
    ) * (0.12 * jitterAmt);
    gridUV += jitter;
  }

  float fx = fract(gridUV.x);
  float fy = fract(gridUV.y);
  float ax = min(fx, 1.0 - fx);
  float ay = min(fy, 1.0 - fy);
  float wx = fwidth(gridUV.x);
  float wy = fwidth(gridUV.y);
  float halfPx = max(0.0, uLineThickness) * 0.5;
  float tx = halfPx * wx;
  float ty = halfPx * wy;

  float lineX = 1.0 - smoothstep(tx, tx + wx, ax);
  float lineY = 1.0 - smoothstep(ty, ty + wy, ay);
  float lineMask = max(lineX, lineY);
  float fade = exp(-dist * 1.05);

  float dur = max(0.05, uScanDuration);
  float cycle = dur + max(0.0, uScanDelay);
  float phase = clamp(mod(iTime, cycle) / dur, 0.0, 1.0);
  float pingpong = phase < 0.5 ? phase * 2.0 : 1.0 - (phase - 0.5) * 2.0;
  float scanZ = pingpong * 2.0;
  float dz = abs(hit.z - scanZ);
  float sigma = max(0.001, 0.18 * max(0.1, uScanGlow) * max(0.2, uScanSoftness));
  float lineBand = exp(-0.5 * (dz * dz) / (sigma * sigma));
  float phaseWindow = smoother01(0.0, 0.12, pingpong) * (1.0 - smoother01(0.88, 1.0, pingpong));
  float pulse = lineBand * phaseWindow * clamp(uScanOpacity, 0.0, 1.0);
  float aura = exp(-0.5 * (dz * dz) / ((sigma * 2.0) * (sigma * 2.0))) * 0.22 * phaseWindow;

  vec3 gridCol = uLinesColor * lineMask * fade;
  vec3 scanCol = uScanColor * (pulse + aura);
  color = gridCol + scanCol;

  float noise = fract(sin(dot(gl_FragCoord.xy + vec2(iTime * 123.4), vec2(12.9898, 78.233))) * 43758.5453123);
  color += (noise - 0.5) * uNoise;
  color = clamp(color, 0.0, 1.0);

  float halo = lineMask * fade * clamp(uBloomOpacity, 0.0, 1.0);
  float alpha = clamp(max(lineMask * fade, pulse + halo), 0.0, 1.0);
  fragColor = vec4(color, alpha);
}

void main() {
  vec4 color;
  mainImage(color, vUv * iResolution.xy);
  gl_FragColor = color;
}
`;

interface GridScanProps {
  sensitivity?: number;
  lineThickness?: number;
  linesColor?: string;
  gridScale?: number;
  scanColor?: string;
  scanOpacity?: number;
  bloomIntensity?: number;
  noiseIntensity?: number;
  lineJitter?: number;
  scanGlow?: number;
  scanSoftness?: number;
  scanDuration?: number;
  scanDelay?: number;
  className?: string;
}

function srgbColor(hex: string) {
  const color = new THREE.Color(hex);
  return color.convertSRGBToLinear();
}

function damp(current: number, target: number, smoothing: number) {
  return current + (target - current) * smoothing;
}

export default function GridScan({
  sensitivity = 0.55,
  lineThickness = 1,
  linesColor = '#2f6df6',
  gridScale = 0.1,
  scanColor = '#3b82f6',
  scanOpacity = 0.4,
  bloomIntensity = 0.6,
  noiseIntensity = 0.01,
  lineJitter = 0.1,
  scanGlow = 0.5,
  scanSoftness = 2,
  scanDuration = 2,
  scanDelay = 2,
  className,
}: GridScanProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const targetRef = useRef(new THREE.Vector2(0, 0));
  const currentRef = useRef(new THREE.Vector2(0, 0));

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setClearColor(0x000000, 0);
    container.appendChild(renderer.domElement);

    const uniforms = {
      iResolution: {
        value: new THREE.Vector3(
          container.clientWidth,
          container.clientHeight,
          renderer.getPixelRatio(),
        ),
      },
      iTime: { value: 0 },
      uSkew: { value: new THREE.Vector2(0, 0) },
      uLineThickness: { value: lineThickness },
      uLinesColor: { value: srgbColor(linesColor) },
      uScanColor: { value: srgbColor(scanColor) },
      uGridScale: { value: gridScale },
      uLineJitter: { value: Math.max(0, Math.min(1, lineJitter)) },
      uScanOpacity: { value: scanOpacity },
      uNoise: { value: noiseIntensity },
      uBloomOpacity: { value: bloomIntensity },
      uScanGlow: { value: scanGlow },
      uScanSoftness: { value: scanSoftness },
      uScanDuration: { value: scanDuration },
      uScanDelay: { value: scanDelay },
    };

    const material = new THREE.ShaderMaterial({
      uniforms,
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
      depthTest: false,
    });

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const geometry = new THREE.PlaneGeometry(2, 2);
    const quad = new THREE.Mesh(geometry, material);
    scene.add(quad);

    const motionStrength = THREE.MathUtils.lerp(
      0.08,
      0.34,
      THREE.MathUtils.clamp(sensitivity, 0, 1),
    );
    const smoothing = THREE.MathUtils.lerp(0.075, 0.18, THREE.MathUtils.clamp(sensitivity, 0, 1));
    let raf = 0;

    const handleMove = (event: PointerEvent) => {
      const rect = container.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -(((event.clientY - rect.top) / rect.height) * 2 - 1);
      targetRef.current.set(x, y);
    };

    const handleLeave = (event: PointerEvent) => {
      if (event.relatedTarget) return;
      targetRef.current.set(0, 0);
    };

    const handleResize = () => {
      renderer.setSize(container.clientWidth, container.clientHeight);
      material.uniforms.iResolution.value.set(
        container.clientWidth,
        container.clientHeight,
        renderer.getPixelRatio(),
      );
    };

    const tick = () => {
      currentRef.current.set(
        damp(currentRef.current.x, targetRef.current.x, smoothing),
        damp(currentRef.current.y, targetRef.current.y, smoothing),
      );
      material.uniforms.uSkew.value.set(
        currentRef.current.x * motionStrength,
        -currentRef.current.y * motionStrength * 1.2,
      );
      material.uniforms.iTime.value = performance.now() / 1000;
      renderer.render(scene, camera);
      raf = window.requestAnimationFrame(tick);
    };

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerout', handleLeave);
    window.addEventListener('resize', handleResize);
    raf = window.requestAnimationFrame(tick);

    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerout', handleLeave);
      window.removeEventListener('resize', handleResize);
      scene.remove(quad);
      geometry.dispose();
      material.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    };
  }, [
    sensitivity,
    lineThickness,
    linesColor,
    gridScale,
    scanColor,
    scanOpacity,
    bloomIntensity,
    noiseIntensity,
    lineJitter,
    scanGlow,
    scanSoftness,
    scanDuration,
    scanDelay,
  ]);

  return (
    <div ref={containerRef} className={`${styles.gridscan}${className ? ` ${className}` : ''}`} />
  );
}
