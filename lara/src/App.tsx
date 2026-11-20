import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  Wind,
  Wrench,
  Layers,
  Clock,
  MapPin,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import type { FiltroServicio, PuntoAsistencia, PuntoPayload } from './types.ts';
import { formatServiceLabel } from './lib/validation.ts';
import { PuntosMap } from './components/PuntosMap.tsx';
import { PuntoFormModal } from './components/PuntoFormModal.tsx';

const ENV_MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

function ServiceIcon({ servicio }: { servicio: PuntoAsistencia['servicio'] }) {
  if (servicio === 'inflado') {
    return <Wind className="w-3.5 h-3.5 text-sky-600 shrink-0" />;
  }
  if (servicio === 'herramientas') {
    return <Wrench className="w-3.5 h-3.5 text-amber-600 shrink-0" />;
  }
  return <Layers className="w-3.5 h-3.5 text-teal-600 shrink-0" />;
}

export default function App() {
  const [quotaExceeded, setQuotaExceeded] = useState(false);
  const [mapsApiKey, setMapsApiKey] = useState<string>(ENV_MAPS_KEY);
  const [puntos, setPuntos] = useState<PuntoAsistencia[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [filtroServicio, setFiltroServicio] = useState<FiltroServicio>('todos');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPunto, setEditingPunto] = useState<PuntoAsistencia | null>(null);
  const [isPickingOnMap, setIsPickingOnMap] = useState(false);
  const [pickedCoords, setPickedCoords] = useState<{
    lat: number;
    lng: number;
  } | null>(null);

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    const handleQuota = () => setQuotaExceeded(true);
    window.addEventListener('gmp-quota-exceeded', handleQuota);
    return () => window.removeEventListener('gmp-quota-exceeded', handleQuota);
  }, []);

  useEffect(() => {
    if (ENV_MAPS_KEY) return;
    fetch('/api/maps-config')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.apiKey) {
          setMapsApiKey(data.apiKey);
        }
      })
      .catch(() => {
        // Ignore config fallback failure
      });
  }, []);

  const loadPuntos = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const res = await fetch('/api/puntos');
      if (!res.ok) {
        throw new Error('No se pudo cargar el listado de puntos.');
      }
      const data = (await res.json()) as PuntoAsistencia[];
      setPuntos(data);
      setSelectedId((prev) => {
        if (prev && data.some((p) => p.id === prev)) return prev;
        return data[0]?.id ?? null;
      });
    } catch (err) {
      setFetchError(
        err instanceof Error
          ? err.message
          : 'Ocurrió un error al consultar los puntos.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPuntos();
  }, [loadPuntos]);

  const counts = useMemo(() => {
    const inflado = puntos.filter(
      (p) => p.servicio === 'inflado' || p.servicio === 'ambos'
    ).length;
    const herramientas = puntos.filter(
      (p) => p.servicio === 'herramientas' || p.servicio === 'ambos'
    ).length;
    return {
      todos: puntos.length,
      inflado,
      herramientas,
    };
  }, [puntos]);

  const filteredPuntos = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return puntos.filter((p) => {
      const matchesService =
        filtroServicio === 'todos' ||
        p.servicio === filtroServicio ||
        p.servicio === 'ambos';
      if (!matchesService) return false;
      if (!q) return true;
      return (
        p.nombre.toLowerCase().includes(q) ||
        p.referencia_puesto.toLowerCase().includes(q) ||
        p.horario.toLowerCase().includes(q)
      );
    });
  }, [puntos, filtroServicio, searchQuery]);

  const selectedPunto = useMemo(
    () => filteredPuntos.find((p) => p.id === selectedId) ?? null,
    [filteredPuntos, selectedId]
  );

  useEffect(() => {
    if (
      filteredPuntos.length > 0 &&
      !filteredPuntos.some((p) => p.id === selectedId)
    ) {
      setSelectedId(filteredPuntos[0].id);
    }
  }, [filteredPuntos, selectedId]);

  const handleOpenCreate = () => {
    setEditingPunto(null);
    setPickedCoords(null);
    setIsPickingOnMap(false);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (punto: PuntoAsistencia) => {
    setEditingPunto(punto);
    setPickedCoords(null);
    setIsPickingOnMap(false);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingPunto(null);
    setPickedCoords(null);
    setIsPickingOnMap(false);
  };

  const handleSavePunto = async (payload: PuntoPayload, editingId?: string) => {
    const url = editingId ? `/api/puntos/${editingId}` : '/api/puntos';
    const method = editingId ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      const firstFieldError = body?.errors
        ? (Object.values(body.errors)[0] as string | undefined)
        : undefined;
      throw new Error(
        firstFieldError || body?.error || 'No se pudo guardar el punto.'
      );
    }

    const saved = body as PuntoAsistencia;
    setPuntos((prev) => {
      if (editingId) {
        return prev.map((item) => (item.id === editingId ? saved : item));
      }
      return [saved, ...prev];
    });
    setSelectedId(saved.id);
    handleCloseModal();
  };

  const handleDeletePunto = async (id: string) => {
    setDeletingId(id);
    setFetchError(null);
    try {
      const res = await fetch(`/api/puntos/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        throw new Error('No se pudo eliminar el registro.');
      }
      setPuntos((prev) => {
        const next = prev.filter((item) => item.id !== id);
        if (selectedId === id) {
          setSelectedId(next[0]?.id ?? null);
        }
        return next;
      });
      setConfirmDeleteId(null);
    } catch (err) {
      setFetchError(
        err instanceof Error ? err.message : 'No se pudo eliminar el punto.'
      );
    } finally {
      setDeletingId(null);
    }
  };

  const handleMapPickCoordinates = (coords: { lat: number; lng: number }) => {
    setPickedCoords(coords);
    setIsPickingOnMap(false);
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      {quotaExceeded && (
        <div className="bg-amber-50 border-b border-amber-200 text-amber-900 px-4 py-2.5 text-xs md:text-sm text-center sticky top-0 z-50 shadow-sm">
          <span>
            Google Maps Platform quota reached. If you are the app owner, visit{' '}
            <a
              href="https://developers.google.com/maps/ai/ai-studio?utm_campaign=gmp_mcp_codeassist_v1_aistudio#quota_exceeded_errors"
              target="_blank"
              rel="noopener noreferrer"
              className="underline font-semibold text-amber-950 hover:text-amber-800"
            >
              maps developer site
            </a>{' '}
            for instructions to update your account.
          </span>
        </div>
      )}

      <header className="h-16 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between gap-8 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <span className="font-display text-lg font-bold tracking-tight text-slate-950 whitespace-nowrap shrink-0">
            PuntoBici
          </span>
          <span className="hidden sm:inline text-slate-300" aria-hidden="true">
            /
          </span>
          <span className="hidden sm:inline text-xs font-medium text-slate-500 truncate">
            Red de inflado y herramientas
          </span>
        </div>

        <button
          type="button"
          onClick={handleOpenCreate}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-lg transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600"
        >
          <Plus className="w-4 h-4" />
          Agregar punto
        </button>
      </header>

      <main className="flex-1 grid grid-cols-1 lg:grid-cols-[430px_1fr] lg:h-[calc(100vh-4rem)] lg:overflow-hidden">
        <section
          aria-label="Listado y filtros de puntos"
          className="flex flex-col bg-white border-b lg:border-b-0 lg:border-r border-slate-200 lg:h-full lg:overflow-hidden"
        >
          <div className="p-4 space-y-3 border-b border-slate-200 shrink-0">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar por nombre, horario o referencia..."
                aria-label="Buscar puntos"
                className="w-full pl-9 pr-3 py-2 text-sm text-slate-900 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:bg-white focus:border-teal-600 focus:ring-2 focus:ring-teal-600/15"
              />
            </div>

            <div
              role="group"
              aria-label="Filtrar por servicio"
              className="grid grid-cols-3 gap-1 p-1 bg-slate-100 rounded-lg"
            >
              <button
                type="button"
                onClick={() => setFiltroServicio('todos')}
                className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 tabular-nums ${
                  filtroServicio === 'todos'
                    ? 'bg-white text-slate-950 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Todos ({counts.todos})
              </button>
              <button
                type="button"
                onClick={() => setFiltroServicio('inflado')}
                className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 tabular-nums ${
                  filtroServicio === 'inflado'
                    ? 'bg-white text-slate-950 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Inflado ({counts.inflado})
              </button>
              <button
                type="button"
                onClick={() => setFiltroServicio('herramientas')}
                className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 tabular-nums ${
                  filtroServicio === 'herramientas'
                    ? 'bg-white text-slate-950 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Herramientas ({counts.herramientas})
              </button>
            </div>
          </div>

          {fetchError && (
            <div
              role="alert"
              className="m-4 mb-0 px-3.5 py-2.5 bg-red-50 border border-red-200 rounded-lg flex items-center justify-between gap-3 text-xs text-red-800"
            >
              <div className="flex items-center gap-2 min-w-0">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                <span className="truncate">{fetchError}</span>
              </div>
              <button
                type="button"
                onClick={loadPuntos}
                className="inline-flex items-center gap-1 font-semibold text-red-900 hover:underline whitespace-nowrap shrink-0"
              >
                <RefreshCw className="w-3 h-3" />
                Reintentar
              </button>
            </div>
          )}

          <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
            {loading ? (
              Array.from({ length: 3 }).map((_, idx) => (
                <div
                  key={idx}
                  className="p-4 rounded-xl border border-slate-200 bg-white animate-pulse space-y-2.5"
                >
                  <div className="h-4 w-2/3 bg-slate-200 rounded" />
                  <div className="h-3 w-1/2 bg-slate-100 rounded" />
                  <div className="h-3 w-5/6 bg-slate-100 rounded" />
                </div>
              ))
            ) : filteredPuntos.length === 0 ? (
              <div className="py-12 px-4 text-center border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                <MapPin className="w-7 h-7 text-slate-400 mx-auto mb-2.5" />
                <p className="text-sm font-semibold text-slate-900">
                  {puntos.length === 0
                    ? 'Todavía no hay puntos cargados'
                    : 'Sin resultados para este filtro'}
                </p>
                <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
                  {puntos.length === 0
                    ? 'Agregá el primer puesto de inflado o herramientas para verlo en el mapa.'
                    : 'Probá limpiando la búsqueda o seleccionando otra categoría de servicio.'}
                </p>
                <div className="mt-4">
                  {puntos.length === 0 ? (
                    <button
                      type="button"
                      onClick={handleOpenCreate}
                      className="px-4 py-2 text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-lg transition-colors"
                    >
                      Agregar primer punto
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setFiltroServicio('todos');
                        setSearchQuery('');
                      }}
                      className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors"
                    >
                      Limpiar filtros
                    </button>
                  )}
                </div>
              </div>
            ) : (
              filteredPuntos.map((punto) => {
                const isSelected = selectedPunto?.id === punto.id;
                const isConfirmingDelete = confirmDeleteId === punto.id;

                return (
                  <article
                    key={punto.id}
                    className={`rounded-xl border transition-colors ${
                      isSelected
                        ? 'bg-teal-50/60 border-teal-500'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedId(punto.id);
                        setConfirmDeleteId(null);
                      }}
                      className="w-full text-left p-4 pb-3 focus-visible:outline-2 focus-visible:outline-teal-600 rounded-t-xl"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="text-sm font-semibold text-slate-950 leading-snug">
                          {punto.nombre}
                        </h3>
                      </div>

                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-600 mt-1.5">
                        <span className="inline-flex items-center gap-1 font-medium text-slate-800">
                          <ServiceIcon servicio={punto.servicio} />
                          {formatServiceLabel(punto.servicio)}
                        </span>
                        <span className="text-slate-300" aria-hidden="true">
                          ·
                        </span>
                        <span className="inline-flex items-center gap-1 text-slate-600">
                          <Clock className="w-3 h-3 text-slate-400 shrink-0" />
                          {punto.horario}
                        </span>
                      </div>

                      <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                        {punto.referencia_puesto}
                      </p>

                      <p className="text-[11px] font-mono tabular-nums text-slate-500 mt-2">
                        {punto.latitud.toFixed(6)}, {punto.longitud.toFixed(6)}
                      </p>
                    </button>

                    <div className="px-4 py-2.5 border-t border-slate-100 flex items-center justify-between gap-2">
                      {isConfirmingDelete ? (
                        <div className="w-full flex items-center justify-between gap-2">
                          <span className="text-xs font-medium text-red-700">
                            ¿Eliminar este punto?
                          </span>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(null)}
                              disabled={deletingId === punto.id}
                              className="px-2.5 py-1 text-xs font-medium text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded-md"
                            >
                              Cancelar
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeletePunto(punto.id)}
                              disabled={deletingId === punto.id}
                              className="px-2.5 py-1 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-md disabled:opacity-60"
                            >
                              {deletingId === punto.id
                                ? 'Eliminando...'
                                : 'Confirmar'}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => setSelectedId(punto.id)}
                            className={`text-xs font-medium transition-colors ${
                              isSelected
                                ? 'text-teal-700'
                                : 'text-slate-500 hover:text-slate-900'
                            }`}
                          >
                            {isSelected ? 'Mostrando en mapa' : 'Ver en mapa'}
                          </button>

                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleOpenEdit(punto)}
                              aria-label={`Editar ${punto.nombre}`}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                              Editar
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(punto.id)}
                              aria-label={`Eliminar ${punto.nombre}`}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded-md transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              Eliminar
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </article>
                );
              })
            )}
          </div>
        </section>

        <section
          aria-label="Mapa interactivo de Google Maps"
          className="p-4 lg:h-full min-h-[460px] flex flex-col"
        >
          <PuntosMap
            apiKey={mapsApiKey}
            puntos={filteredPuntos}
            selectedPunto={selectedPunto}
            isPickingOnMap={isPickingOnMap}
            onSelectPunto={(punto) => setSelectedId(punto.id)}
            onMapPickCoordinates={handleMapPickCoordinates}
            onCancelPickOnMap={() => setIsPickingOnMap(false)}
          />
        </section>
      </main>

      <PuntoFormModal
        isOpen={isModalOpen}
        editingPunto={editingPunto}
        pickedCoords={pickedCoords}
        isPickingOnMap={isPickingOnMap}
        onStartPickOnMap={() => setIsPickingOnMap(true)}
        onClose={handleCloseModal}
        onSave={handleSavePunto}
      />
    </div>
  );
}
