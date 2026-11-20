export type TipoServicio = 'inflado' | 'herramientas' | 'ambos';

export type FiltroServicio = 'todos' | 'inflado' | 'herramientas';

export interface PuntoAsistencia {
  id: string;
  nombre: string;
  latitud: number;
  longitud: number;
  servicio: TipoServicio;
  horario: string;
  referencia_puesto: string;
  created_at?: string;
  updated_at?: string;
}

export interface PuntoPayload {
  nombre: string;
  latitud: number;
  longitud: number;
  servicio: TipoServicio;
  horario: string;
  referencia_puesto: string;
}
