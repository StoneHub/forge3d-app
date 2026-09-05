export function cloneMeasurementPoint(point = {}) {
  return {
    position: Array.isArray(point.position) ? [...point.position] : [0, 0, 0],
    partId: point.partId || null,
  };
}

export function cloneMeasurementEntry(entry = {}) {
  return {
    id: entry.id || `measurement-${Date.now()}`,
    distance: Number.isFinite(entry.distance) ? entry.distance : 0,
    label: entry.label || 'Measurement',
    createdAt: entry.createdAt || Date.now(),
    points: Array.isArray(entry.points) ? entry.points.map(cloneMeasurementPoint) : [],
  };
}

export function cloneMeasurementState(measurement = {}) {
  return {
    enabled: measurement.enabled === true,
    points: Array.isArray(measurement.points) ? measurement.points.map(cloneMeasurementPoint) : [],
    distance: Number.isFinite(measurement.distance) ? measurement.distance : null,
    history: Array.isArray(measurement.history) ? measurement.history.map(cloneMeasurementEntry) : [],
  };
}

export function computeMeasurementDistance(points = []) {
  if (points.length < 2) return null;
  const [start, end] = points;
  return Math.hypot(
    end.position[0] - start.position[0],
    end.position[1] - start.position[1],
    end.position[2] - start.position[2],
  );
}

export function clearMeasurementDraft(measurement = {}, { disable = true } = {}) {
  const current = cloneMeasurementState(measurement);
  return {
    ...current,
    enabled: disable ? false : current.enabled,
    points: [],
    distance: null,
  };
}

export function appendMeasurementPick(measurement = {}, point, resolvePartName) {
  const current = cloneMeasurementState(measurement);
  const nextPoints = [...(current.points.length === 2 ? [] : current.points), cloneMeasurementPoint(point)];
  const distance = computeMeasurementDistance(nextPoints);

  if (nextPoints.length === 2 && Number.isFinite(distance)) {
    const labels = nextPoints
      .map((candidate) => resolvePartName(candidate.partId))
      .filter(Boolean);
    const entry = {
      id: `measurement-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      distance,
      label: labels.length === 2 && labels[0] !== labels[1] ? `${labels[0]} -> ${labels[1]}` : (labels[0] || 'Measurement'),
      createdAt: Date.now(),
      points: nextPoints,
    };
    return {
      entry,
      nextMeasurement: {
        ...current,
        enabled: true,
        points: nextPoints,
        distance,
        history: [entry, ...current.history].slice(0, 10),
      },
    };
  }

  return {
    entry: null,
    nextMeasurement: {
      ...current,
      enabled: true,
      points: nextPoints,
      distance,
    },
  };
}
