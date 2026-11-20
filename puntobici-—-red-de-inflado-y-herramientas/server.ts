import 'dotenv/config';
import express from 'express';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { createServer as createViteServer } from 'vite';
import type { PuntoAsistencia, PuntoPayload, FiltroServicio } from './src/types.ts';
import { validatePuntoInput } from './src/lib/validation.ts';

const PORT = 3000;
const DATA_DIR = path.resolve(process.cwd(), 'data');
const DATA_FILE = path.join(DATA_DIR, 'puntos.json');

const SEED_PUNTOS: Omit<PuntoAsistencia, 'id'>[] = [
  {
    nombre: 'Estación Rosedal Norte',
    latitud: -34.57115,
    longitud: -58.41734,
    servicio: 'inflado',
    horario: '07:00 a 21:00',
    referencia_puesto: 'Acceso Av. Infanta Isabel, junto al bicicletero norte',
  },
  {
    nombre: 'Punto Costanera Sur',
    latitud: -34.61432,
    longitud: -58.35689,
    servicio: 'herramientas',
    horario: '08:00 a 20:00',
    referencia_puesto: 'Entrada Fuente de las Nereidas, poste amarillo',
  },
  {
    nombre: 'Taller Parque Centenario',
    latitud: -34.60648,
    longitud: -58.43572,
    servicio: 'ambos',
    horario: '24 hs (autoservicio)',
    referencia_puesto: 'Esquina Av. Díaz Vélez y Leopoldo Marechal, tótem verde',
  },
];

const supabaseUrl = process.env.SUPABASE_URL?.trim();
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
  process.env.SUPABASE_ANON_KEY?.trim();

const supabase =
  supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

async function ensureLocalDataFile(): Promise<PuntoAsistencia[]> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    const raw = await fs.readFile(DATA_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed;
    }
  } catch {
    // Initialize seed data if file does not exist or is unreadable
  }
  const now = new Date().toISOString();
  const seeded: PuntoAsistencia[] = SEED_PUNTOS.map((item) => ({
    ...item,
    id: crypto.randomUUID(),
    created_at: now,
    updated_at: now,
  }));
  await fs.writeFile(DATA_FILE, JSON.stringify(seeded, null, 2), 'utf-8');
  return seeded;
}

async function writeLocalDataFile(puntos: PuntoAsistencia[]): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(DATA_FILE, JSON.stringify(puntos, null, 2), 'utf-8');
}

function matchesServicioFilter(
  punto: PuntoAsistencia,
  filtro?: FiltroServicio
): boolean {
  if (!filtro || filtro === 'todos') return true;
  return punto.servicio === filtro || punto.servicio === 'ambos';
}

async function listPuntos(filtro?: FiltroServicio): Promise<PuntoAsistencia[]> {
  if (supabase) {
    let query = supabase
      .from('puntos_asistencia')
      .select('*')
      .order('created_at', { ascending: false });

    if (filtro === 'inflado') {
      query = query.in('servicio', ['inflado', 'ambos']);
    } else if (filtro === 'herramientas') {
      query = query.in('servicio', ['herramientas', 'ambos']);
    }

    const { data, error } = await query;
    if (error) {
      throw new Error(error.message);
    }
    return (data ?? []) as PuntoAsistencia[];
  }

  const all = await ensureLocalDataFile();
  return all.filter((p) => matchesServicioFilter(p, filtro));
}

async function createPunto(payload: PuntoPayload): Promise<PuntoAsistencia> {
  if (supabase) {
    const { data, error } = await supabase
      .from('puntos_asistencia')
      .insert([payload])
      .select()
      .single();
    if (error) {
      throw new Error(error.message);
    }
    return data as PuntoAsistencia;
  }

  const all = await ensureLocalDataFile();
  const now = new Date().toISOString();
  const created: PuntoAsistencia = {
    id: crypto.randomUUID(),
    ...payload,
    created_at: now,
    updated_at: now,
  };
  all.unshift(created);
  await writeLocalDataFile(all);
  return created;
}

async function updatePunto(
  id: string,
  payload: PuntoPayload
): Promise<PuntoAsistencia | null> {
  if (supabase) {
    const { data, error } = await supabase
      .from('puntos_asistencia')
      .update({
        ...payload,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .maybeSingle();
    if (error) {
      throw new Error(error.message);
    }
    return (data as PuntoAsistencia | null) ?? null;
  }

  const all = await ensureLocalDataFile();
  const idx = all.findIndex((p) => p.id === id);
  if (idx === -1) return null;

  const updated: PuntoAsistencia = {
    ...all[idx],
    ...payload,
    updated_at: new Date().toISOString(),
  };
  all[idx] = updated;
  await writeLocalDataFile(all);
  return updated;
}

async function deletePunto(id: string): Promise<boolean> {
  if (supabase) {
    const { error, count } = await supabase
      .from('puntos_asistencia')
      .delete({ count: 'exact' })
      .eq('id', id);
    if (error) {
      throw new Error(error.message);
    }
    return (count ?? 0) > 0;
  }

  const all = await ensureLocalDataFile();
  const next = all.filter((p) => p.id !== id);
  if (next.length === all.length) return false;
  await writeLocalDataFile(next);
  return true;
}

async function startServer() {
  const app = express();
  app.use(express.json());

  app.get('/api/maps-config', (_req, res) => {
    const apiKey =
      process.env.VITE_GOOGLE_MAPS_API_KEY ||
      process.env.GOOGLE_MAPS_API_KEY ||
      '';
    res.json({ apiKey });
  });

  app.get('/api/puntos', async (req, res) => {
    try {
      const rawFiltro = req.query.servicio;
      const filtro: FiltroServicio =
        rawFiltro === 'inflado' || rawFiltro === 'herramientas'
          ? rawFiltro
          : 'todos';
      const puntos = await listPuntos(filtro);
      res.json(puntos);
    } catch (err) {
      console.error('Error al listar puntos:', err);
      res.status(500).json({ error: 'No se pudieron obtener los puntos.' });
    }
  });

  app.post('/api/puntos', async (req, res) => {
    const validation = validatePuntoInput(req.body ?? {});
    if (!validation.valid || !validation.data) {
      return res.status(400).json({
        error: 'Datos inválidos.',
        errors: validation.errors,
      });
    }

    try {
      const created = await createPunto(validation.data);
      res.status(201).json(created);
    } catch (err) {
      console.error('Error al crear punto:', err);
      res.status(500).json({ error: 'No se pudo guardar el punto.' });
    }
  });

  app.put('/api/puntos/:id', async (req, res) => {
    const { id } = req.params;
    const validation = validatePuntoInput(req.body ?? {});
    if (!validation.valid || !validation.data) {
      return res.status(400).json({
        error: 'Datos inválidos.',
        errors: validation.errors,
      });
    }

    try {
      const updated = await updatePunto(id, validation.data);
      if (!updated) {
        return res.status(404).json({ error: 'Punto no encontrado.' });
      }
      res.json(updated);
    } catch (err) {
      console.error('Error al actualizar punto:', err);
      res.status(500).json({ error: 'No se pudo actualizar el punto.' });
    }
  });

  app.delete('/api/puntos/:id', async (req, res) => {
    const { id } = req.params;
    try {
      const deleted = await deletePunto(id);
      if (!deleted) {
        return res.status(404).json({ error: 'Punto no encontrado.' });
      }
      res.json({ deleted: true, id });
    } catch (err) {
      console.error('Error al eliminar punto:', err);
      res.status(500).json({ error: 'No se pudo eliminar el punto.' });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor activo en http://0.0.0.0:${PORT}`);
  });
}

startServer();
