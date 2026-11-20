import React, { useCallback, useEffect, useState } from 'react';
import {
  APIProvider,
  Map as GoogleMap,
  AdvancedMarker,
  Pin,
  InfoWindow,
  useMap,
  useMapsLibrary,
  useAdvancedMarkerRef,
  type MapMouseEvent,
} from '@vis.gl/react-google-maps';
import { Clock, MapPin, Navigation, Crosshair } from 'lucide-react';
import type { PuntoAsistencia, TipoServicio } from '../types.ts';
import { formatServiceLabel } from '../lib/validation.ts';

interface PuntosMapProps {
  apiKey: string;
  puntos: PuntoAsistencia[];
  selectedPunto: PuntoAsistencia | null;
  isPickingOnMap: boolean;
  onSelectPunto: (punto: PuntoAsistencia) => void;
  onMapPickCoordinates: (coords: { lat: number; lng: number }) => void;
  onCancelPickOnMap: () => void;
}

const DEFAULT_CENTER = { lat: -34.597, lng: -58.403 };
const DEFAULT_ZOOM = 12;

function getPinStyle(servicio: TipoServicio, isSelected: boolean) {
  if (servicio === 'inflado') {
    return {
      background: isSelected ? '#0369A1' : '#0284C7',
      borderColor: isSelected ? '#0C4A6E' : '#0369A1',
      glyphColor: '#FFFFFF',
    };
  }
  if (servicio === 'herramientas') {
    return {
      background: isSelected ? '#B45309' : '#D97706',
      borderColor: isSelected ? '#78350F' : '#B45309',
      glyphColor: '#FFFFFF',
    };
  }
  return {
    background: isSelected ? '#0F766E' : '#0D9488',
    borderColor: isSelected ? '#134E4A' : '#0F766E',
    glyphColor: '#FFFFFF',
  };
}

interface PuntoMarkerItemProps {
  punto: PuntoAsistencia;
  isSelected: boolean;
  onSelect: (
    punto: PuntoAsistencia,
    marker: google.maps.marker.AdvancedMarkerElement
  ) => void;
  onRegisterSelectedMarker: (
    marker: google.maps.marker.AdvancedMarkerElement | null
  ) => void;
}

function PuntoMarkerItem({
  punto,
  isSelected,
  onSelect,
  onRegisterSelectedMarker,
}: PuntoMarkerItemProps) {
  const [markerRef, marker] = useAdvancedMarkerRef();
  const pinStyle = getPinStyle(punto.servicio, isSelected);

  useEffect(() => {
    if (isSelected && marker) {
      onRegisterSelectedMarker(marker);
    }
  }, [isSelected, marker, onRegisterSelectedMarker]);

  return (
    <AdvancedMarker
      ref={markerRef}
      position={{ lat: punto.latitud, lng: punto.longitud }}
      title={punto.nombre}
      zIndex={isSelected ? 1000 : 10}
      onClick={() => {
        if (marker) {
          onSelect(punto, marker);
        }
      }}
    >
      <Pin
        background={pinStyle.background}
        borderColor={pinStyle.borderColor}
        glyphColor={pinStyle.glyphColor}
        scale={isSelected ? 1.28 : 1}
      />
    </AdvancedMarker>
  );
}

interface CameraControllerProps {
  puntos: PuntoAsistencia[];
  selectedPunto: PuntoAsistencia | null;
  fitAllTrigger: number;
}

function CameraController({
  puntos,
  selectedPunto,
  fitAllTrigger,
}: CameraControllerProps) {
  const map = useMap();
  const coreLib = useMapsLibrary('core');

  useEffect(() => {
    if (!map || !selectedPunto) return;
    map.panTo({ lat: selectedPunto.latitud, lng: selectedPunto.longitud });
    const currentZoom = map.getZoom();
    if (!currentZoom || currentZoom < 14) {
      map.setZoom(15);
    }
  }, [map, selectedPunto]);

  useEffect(() => {
    if (!map || !coreLib || fitAllTrigger === 0 || puntos.length === 0) return;
    if (puntos.length === 1) {
      map.panTo({ lat: puntos[0].latitud, lng: puntos[0].longitud });
      map.setZoom(15);
      return;
    }
    const bounds = new coreLib.LatLngBounds();
    puntos.forEach((p) => {
      bounds.extend({ lat: p.latitud, lng: p.longitud });
    });
    map.fitBounds(bounds, 72);
  }, [map, coreLib, fitAllTrigger, puntos]);

  return null;
}

