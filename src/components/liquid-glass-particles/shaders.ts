export const backgroundVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

export const backgroundFragment = /* glsl */ `
  varying vec2 vUv;
  uniform float uTime;
  uniform vec2 uResolution;

  void main() {
    vec2 uv = vUv;
    float n = sin(uv.x * 12.0 + uTime * 0.15) * sin(uv.y * 8.0 - uTime * 0.12) * 0.5 + 0.5;
    vec3 top = vec3(0.02, 0.02, 0.03);
    vec3 mid = vec3(0.06, 0.065, 0.09);
    vec3 bottom = vec3(0.09, 0.085, 0.11);
    vec3 col = mix(top, mid, uv.y);
    col = mix(col, bottom, smoothstep(0.55, 1.0, uv.y));
    col += vec3(0.015, 0.02, 0.03) * n;
    float vign = smoothstep(1.2, 0.25, length(uv - 0.5) * 1.35);
    gl_FragColor = vec4(col * vign, 1.0);
  }
`;

export const fieldVertex = backgroundVertex;

export const fieldFragment = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D uParticleData;
  uniform int uParticleCount;
  uniform vec2 uResolution;

  void main() {
    vec2 frag = vUv * uResolution;
    float field = 0.0;

    for (int i = 0; i < 32; i++) {
      if (i >= uParticleCount) break;
      vec4 data = texelFetch(uParticleData, ivec2(i, 0), 0);
      vec2 pos = data.xy * uResolution;
      float r = data.z * max(uResolution.x, uResolution.y);
      float d2 = dot(frag - pos, frag - pos);
      field += (r * r * 4.0) / (d2 + 6.0);
    }

    gl_FragColor = vec4(clamp(field * 0.12, 0.0, 1.0), 0.0, 0.0, 1.0);
  }
`;

export const blurVertex = backgroundVertex;

export const blurFragment = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D uTexture;
  uniform vec2 uDirection;
  uniform vec2 uResolution;

  void main() {
    vec2 texel = uDirection / uResolution;
    float sum = 0.0;
    sum += texture2D(uTexture, vUv - texel * 4.0).r * 0.05;
    sum += texture2D(uTexture, vUv - texel * 3.0).r * 0.09;
    sum += texture2D(uTexture, vUv - texel * 2.0).r * 0.12;
    sum += texture2D(uTexture, vUv - texel * 1.0).r * 0.15;
    sum += texture2D(uTexture, vUv).r * 0.18;
    sum += texture2D(uTexture, vUv + texel * 1.0).r * 0.15;
    sum += texture2D(uTexture, vUv + texel * 2.0).r * 0.12;
    sum += texture2D(uTexture, vUv + texel * 3.0).r * 0.09;
    sum += texture2D(uTexture, vUv + texel * 4.0).r * 0.05;
    gl_FragColor = vec4(sum, 0.0, 0.0, 1.0);
  }
`;

export const glassVertex = backgroundVertex;

export const glassFragment = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D uField;
  uniform sampler2D uBackground;
  uniform sampler2D uParticleData;
  uniform int uParticleCount;
  uniform vec2 uResolution;
  uniform float uTime;
  uniform vec3 uLightDir;

  float sampleField(vec2 uv) {
    return texture2D(uField, uv).r;
  }

  void main() {
    vec2 texel = 1.0 / uResolution;
    float f0 = sampleField(vUv);
    float threshold = 0.22;

    if (f0 < threshold * 0.25) {
      gl_FragColor = vec4(0.0);
      return;
    }

    float fx = sampleField(vUv + vec2(texel.x, 0.0)) - sampleField(vUv - vec2(texel.x, 0.0));
    float fy = sampleField(vUv + vec2(0.0, texel.y)) - sampleField(vUv - vec2(0.0, texel.y));
    vec3 N = normalize(vec3(-fx * 2.2, -fy * 2.2, 1.0));

    float refractStrength = 0.045 * smoothstep(threshold, threshold * 2.5, f0);
    vec2 bgUv = vUv + N.xy * refractStrength;
    bgUv += vec2(sin(uTime * 0.4 + vUv.y * 8.0), cos(uTime * 0.35 + vUv.x * 8.0)) * 0.0015;
    vec3 bg = texture2D(uBackground, clamp(bgUv, 0.001, 0.999)).rgb;

    float velMag = 0.0;
  vec2 frag = vUv * uResolution;
    float minD = 1e6;
    for (int i = 0; i < 32; i++) {
      if (i >= uParticleCount) break;
      vec4 data = texelFetch(uParticleData, ivec2(i, 0), 0);
      vec2 pos = data.xy * uResolution;
      float d = length(frag - pos);
      if (d < minD) {
        minD = d;
        velMag = data.w;
      }
    }

    vec3 L = normalize(uLightDir);
    vec3 V = vec3(0.0, 0.0, 1.0);
    vec3 H = normalize(L + V);
    float specPower = mix(48.0, 160.0, velMag);
    float spec = pow(max(dot(N, H), 0.0), specPower) * (0.35 + velMag * 1.8);

    float fresnel = pow(1.0 - max(dot(N, V), 0.0), 3.5);
    vec3 rim = vec3(0.85, 0.95, 1.0) * fresnel * 0.35;

    vec3 glass = bg;
    glass = mix(glass, vec3(1.0), 0.12 * fresnel);
    glass += spec * vec3(1.0, 1.0, 0.92);
    glass += rim;
    glass += vec3(0.8, 1.0, 0.35) * velMag * spec * 0.4;

    float alpha = smoothstep(threshold * 0.45, threshold * 1.65, f0);
    gl_FragColor = vec4(glass, alpha * 0.92);
  }
`;
