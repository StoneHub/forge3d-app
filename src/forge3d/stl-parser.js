// Binary & ASCII STL → Three.js BufferGeometry data
// Returns { vertices: Float32Array, normals: Float32Array, triangleCount }

export function parseSTL(input) {
  if (typeof input === 'string') return parseASCII(input);
  const buf = input instanceof ArrayBuffer ? input : input.buffer;

  // Try ASCII detection first — check if content contains 'facet normal'
  try {
    const text = new TextDecoder().decode(buf);
    if (text.includes('facet normal')) return parseASCII(text);
  } catch (_) { /* not valid text, fall through to binary */ }

  // Validate binary: triangle count must match file size (header 84 + 50 per triangle)
  if (buf.byteLength >= 84) {
    const view = new DataView(buf);
    const triCount = view.getUint32(80, true);
    const expectedSize = 84 + triCount * 50;
    if (Math.abs(expectedSize - buf.byteLength) <= 2) {
      return parseBinary(buf);
    }
  }

  // Last resort: try as text anyway
  try {
    return parseASCII(new TextDecoder().decode(buf));
  } catch (_) {
    return parseBinary(buf);
  }
}

function parseBinary(buf) {
  const view = new DataView(buf);
  const triangleCount = view.getUint32(80, true);
  const vertices = new Float32Array(triangleCount * 9);
  const normals = new Float32Array(triangleCount * 9);

  for (let i = 0; i < triangleCount; i++) {
    const offset = 84 + i * 50;
    const nx = view.getFloat32(offset, true);
    const ny = view.getFloat32(offset + 4, true);
    const nz = view.getFloat32(offset + 8, true);

    for (let v = 0; v < 3; v++) {
      const vOffset = offset + 12 + v * 12;
      const vi = i * 9 + v * 3;
      vertices[vi] = view.getFloat32(vOffset, true);
      vertices[vi + 1] = view.getFloat32(vOffset + 4, true);
      vertices[vi + 2] = view.getFloat32(vOffset + 8, true);
      normals[vi] = nx;
      normals[vi + 1] = ny;
      normals[vi + 2] = nz;
    }
  }

  return { vertices, normals, triangleCount };
}

function parseASCII(text) {
  const vertexList = [];
  const normalList = [];
  let currentNormal = [0, 0, 1];

  const lines = text.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('facet normal')) {
      const parts = trimmed.split(/\s+/);
      currentNormal = [parseFloat(parts[2]), parseFloat(parts[3]), parseFloat(parts[4])];
    } else if (trimmed.startsWith('vertex')) {
      const parts = trimmed.split(/\s+/);
      vertexList.push(parseFloat(parts[1]), parseFloat(parts[2]), parseFloat(parts[3]));
      normalList.push(currentNormal[0], currentNormal[1], currentNormal[2]);
    }
  }

  const triangleCount = vertexList.length / 9;
  return {
    vertices: new Float32Array(vertexList),
    normals: new Float32Array(normalList),
    triangleCount,
  };
}
