import React, { useEffect, useState } from 'react';
import { X, Crosshair, Wind, Wrench, Layers } from 'lucide-react';
import type { PuntoAsistencia, PuntoPayload, TipoServicio } from '../types.ts';
import {
  validateLatitude,
  validateLongitude,
  validatePuntoInput,
  type PuntoValidationErrors,
} from '../lib/validation.ts';

interface PuntoFormModalProps {
  isOpen: boolean;
  editingPunto: PuntoAsistencia | null;
  pickedCoords: { lat: number; lng: number } | null;
  isPickingOnMap: boolean;
  onStartPickOnMap: () => void;
  onClose: () => void;
  onSave: (payload: PuntoPayload, editingId?: string) => Promise<void>;
}

const SERVICE_OPTIONS: {
  value: TipoServicio;
  label: string;
  description: string;
}[] = [
  {
    value: 'inflado',
    label: 'Inflado',
    description: 'Bomba de aire manual o eléctrica',
  },
  {
    value: 'herramientas',
    label: 'Herramientas',
    description: 'Llaves Allen, palancas y soporte',
  },
  {
    value: 'ambos',
    label: 'Inflado y herramientas',
    description: 'Estación completa de autoservicio',
  },
];

export function PuntoFormModal({
  isOpen,
  editingPunto,
  pickedCoords,
  isPickingOnMap,
  onStartPickOnMap,
  onClose,
  onSave,
}: PuntoFormModalProps) {
  const [nombre, setNombre] = useState('');
  const [latitud, setLatitud] = useState('');
  const [longitud, setLongitud] = useState('');
  const [servicio, setServicio] = useState<TipoServicio>('inflado');
  const [horario, setHorario] = useState('');
  const [referenciaPuesto, setReferenciaPuesto] = useState('');
  const [errors, setErrors] = useState<PuntoValidationErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    if (editingPunto) {
      setNombre(editingPunto.nombre);
      setLatitud(String(editingPunto.latitud));
      setLongitud(String(editingPunto.longitud));
      setServicio(editingPunto.servicio);
      setHorario(editingPunto.horario);
      setReferenciaPuesto(editingPunto.referencia_puesto);
    } else {
      setNombre('');
      setLatitud('');
      setLongitud('');
      setServicio('inflado');
      setHorario('');
      setReferenciaPuesto('');
    }
    setErrors({});
    setSubmitError(null);
  }, [isOpen, editingPunto]);

  useEffect(() => {
    if (pickedCoords) {
      setLatitud(pickedCoords.lat.toFixed(6));
      setLongitud(pickedCoords.lng.toFixed(6));
      setErrors((prev) => ({
        ...prev,
        latitud: undefined,
        longitud: undefined,
      }));
    }
  }, [pickedCoords]);

  useEffect(() => {
    if (!isOpen || isPickingOnMap) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isPickingOnMap, onClose]);

  if (!isOpen || isPickingOnMap) {
    return null;
  }

  const handleLatBlur = () => {
    if (!latitud.trim()) return;
    const check = validateLatitude(latitud);
    setErrors((prev) => ({
      ...prev,
      latitud: check.valid ? undefined : check.error,
    }));
  };

  const handleLngBlur = () => {
    if (!longitud.trim()) return;
    const check = validateLongitude(longitud);
    setErrors((prev) => ({
      ...prev,
      longitud: check.valid ? undefined : check.error,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    const validation = validatePuntoInput({
      nombre,
      latitud,
      longitud,
      servicio,
      horario,
      referencia_puesto: referenciaPuesto,
    });

    if (!validation.valid || !validation.data) {
      setErrors(validation.errors);
      return;
    }

    setErrors({});
    setIsSubmitting(true);
    try {
      await onSave(validation.data, editingPunto?.id);
    } catch (err) {
      setSubmitError(
        err instanceof Error
          ? err.message
          : 'No se pudo guardar el registro. Intentá nuevamente.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 backdrop-blur-[1px] p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-punto-titulo"
    >
      <div className="w-full max-w-lg bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div>
            <h2
              id="modal-punto-titulo"
              className="text-base font-semibold text-slate-900"
            >
              {editingPunto ? 'Editar punto de asistencia' : 'Nuevo punto de asistencia'}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Completá los datos del puesto y sus coordenadas en grados decimales.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar formulario"
            className="p-2 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors focus-visible:outline-2 focus-visible:outline-teal-600"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[82vh] overflow-y-auto">
          {submitError && (
            <div
              role="alert"
              className="px-3.5 py-2.5 text-xs text-red-800 bg-red-50 border border-red-200 rounded-lg"
            >
              {submitError}
            </div>
          )}

          <div>
            <label
              htmlFor="punto-nombre"
              className="block text-xs font-medium text-slate-700 mb-1.5"
            >
              Nombre del punto
            </label>
            <input
              id="punto-nombre"
              type="text"
              value={nombre}
              onChange={(e) => {
                setNombre(e.target.value);
                if (errors.nombre) setErrors((p) => ({ ...p, nombre: undefined }));
              }}
              placeholder="Ej. Estación Plaza Italia"
              className="w-full px-3 py-2 text-sm text-slate-900 bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/15"
            />
            {errors.nombre && (
              <p className="mt-1 text-xs text-red-600">{errors.nombre}</p>
            )}
          </div>

          <div>
            <span className="block text-xs font-medium text-slate-700 mb-1.5">
              Servicio disponible
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {SERVICE_OPTIONS.map((opt) => {
                const active = servicio === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setServicio(opt.value)}
                    className={`flex flex-col items-start gap-1 p-2.5 text-left rounded-lg border transition-colors focus-visible:outline-2 focus-visible:outline-teal-600 ${
                      active
                        ? 'bg-teal-50 border-teal-600 text-slate-900'
                        : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 text-xs font-semibold">
                      {opt.value === 'inflado' && (
                        <Wind className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                      )}
                      {opt.value === 'herramientas' && (
                        <Wrench className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      )}
                      {opt.value === 'ambos' && (
                        <Layers className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                      )}
                      <span>{opt.label}</span>
                    </div>
                    <span className="text-[11px] text-slate-500 leading-snug">
                      {opt.description}
                    </span>
                  </button>
                );
              })}
            </div>
            {errors.servicio && (
              <p className="mt-1 text-xs text-red-600">{errors.servicio}</p>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-slate-700">
                Coordenadas (grados decimales)
              </span>
              <button
                type="button"
                onClick={onStartPickOnMap}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-teal-700 bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded-md transition-colors whitespace-nowrap shrink-0"
              >
                <Crosshair className="w-3.5 h-3.5" />
                Elegir en el mapa
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="punto-latitud"
                  className="block text-[11px] font-medium text-slate-600 mb-1"
                >
                  Latitud (-90 a 90)
                </label>
                <input
                  id="punto-latitud"
                  type="text"
                  inputMode="decimal"
                  value={latitud}
                  onChange={(e) => {
                    setLatitud(e.target.value);
                    if (errors.latitud) setErrors((p) => ({ ...p, latitud: undefined }));
                  }}
                  onBlur={handleLatBlur}
                  placeholder="-34.603722"
                  className="w-full px-3 py-2 text-sm font-mono tabular-nums text-slate-900 bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/15"
                />
                {errors.latitud && (
                  <p className="mt-1 text-xs text-red-600">{errors.latitud}</p>
                )}
              </div>

              <div>
                <label
                  htmlFor="punto-longitud"
                  className="block text-[11px] font-medium text-slate-600 mb-1"
                >
                  Longitud (-180 a 180)
                </label>
                <input
                  id="punto-longitud"
                  type="text"
                  inputMode="decimal"
                  value={longitud}
                  onChange={(e) => {
                    setLongitud(e.target.value);
                    if (errors.longitud) setErrors((p) => ({ ...p, longitud: undefined }));
                  }}
                  onBlur={handleLngBlur}
                  placeholder="-58.381592"
                  className="w-full px-3 py-2 text-sm font-mono tabular-nums text-slate-900 bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/15"
                />
                {errors.longitud && (
                  <p className="mt-1 text-xs text-red-600">{errors.longitud}</p>
                )}
              </div>
            </div>
          </div>

          <div>
            <label
              htmlFor="punto-horario"
              className="block text-xs font-medium text-slate-700 mb-1.5"
            >
              Horario
            </label>
            <input
              id="punto-horario"
              type="text"
              value={horario}
              onChange={(e) => {
                setHorario(e.target.value);
                if (errors.horario) setErrors((p) => ({ ...p, horario: undefined }));
              }}
              placeholder="Ej. Lunes a domingos de 08:00 a 20:00"
              className="w-full px-3 py-2 text-sm text-slate-900 bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/15"
            />
            {errors.horario && (
              <p className="mt-1 text-xs text-red-600">{errors.horario}</p>
            )}
          </div>

          <div>
            <label
              htmlFor="punto-referencia"
              className="block text-xs font-medium text-slate-700 mb-1.5"
            >
              Referencia del puesto
            </label>
            <textarea
              id="punto-referencia"
              rows={2}
              value={referenciaPuesto}
              onChange={(e) => {
                setReferenciaPuesto(e.target.value);
                if (errors.referencia_puesto) {
                  setErrors((p) => ({ ...p, referencia_puesto: undefined }));
                }
              }}
              placeholder="Ej. Frente a la estación de subte, tótem verde sobre la ciclovía"
              className="w-full px-3 py-2 text-sm text-slate-900 bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/15 resize-none"
            />
            {errors.referencia_puesto && (
              <p className="mt-1 text-xs text-red-600">
                {errors.referencia_puesto}
              </p>
            )}
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-semibold text-white bg-teal-600 rounded-lg hover:bg-teal-700 disabled:opacity-60 transition-colors whitespace-nowrap shrink-0"
            >
              {isSubmitting
                ? 'Guardando...'
                : editingPunto
                ? 'Guardar cambios'
                : 'Agregar punto'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
