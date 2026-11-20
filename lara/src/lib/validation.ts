import type { PuntoPayload, TipoServicio } from '../types.ts';

export interface PuntoValidationErrors {
  nombre?: string;
  latitud?: string;
  longitud?: string;
  servicio?: string;
  horario?: string;
  referencia_puesto?: string;
}

const VALID_SERVICES: TipoServicio[] = ['inflado', 'herramientas', 'ambos'];
const DECIMAL_COORD_REGEX = /^[+-]?(?:\d+\.?\d*|\.\d+)$/;

export function parseDecimalCoordinate(value: string | number): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  const normalized = value.trim().replace(',', '.');
  if (!normalized || !DECIMAL_COORD_REGEX.test(normalized)) {
    return null;
  }
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

export function validateLatitude(value: string | number): {
  valid: boolean;
  numeric: number | null;
  error?: string;
} {
  const numeric = parseDecimalCoordinate(value);
  if (numeric === null) {
    return {
      valid: false,
      numeric: null,
      error: 'Ingresá una latitud numérica válida en grados decimales (ej. -34.603722).',
    };
  }
  if (numeric < -90 || numeric > 90) {
    return {
      valid: false,
      numeric,
      error: 'La latitud debe estar entre -90 y 90 grados decimales.',
    };
  }
  return { valid: true, numeric };
}

export function validateLongitude(value: string | number): {
  valid: boolean;
  numeric: number | null;
  error?: string;
} {
  const numeric = parseDecimalCoordinate(value);
  if (numeric === null) {
    return {
      valid: false,
      numeric: null,
      error: 'Ingresá una longitud numérica válida en grados decimales (ej. -58.381592).',
    };
  }
  if (numeric < -180 || numeric > 180) {
    return {
      valid: false,
      numeric,
      error: 'La longitud debe estar entre -180 y 180 grados decimales.',
    };
  }
  return { valid: true, numeric };
}

export function validatePuntoInput(raw: {
  nombre?: unknown;
  latitud?: unknown;
  longitud?: unknown;
  servicio?: unknown;
  horario?: unknown;
  referencia_puesto?: unknown;
}): {
  valid: boolean;
  errors: PuntoValidationErrors;
  data?: PuntoPayload;
} {
  const errors: PuntoValidationErrors = {};

  const nombre = typeof raw.nombre === 'string' ? raw.nombre.trim() : '';
  if (!nombre) {
    errors.nombre = 'El nombre del punto es obligatorio.';
  } else if (nombre.length > 120) {
    errors.nombre = 'El nombre no puede superar los 120 caracteres.';
  }

  const latCheck = validateLatitude(
    typeof raw.latitud === 'number' || typeof raw.latitud === 'string'
      ? raw.latitud
      : ''
  );
  if (!latCheck.valid) {
    errors.latitud = latCheck.error;
  }

  const lngCheck = validateLongitude(
    typeof raw.longitud === 'number' || typeof raw.longitud === 'string'
      ? raw.longitud
      : ''
  );
  if (!lngCheck.valid) {
    errors.longitud = lngCheck.error;
  }

  const servicio = typeof raw.servicio === 'string' ? raw.servicio : '';
  if (!VALID_SERVICES.includes(servicio as TipoServicio)) {
    errors.servicio = 'Seleccioná un servicio válido (inflado, herramientas o ambos).';
  }

  const horario = typeof raw.horario === 'string' ? raw.horario.trim() : '';
  if (!horario) {
    errors.horario = 'El horario es obligatorio.';
  } else if (horario.length > 100) {
    errors.horario = 'El horario no puede superar los 100 caracteres.';
  }

  const referencia =
    typeof raw.referencia_puesto === 'string'
      ? raw.referencia_puesto.trim()
      : '';
  if (!referencia) {
    errors.referencia_puesto = 'La referencia del puesto es obligatoria.';
  } else if (referencia.length > 240) {
    errors.referencia_puesto =
      'La referencia no puede superar los 240 caracteres.';
  }

  if (
    Object.keys(errors).length > 0 ||
    latCheck.numeric === null ||
    lngCheck.numeric === null
  ) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    errors: {},
    data: {
      nombre,
      latitud: Number(latCheck.numeric.toFixed(6)),
      longitud: Number(lngCheck.numeric.toFixed(6)),
      servicio: servicio as TipoServicio,
      horario,
      referencia_puesto: referencia,
    },
  };
}

export function formatServiceLabel(servicio: TipoServicio): string {
  switch (servicio) {
    case 'inflado':
      return 'Inflado';
    case 'herramientas':
      return 'Herramientas';
    case 'ambos':
      return 'Inflado y herramientas';
  }
}