export function PuntosMap({
  apiKey,
  puntos,
  selectedPunto,
  isPickingOnMap,
  onSelectPunto,
  onMapPickCoordinates,
  onCancelPickOnMap,
}: PuntosMapProps) {
  const [selectedMarker, setSelectedMarker] =
    useState<google.maps.marker.AdvancedMarkerElement | null>(null);
  const [infoWindowOpen, setInfoWindowOpen] = useState(true);
  const [fitAllTrigger, setFitAllTrigger] = useState(0);

  useEffect(() => {
    if (selectedPunto) {
      setInfoWindowOpen(true);
    } else {
      setSelectedMarker(null);
      setInfoWindowOpen(false);
    }
  }, [selectedPunto?.id]);

  const handleMarkerClick = useCallback(
    (
      punto: PuntoAsistencia,
      marker: google.maps.marker.AdvancedMarkerElement
    ) => {
      setSelectedMarker(marker);
      setInfoWindowOpen(true);
      onSelectPunto(punto);
    },
    [onSelectPunto]
  );

  const handleMapClick = useCallback(
    (ev: MapMouseEvent) => {
      if (!isPickingOnMap) return;
      const latLng = ev.detail.latLng;
      if (!latLng) return;
      onMapPickCoordinates({
        lat: Number(latLng.lat.toFixed(6)),
        lng: Number(latLng.lng.toFixed(6)),
      });
    },
    [isPickingOnMap, onMapPickCoordinates]
  );

  if (!apiKey) {
    return (
      <div className="w-full h-full min-h-[420px] flex flex-col items-center justify-center bg-slate-100 border border-slate-200 rounded-xl p-8 text-center">
        <MapPin className="w-8 h-8 text-slate-400 mb-3" />
        <h3 className="text-sm font-semibold text-slate-900">
          Mapa no disponible en este entorno
        </h3>
        <p className="text-xs text-slate-600 mt-1 max-w-sm">
          Configurá la variable de entorno <code className="font-mono">VITE_GOOGLE_MAPS_API_KEY</code> para renderizar el mapa interactivo.
        </p>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full min-h-[420px] rounded-xl overflow-hidden border border-slate-200 bg-slate-100">
      <APIProvider apiKey={apiKey} libraries={['marker']} language="es" region="AR">
        <GoogleMap
          mapId="DEMO_MAP_ID"
          internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
          defaultCenter={DEFAULT_CENTER}
          defaultZoom={DEFAULT_ZOOM}
          gestureHandling="greedy"
          mapTypeControl={false}
          streetViewControl={false}
          fullscreenControl={true}
          onClick={handleMapClick}
          className={`w-full h-full ${isPickingOnMap ? 'cursor-crosshair' : ''}`}
        >
          <CameraController
            puntos={puntos}
            selectedPunto={selectedPunto}
            fitAllTrigger={fitAllTrigger}
          />

          {puntos.map((punto) => (
            <PuntoMarkerItem
              key={punto.id}
              punto={punto}
              isSelected={selectedPunto?.id === punto.id}
              onSelect={handleMarkerClick}
              onRegisterSelectedMarker={setSelectedMarker}
            />
          ))}

          {selectedPunto && selectedMarker && infoWindowOpen && (
            <InfoWindow
              anchor={selectedMarker}
              pixelOffset={[0, -6]}
              maxWidth={280}
              onCloseClick={() => setInfoWindowOpen(false)}
            >
              <div className="p-1 text-slate-900">
                <p className="font-display text-sm font-semibold text-slate-950 leading-snug">
                  {selectedPunto.nombre}
                </p>
                <p className="text-xs font-medium text-teal-700 mt-0.5">
                  {formatServiceLabel(selectedPunto.servicio)} · {selectedPunto.horario}
                </p>
                <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                  {selectedPunto.referencia_puesto}
                </p>
                <p className="text-[11px] font-mono tabular-nums text-slate-500 mt-1.5 pt-1.5 border-t border-slate-100">
                  {selectedPunto.latitud.toFixed(6)}, {selectedPunto.longitud.toFixed(6)}
                </p>
              </div>
            </InfoWindow>
          )}
        </GoogleMap>
      </APIProvider>

      {isPickingOnMap && (
        <div className="absolute top-3 left-3 right-3 z-20 flex items-center justify-between gap-3 bg-slate-900 text-white px-4 py-2.5 rounded-lg shadow-lg">
          <div className="flex items-center gap-2 text-xs font-medium">
            <Crosshair className="w-4 h-4 text-teal-400 shrink-0" />
            <span>
              Hacé clic en el mapa para fijar la latitud y longitud en grados decimales.
            </span>
          </div>
          <button
            type="button"
            onClick={onCancelPickOnMap}
            className="px-3 py-1 text-xs font-medium bg-slate-700 hover:bg-slate-600 rounded-md transition-colors whitespace-nowrap shrink-0"
          >
            Cancelar
          </button>
        </div>
      )}

      {!isPickingOnMap && puntos.length > 0 && (
        <button
          type="button"
          onClick={() => setFitAllTrigger((n) => n + 1)}
          className="absolute top-3 left-3 z-10 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-800 bg-white/95 hover:bg-white border border-slate-200 rounded-lg shadow-sm transition-colors whitespace-nowrap shrink-0"
        >
          <Navigation className="w-3.5 h-3.5 text-teal-600" />
          Ver todos los puntos
        </button>
      )}

      {!isPickingOnMap && selectedPunto && (
        <div className="absolute bottom-3 left-3 right-3 sm:right-auto sm:max-w-sm z-10 bg-white/95 backdrop-blur-xs border border-slate-200 rounded-xl p-3.5 shadow-md">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-slate-900 truncate">
                {selectedPunto.nombre}
              </h3>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-600 mt-1">
                <span className="font-medium text-teal-700">
                  {formatServiceLabel(selectedPunto.servicio)}
                </span>
                <span aria-hidden="true">·</span>
                <span className="inline-flex items-center gap-1">
                  <Clock className="w-3 h-3 text-slate-400" />
                  {selectedPunto.horario}
                </span>
              </div>
              <p className="text-xs text-slate-600 mt-1.5 line-clamp-2">
                {selectedPunto.referencia_puesto}
              </p>
              <p className="text-[11px] font-mono tabular-nums text-slate-500 mt-1.5">
                Lat {selectedPunto.latitud.toFixed(6)} · Lng {selectedPunto.longitud.toFixed(6)}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
