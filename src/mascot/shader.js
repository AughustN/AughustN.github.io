// Nhân vật dựng hoàn toàn bằng signed distance function, không dùng file mô hình.
// Mọi pixel được đưa về đen hoặc trắng bằng ma trận Bayer 4x4 (ordered dithering).

export const WORLD_SIZE = 5.6
export const BODY_X = 0.75 // Dịch nhân vật sang phải trong canvas
export const CENTER_Y = 0.34
export const HEAD_Y = 0.3

export const VERTEX_SHADER = `#version 300 es
in vec2 aPosition;
void main() {
  gl_Position = vec4(aPosition, 0.0, 1.0);
}`

export const FRAGMENT_SHADER = `#version 300 es
precision highp float;

uniform vec2 uResolution;
uniform vec2 uBody;
uniform float uLean;
uniform float uBreath;
uniform mat3 uHeadRotation;
uniform vec2 uEye;
uniform float uEyeHeight;
uniform float uEyeWidth;
uniform float uMouthOpen;
uniform float uMouthWide;
uniform float uSmile;
uniform float uMouthRound;
uniform float uBrow;
uniform float uDark;

out vec4 fragColor;

const float WORLD = ${WORLD_SIZE.toFixed(2)};
const float OFFSET_X = ${BODY_X.toFixed(2)};
const float OFFSET_Y = ${CENTER_Y.toFixed(2)};
const vec3 HEAD = vec3(0.0, ${HEAD_Y.toFixed(2)}, 0.0);

const float PART_X = -0.25; // Đường ngôi, lệch về phần 3

const float HAIR = 1.0;
const float SKIN = 2.0;
const float SHIRT = 3.0;
const float DARK = 4.0;

const float BAYER[16] = float[16](
  0.0, 8.0, 2.0, 10.0,
  12.0, 4.0, 14.0, 6.0,
  3.0, 11.0, 1.0, 9.0,
  15.0, 7.0, 13.0, 5.0
);

float ellipsoid(vec3 p, vec3 r) {
  float k0 = length(p / r);
  float k1 = length(p / (r * r));
  return k0 * (k0 - 1.0) / k1;
}

float capsule(vec3 p, vec3 a, vec3 b, float r) {
  vec3 pa = p - a;
  vec3 ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h) - r;
}

float smoothMin(float a, float b, float k) {
  float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
  return mix(b, a, h) - k * h * (1.0 - h);
}

float smoothMax(float a, float b, float k) {
  return -smoothMin(-a, -b, k);
}

vec2 closest(vec2 a, vec2 b) {
  return a.x < b.x ? a : b;
}

// Đầu xoay quanh gốc cổ, không phải tâm đầu, để cằm không cắm vào áo khi cúi.
vec3 toHead(vec3 p) {
  const vec3 neckPivot = vec3(0.0, -0.75, 0.0);
  vec3 local = p - HEAD - vec3(0.0, uBreath * 0.5, 0.0);
  return uHeadRotation * (local - neckPivot) + neckPivot;
}

vec3 toBody(vec3 p) {
  vec3 q = p;
  q.xy -= uBody;
  float pivot = -3.0;
  q.y -= pivot;
  float c = cos(uLean);
  float s = sin(uLean);
  q.xy = mat2(c, s, -s, c) * q.xy;
  q.y += pivot;
  return q;
}

vec2 headScene(vec3 q) {
  vec3 mirrored = vec3(abs(q.x), q.yz);

  // Mặt dài, hẹp, góc cạnh nhưng bo mềm: khối đầu được cắt bằng các mặt phẳng.
  float face = ellipsoid(q - vec3(0.0, -0.08, 0.0), vec3(1.0, 1.3, 0.9));
  vec2 outline = mirrored.xy;
  face = smoothMax(face, outline.x - 0.86, 0.08);
  face = smoothMax(face, dot(outline, vec2(0.963, -0.27)) - 0.86, 0.08);
  face = smoothMax(face, dot(outline, vec2(0.69, -0.723)) - 0.945, 0.08);
  face = smoothMax(face, -q.y - 1.04, 0.08);
  face = smoothMax(face, q.y - 0.78, 0.12); // Phần trên nằm dưới tóc

  // Tai lộ nhưng cân với đầu.
  float ear = ellipsoid(mirrored - vec3(0.88, -0.16, -0.05), vec3(0.1, 0.22, 0.13));
  face = smoothMin(face, ear, 0.05);

  // Đầu mũi tròn, nhỏ.
  float nose = ellipsoid(q - vec3(0.0, -0.34, 0.84), vec3(0.09, 0.075, 0.09));
  face = smoothMin(face, nose, 0.1);
  vec2 result = vec2(face, SKIN);

  // Tóc rẽ ngôi 7/3 vuốt ngược: một khối liền, cao đều; ngôi chỉ là vân đen vẽ khi tô màu.
  vec3 h = q - vec3(0.0, 0.16, -0.04);
  float cap = ellipsoid(h, vec3(0.97, 0.88, 1.0));
  cap = smoothMin(cap, ellipsoid(q - vec3(0.0, 0.68, -0.04), vec3(0.88, 0.36, 0.74)), 0.24);

  // Gợn sóng chạy theo hướng vuốt, lặng dần sát đường ngôi và chân tóc.
  float fromPart = q.x - PART_X;
  float flow = fromPart + 0.34 * clamp(fromPart / 0.15, -1.0, 1.0) * q.z;
  float waves = sin(flow * 11.0 + sin(q.z * 3.0) * 0.8);
  cap -= 0.03 * waves * smoothstep(0.05, 0.45, q.y) * smoothstep(0.02, 0.2, abs(fromPart));

  // Chân tóc: vòm cong, cao hơn một chút ở phía phần 3.
  float opening = ellipsoid(q - vec3(-0.06, -0.62, 0.82), vec3(0.74, 1.2, 1.06));
  float aroundEar = length(mirrored - vec3(0.92, -0.2, 0.0)) - 0.2;

  // Gáy và hai bên ngắn.
  float taper = q.y + 0.6 - 1.15 * max(q.z + 0.3, 0.0); // Thái dương cắt gọn, không thành trụ
  float hair = max(max(max(cap, -opening), -aroundEar), -taper);
  result = closest(result, vec2(hair, HAIR));

  // Mày ngắn, dày, hơi nghiêng ra ngoài cho hiền.
  vec3 browCenter = vec3(0.3, 0.2 + uBrow, 0.84);
  float brow = capsule(mirrored, browCenter - vec3(0.09, -0.012, -0.02), browCenter + vec3(0.09, -0.018, -0.03), 0.028);
  result = closest(result, vec2(brow, DARK));

  return result;
}

vec2 scene(vec3 p) {
  vec3 body = toBody(p);

  // Thân hình chuông: vai dốc từ cổ, rộng dần xuống đáy khung.
  float chest = ellipsoid(body - vec3(0.0, -3.1, 0.0), vec3(1.45, 2.3, 0.8));
  vec2 result = vec2(chest, SHIRT);

  // Cổ lộ da, áo phông cổ tròn.
  float neck = capsule(body, vec3(0.0, -1.05, 0.04), vec3(0.0, -0.4, 0.04), 0.3);
  result = closest(result, vec2(neck, SKIN));
  vec3 collarPoint = body - vec3(0.0, -0.98, 0.04);
  float ring = length(vec2(length(collarPoint.xz * vec2(1.0, 1.12)) - 0.36, collarPoint.y)) - 0.06;
  result = closest(result, vec2(ring, SHIRT));

  return closest(result, headScene(toHead(body)));
}

vec3 normalAt(vec3 p) {
  const vec2 e = vec2(0.004, -0.004);
  return normalize(
    e.xyy * scene(p + e.xyy).x +
    e.yyx * scene(p + e.yyx).x +
    e.yxy * scene(p + e.yxy).x +
    e.xxx * scene(p + e.xxx).x
  );
}

// Miệng và điểm sáng trong mắt vẽ lên bề mặt, không cần hình học riêng.
bool isMouth(vec3 q) {
  if (q.z < 0.2) return false;
  // Miệng cười chữ D; uSmile nhếch khoé, uMouthRound vòng môi trên thành chữ O.
  float x = q.x / (0.165 * uMouthWide);
  if (abs(x) >= 1.0) return false;
  float arch = 1.0 - x * x;
  float top = -0.52 + 0.05 * uSmile * x * x + 0.1 * uMouthRound * arch;
  float bottom = top - (0.016 + 0.2 * uMouthOpen) * arch;
  return q.y < top + 0.01 && q.y > bottom;
}

// Áo nỉ raglan: thân tối, vai và tay sáng hơn, cổ dệt gân.
float shirtLuminance(vec3 b, float lit) {
  if (b.y > -1.08) {
    float ribs = 0.5 + 0.5 * sin(atan(b.x, b.z) * 26.0);
    return lit * (0.9 + 0.6 * ribs);
  }

  float seam = 0.42 + (-1.02 - b.y) * 0.85;
  float fromSeam = abs(b.x) - seam;
  if (abs(fromSeam) < 0.022) return 0.95;

  return lit * (fromSeam > 0.0 ? 1.75 : 1.0);
}

// Mắt đen bầu dục cao vẽ thẳng lên da, dịch theo con trỏ, có một đốm sáng cùng phía ở hai mắt.
// Trả về -1 nếu điểm không thuộc mắt.
float eyeLuminance(vec3 q) {
  if (q.z < 0.2) return -1.0;
  vec2 center = vec2(q.x < 0.0 ? -0.27 : 0.27, -0.14);
  center += uEye * vec2(q.x < 0.0 ? -1.0 : 1.0, 1.0);
  vec2 offset = q.xy - center;
  vec2 scaled = offset / vec2(0.105 * uEyeWidth, max(0.018, 0.178 * uEyeHeight));
  if (dot(scaled, scaled) > 1.0) return -1.0;
  if (uEyeHeight > 0.4 && length(offset - vec2(-0.03, 0.065)) < 0.036) return 1.2;
  return 0.0;
}

void main() {
  float unit = WORLD / uResolution.x;
  vec3 ray = vec3(
    (gl_FragCoord.x - 0.5 * uResolution.x) * unit - OFFSET_X,
    (gl_FragCoord.y - uResolution.y + 0.5 * uResolution.x) * unit + OFFSET_Y,
    2.2
  );

  float travelled = 0.0;
  vec2 hit = vec2(1.0, 0.0);
  bool found = false;
  for (int i = 0; i < 44; i++) {
    hit = scene(ray - vec3(0.0, 0.0, travelled));
    if (hit.x < 0.003) {
      found = true;
      break;
    }
    travelled += hit.x * 0.9;
    if (travelled > 4.6) break;
  }

  if (!found) {
    fragColor = vec4(0.0);
    return;
  }

  vec3 point = ray - vec3(0.0, 0.0, travelled);
  vec3 normal = normalAt(point);
  vec3 q = toHead(toBody(point));

  float light = clamp(dot(normal, normalize(vec3(-0.3, 0.5, 0.8))), 0.0, 1.0);
  float edge = smoothstep(0.0, 0.45, normal.z);

  float base = 0.34; // Áo phông đen
  if (hit.y == HAIR) base = 0.3;
  if (hit.y == SKIN) base = 1.05;
  if (hit.y == DARK) base = 0.0;

  float luminance = base * (0.42 + 0.72 * light) * mix(0.45, 1.0, edge);
  if (hit.y == SKIN) {
    float jaw = mix(0.62, 1.0, smoothstep(-0.98, -0.3, q.y));
    float hairShadow = mix(1.0, 0.72, smoothstep(0.34, 0.54, q.y));
    float neckShadow = mix(0.55, 1.0, smoothstep(-1.08, -0.8, toBody(point).y));
    luminance *= jaw * hairShadow * neckShadow;
  }
  if (hit.y == SKIN && isMouth(q)) luminance = 0.0;
  if (hit.y == SKIN) {
    float eyeTone = eyeLuminance(q);
    if (eyeTone >= 0.0) luminance = eyeTone;
  }

  if (hit.y == SHIRT) luminance = shirtLuminance(toBody(point), luminance);

  // Sợi tóc chạy từ ngôi ra hai bên rồi ngả về sau, kèm vệt bóng của tóc vuốt.
  if (hit.y == HAIR) {
    float fromPart = q.x - PART_X;
    float across = fromPart + (fromPart < 0.0 ? -0.34 : 0.34) * q.z;
    float strands = 0.5 + 0.5 * sin(across * 24.0);
    float gloss = pow(clamp(dot(normal, normalize(vec3(-0.2, 0.75, 0.62))), 0.0, 1.0), 14.0);
    luminance *= 0.84 + 0.32 * strands;
    luminance += gloss * (0.12 + 0.34 * strands);
  }

  // Nền tối: tóc và áo đen sẽ chìm, nên viền ngoài được làm sáng.
  if (uDark > 0.5 && hit.y != DARK) {
    float rim = pow(1.0 - clamp(normal.z, 0.0, 1.0), 4.0);
    luminance = max(luminance + (hit.y == HAIR ? 0.12 : 0.0), rim * 1.15);
  }

  // Ngôi: bóng đổ mờ, rộng hơn về phía khuất sáng và nhạt dần ra sau đầu.
  if (hit.y == HAIR) {
    float offset = q.x - (PART_X + 0.05 * sin(q.z * 2.2));
    float spread = offset > 0.0 ? 0.11 : 0.055;
    float shadow = exp(-offset * offset / (spread * spread));
    luminance *= 1.0 - 0.6 * shadow * smoothstep(-0.7, 0.2, q.z);
  }

  ivec2 cell = ivec2(mod(gl_FragCoord.xy, 4.0));
  float threshold = (BAYER[cell.y * 4 + cell.x] + 0.5) / 16.0;
  float ink = luminance > threshold ? 1.0 : 0.0;
  fragColor = vec4(vec3(ink), 1.0);
}`
