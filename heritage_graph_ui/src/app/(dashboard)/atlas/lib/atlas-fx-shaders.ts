/** Fragment shaders for Cesium PostProcessStage — WebGL1 GLSL, `colorTexture` + `v_textureCoordinates`. */

const FX_SHADER_COMPAT_HEADER = `
#if __VERSION__ == 300
#define ATLAS_VARYING in
#define ATLAS_TEXTURE texture
out vec4 atlasFragColor;
#else
#define ATLAS_VARYING varying
#define ATLAS_TEXTURE texture2D
#define atlasFragColor gl_FragColor
#endif
`;

export const CRT_FRAGMENT_SHADER = `
${FX_SHADER_COMPAT_HEADER}
uniform sampler2D colorTexture;
ATLAS_VARYING vec2 v_textureCoordinates;
uniform float u_strength;
uniform float u_pixelSize;

vec3 sampleRgb(vec2 uv) {
  return ATLAS_TEXTURE(colorTexture, uv).rgb;
}

void main(void) {
  vec2 uv = v_textureCoordinates;
  vec2 cc = uv - 0.5;
  float dist = dot(cc, cc);
  uv = uv + cc * dist * u_strength * 0.22;

  vec2 px = u_pixelSize > 0.0001 ? floor(uv / u_pixelSize) * u_pixelSize : uv;
  vec2 off = vec2(u_strength * 0.0025, 0.0);
  float r = sampleRgb(px + off).r;
  float g = sampleRgb(px).g;
  float b = sampleRgb(px - off).b;

  float scan = sin(uv.y * 3.14159265 * 720.0) * 0.5 + 0.5;
  float vig = smoothstep(0.82, 0.28, length(cc));
  vec3 col = vec3(r, g, b);
  col *= 0.92 + 0.14 * scan;
  col *= mix(1.0, 0.72, vig);
  atlasFragColor = vec4(col, 1.0);
}
`;

/** Thermal-style false color; u_polarity 0 = BHOT (cold bright), 1 = WHOT (hot bright). */
export const FLIR_FRAGMENT_SHADER = `
${FX_SHADER_COMPAT_HEADER}
uniform sampler2D colorTexture;
ATLAS_VARYING vec2 v_textureCoordinates;
uniform float u_polarity;
uniform float u_sensitivity;

vec3 thermalRamp(float t) {
  t = clamp(t, 0.0, 1.0);
  vec3 cold = vec3(0.02, 0.05, 0.22);
  vec3 mid = vec3(0.1, 0.85, 0.35);
  vec3 hot = vec3(1.0, 0.92, 0.08);
  if (t < 0.45) {
    return mix(cold, mid, t / 0.45);
  }
  return mix(mid, hot, (t - 0.45) / 0.55);
}

void main(void) {
  vec4 rgba = ATLAS_TEXTURE(colorTexture, v_textureCoordinates);
  float y = dot(rgba.rgb, vec3(0.299, 0.587, 0.114));
  y = pow(clamp(y * u_sensitivity, 0.0, 1.0), 0.85);
  float t = u_polarity > 0.5 ? y : 1.0 - y;
  vec3 outc = thermalRamp(t);
  atlasFragColor = vec4(outc, 1.0);
}
`;

export const ANIME_FRAGMENT_SHADER = `
${FX_SHADER_COMPAT_HEADER}
uniform sampler2D colorTexture;
ATLAS_VARYING vec2 v_textureCoordinates;
uniform float u_edge;

vec3 sampleAt(vec2 uv) {
  return ATLAS_TEXTURE(colorTexture, uv).rgb;
}

void main(void) {
  vec2 uv = v_textureCoordinates;
  vec2 px = vec2(1.0 / 1280.0, 1.0 / 720.0);
  vec3 c = sampleAt(uv);
  vec3 cx = sampleAt(uv + vec2(px.x, 0.0)) - sampleAt(uv - vec2(px.x, 0.0));
  vec3 cy = sampleAt(uv + vec2(0.0, px.y)) - sampleAt(uv - vec2(0.0, px.y));
  float edge = length(cx) + length(cy);

  float steps = 4.0;
  vec3 poster = floor(c * steps + 0.5) / steps;
  poster *= 1.05;
  poster = mix(poster, poster * 0.35, clamp(edge * u_edge * 6.0, 0.0, 1.0));
  atlasFragColor = vec4(poster, 1.0);
}
`;

export const PIXEL_FRAGMENT_SHADER = `
${FX_SHADER_COMPAT_HEADER}
uniform sampler2D colorTexture;
ATLAS_VARYING vec2 v_textureCoordinates;
uniform float u_cells;
uniform float u_aspect;

void main(void) {
  vec2 uv = v_textureCoordinates;
  float cells = max(u_cells, 8.0);
  vec2 grid = vec2(cells, cells / max(u_aspect, 0.25));
  vec2 cell = floor(uv * grid);
  vec2 q = (cell + 0.5) / grid;
  vec3 c = ATLAS_TEXTURE(colorTexture, q).rgb;
  atlasFragColor = vec4(c, 1.0);
}
`;
