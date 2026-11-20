-- Esquema SQL para Supabase (PostgreSQL)
-- Tabla: puntos_asistencia

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS public.puntos_asistencia (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL CHECK (char_length(trim(nombre)) > 0),
  latitud DOUBLE PRECISION NOT NULL CHECK (latitud >= -90 AND latitud <= 90),
  longitud DOUBLE PRECISION NOT NULL CHECK (longitud >= -180 AND longitud <= 180),
  servicio TEXT NOT NULL CHECK (servicio IN ('inflado', 'herramientas', 'ambos')),
  horario TEXT NOT NULL CHECK (char_length(trim(horario)) > 0),
  referencia_puesto TEXT NOT NULL CHECK (char_length(trim(referencia_puesto)) > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índice para filtrar rápidamente por servicio
CREATE INDEX IF NOT EXISTS idx_puntos_asistencia_servicio
  ON public.puntos_asistencia (servicio);

-- Habilitar Row Level Security (RLS)
ALTER TABLE public.puntos_asistencia ENABLE ROW LEVEL SECURITY;

-- Política de acceso público para lectura y gestión web (ajustar según autenticación en producción)
CREATE POLICY "Permitir lectura publica de puntos"
  ON public.puntos_asistencia FOR SELECT
  USING (true);

CREATE POLICY "Permitir insercion publica de puntos"
  ON public.puntos_asistencia FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Permitir actualizacion publica de puntos"
  ON public.puntos_asistencia FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Permitir eliminacion publica de puntos"
  ON public.puntos_asistencia FOR DELETE
  USING (true);

-- Tres registros de ejemplo en ubicaciones distintas
INSERT INTO public.puntos_asistencia (nombre, latitud, longitud, servicio, horario, referencia_puesto)
VALUES
  (
    'Estación Rosedal Norte',
    -34.571150,
    -58.417340,
    'inflado',
    '07:00 a 21:00',
    'Acceso Av. Infanta Isabel, junto al bicicletero norte'
  ),
  (
    'Punto Costanera Sur',
    -34.614320,
    -58.356890,
    'herramientas',
    '08:00 a 20:00',
    'Entrada Fuente de las Nereidas, poste amarillo'
  ),
  (
    'Taller Parque Centenario',
    -34.606480,
    -58.435720,
    'ambos',
    '24 hs (autoservicio)',
    'Esquina Av. Díaz Vélez y Leopoldo Marechal, tótem verde'
  );
