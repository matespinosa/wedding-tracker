import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  BookmarkIcon,
  CalendarIcon,
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ClockIcon,
  GearIcon,
  HomeIcon,
  ListBulletIcon,
  BackpackIcon,
  FileTextIcon,
  MagicWandIcon,
  MagnifyingGlassIcon,
  MixerHorizontalIcon,
  PersonIcon,
  PlusIcon,
  ReloadIcon,
  ReaderIcon,
  SpeakerLoudIcon,
  StopwatchIcon,
} from "@radix-ui/react-icons";
import "@fontsource/instrument-serif/400.css";
import "@fontsource/instrument-sans/400.css";
import "@fontsource/instrument-sans/500.css";
import "@fontsource/instrument-sans/600.css";
import { useShell } from "./shell";

type Section = "Iglesia" | "Recepción" | "General";
type Screen = "Resumen" | Section | "Invitados";
type Responsible = "Novio" | "Novia" | "Ambos";
type TaskStatus = "Pendiente" | "En progreso" | "Bloqueado" | "Listo";
type GuestStatus = "Pendiente" | "Confirmado" | "No asiste";
type Transport = "Uber" | "Interno" | "Propio" | "Por definir";
type Meal = "Pollo" | "Carne";

type Task = {
  id: string;
  seccion: Section;
  titulo: string;
  detalle: string;
  responsable: Responsible;
  estado: TaskStatus;
  prioridad: "Alta" | "Media" | "Baja";
  fecha_limite?: string;
};

type GuestGroup = {
  id: string;
  nombre: string;
  personas: number;
  invitado_a: "Iglesia" | "Recepción" | "Ambas";
  rsvp: GuestStatus;
  transporte: Transport;
  plato?: Meal;
  fuente?: "formulario" | "lista" | "invitacion" | "tracker";
  actualizado?: string;
};

type CorteRol = "Dama de la corte" | "Caballero de la corte" | "Testigo" | "Pajecito";
type ChurchTab = "Ceremonia" | "Corte ceremonial";

type CortePerson = {
  id: string;
  nombre: string;
  rol: CorteRol;
  confirmado: "Sí" | "No";
  telefono?: string;
  notas?: string;
};

type LogisticsItem = {
  clave: string;
  titulo: string;
  valor: string;
  estado: TaskStatus;
  responsable: Responsible;
  notas?: string;
  fecha_limite?: string;
};

type Settings = {
  weddingDate: string;
  apiUrl: string;
  token: string;
};

type PendingMutation = {
  hoja: "Config" | "Tareas" | "Invitados" | "Corte" | "Iglesia" | "Recepcion";
  payload: Record<string, unknown>;
};

type SheetResponse = {
  ok?: boolean;
  error?: string;
  Config?: Array<Record<string, unknown>>;
  Tareas?: Task[];
  Invitados?: Array<Record<string, unknown>>;
  Corte?: Array<Record<string, unknown>>;
  Iglesia?: Array<Record<string, unknown>>;
  Recepcion?: Array<Record<string, unknown>>;
  "Recepción"?: Array<Record<string, unknown>>;
};

const DEFAULT_WEDDING_DATE = "2026-10-03";
const WEDDING_TIME = "11:00 a.m.";
const STORAGE_KEY = "nuestra-boda-v3";
const QUEUE_KEY = "nuestra-boda-queue-v1";

// Conexión por defecto: nadie tiene que teclear nada. La lectura del Web App es
// pública (doGet no pide token); el token solo hace falta para escribir y se
// inyecta en el build desde el secret SHEET_TOKEN de GitHub.
const DEFAULT_API_URL = import.meta.env.VITE_SHEET_API_URL ?? "https://script.google.com/macros/s/AKfycby00XguFKlZ5awiyhvNAQM5XJACj5JURm2l6kZ3p4c7vajVOcGCsuueG-2mTEY7mT6zyA/exec";
const DEFAULT_TOKEN = import.meta.env.VITE_SHEET_TOKEN ?? "";
// CSV de la pestaña Tracker_Version publicada en la web: una sola celda con un
// número que sube en cada cambio. Sondearla es mucho más barato que traer todo
// el JSON, y no consume cuota de Apps Script.
const VERSION_CSV_URL = import.meta.env.VITE_SHEET_VERSION_URL ?? "https://docs.google.com/spreadsheets/d/e/2PACX-1vTvgdoCsoncP_vBhiTamymySUh7kY36Vs4UTUR8zXqlaRGmN9V1X7FSOX8knbdrCO4f8ZzUbcRoI6Ks/pub?gid=352088950&single=true&output=csv";
const VERSION_POLL_MS = 12_000;
const FULL_SYNC_MS = 5 * 60_000;
const CORTE_ROLES: CorteRol[] = ["Dama de la corte", "Caballero de la corte", "Testigo", "Pajecito"];

const initialTasks: Task[] = [
  { id: "ig-1", seccion: "Iglesia", titulo: "Damas y caballeros de la corte", detalle: "Confirmar nombres en Tracker_Corte", responsable: "Novia", estado: "Pendiente", prioridad: "Alta" },
  { id: "ig-2", seccion: "Iglesia", titulo: "Decoración de la iglesia", detalle: "Confirmada con la parroquia", responsable: "Novia", estado: "Listo", prioridad: "Media" },
  { id: "ig-3", seccion: "Iglesia", titulo: "Testigos", detalle: "Documentos entregados", responsable: "Ambos", estado: "Listo", prioridad: "Alta" },
  { id: "ig-4", seccion: "Iglesia", titulo: "Pajecitos", detalle: "Falta confirmar con los papás", responsable: "Novia", estado: "Pendiente", prioridad: "Media" },
  { id: "ig-5", seccion: "Iglesia", titulo: "Carro de los novios", detalle: "Sin cotizar", responsable: "Novio", estado: "Pendiente", prioridad: "Media" },
  { id: "ig-6", seccion: "Iglesia", titulo: "Fotógrafa confirmada", detalle: "Cobertura de la ceremonia", responsable: "Ambos", estado: "Listo", prioridad: "Alta" },
  { id: "ig-7", seccion: "Iglesia", titulo: "Protocolo de la iglesia", detalle: "Pedirlo en la parroquia", responsable: "Ambos", estado: "Pendiente", prioridad: "Alta" },
  { id: "ig-8", seccion: "Iglesia", titulo: "Lista de invitados a la iglesia", detalle: "Revisar cupos y confirmaciones", responsable: "Ambos", estado: "Pendiente", prioridad: "Alta" },
  { id: "rec-1", seccion: "Recepción", titulo: "DJ, equipo y staff", detalle: "Confirmar montaje y horarios", responsable: "Novio", estado: "Pendiente", prioridad: "Alta" },
  { id: "rec-2", seccion: "Recepción", titulo: "Fotógrafa de recepción", detalle: "Invitada y staff incluidos", responsable: "Ambos", estado: "Listo", prioridad: "Alta" },
  { id: "rec-3", seccion: "Recepción", titulo: "Transporte de invitados", detalle: "Definir Uber o transporte interno", responsable: "Novio", estado: "Pendiente", prioridad: "Media" },
  { id: "rec-4", seccion: "Recepción", titulo: "Confirmación de invitados", detalle: "Se lee en vivo del formulario de la invitación", responsable: "Ambos", estado: "En progreso", prioridad: "Alta" },
  { id: "rec-5", seccion: "Recepción", titulo: "Contrato y cotización final", detalle: "Esperando respuesta del salón", responsable: "Ambos", estado: "Pendiente", prioridad: "Alta", fecha_limite: "2026-09-07" },
  { id: "gen-1", seccion: "General", titulo: "Fechas del traje del novio", detalle: "Agendar prueba final", responsable: "Novio", estado: "Pendiente", prioridad: "Media" },
  { id: "gen-2", seccion: "General", titulo: "Fechas del vestido de la novia", detalle: "Confirmar última prueba", responsable: "Novia", estado: "Pendiente", prioridad: "Alta" },
  { id: "gen-3", seccion: "General", titulo: "Hotel de noche de bodas", detalle: "Revisar opciones y reservar", responsable: "Ambos", estado: "Pendiente", prioridad: "Media" },
];

const initialGuests: GuestGroup[] = [
  { id: "g-001", nombre: "Gladys Saenz", personas: 1, invitado_a: "Recepción", rsvp: "Confirmado", transporte: "Por definir", plato: "Carne", actualizado: "Hoy" },
  { id: "g-002", nombre: "Julio Escobar", personas: 1, invitado_a: "Recepción", rsvp: "Confirmado", transporte: "Por definir", plato: "Pollo", actualizado: "Hoy" },
  { id: "g-003", nombre: "Diana Saenz", personas: 1, invitado_a: "Recepción", rsvp: "Confirmado", transporte: "Por definir", plato: "Pollo", actualizado: "Hoy" },
  { id: "g-004", nombre: "Nicolas Tellez", personas: 1, invitado_a: "Recepción", rsvp: "Confirmado", transporte: "Por definir", plato: "Carne", actualizado: "Hoy" },
  { id: "g-005", nombre: "Jessica calderon", personas: 1, invitado_a: "Recepción", rsvp: "Confirmado", transporte: "Por definir", plato: "Carne", actualizado: "Hoy" },
  { id: "g-006", nombre: "Daniel Saenz", personas: 1, invitado_a: "Recepción", rsvp: "Confirmado", transporte: "Por definir", plato: "Carne", actualizado: "Hoy" },
  { id: "g-007", nombre: "Rigoberto Saenz", personas: 1, invitado_a: "Recepción", rsvp: "Confirmado", transporte: "Por definir", plato: "Carne", actualizado: "Hoy" },
  { id: "g-008", nombre: "Carolina Escandon", personas: 1, invitado_a: "Recepción", rsvp: "Confirmado", transporte: "Por definir", plato: "Pollo", actualizado: "Hoy" },
  { id: "g-009", nombre: "Luis Ortiz", personas: 1, invitado_a: "Recepción", rsvp: "Confirmado", transporte: "Por definir", plato: "Carne", actualizado: "Hoy" },
  { id: "g-010", nombre: "Maria Gordillo", personas: 1, invitado_a: "Recepción", rsvp: "Confirmado", transporte: "Por definir", plato: "Pollo", actualizado: "Hoy" },
  { id: "g-011", nombre: "Juan David Ortiz", personas: 1, invitado_a: "Recepción", rsvp: "Confirmado", transporte: "Por definir", plato: "Carne", actualizado: "Hoy" },
  { id: "g-012", nombre: "Elizabeth Ortiz", personas: 1, invitado_a: "Recepción", rsvp: "Confirmado", transporte: "Por definir", plato: "Carne", actualizado: "Hoy" },
  { id: "g-013", nombre: "Miguel Saenz", personas: 1, invitado_a: "Recepción", rsvp: "Confirmado", transporte: "Por definir", plato: "Carne", actualizado: "Hoy" },
  { id: "g-014", nombre: "Valentina Marulanda", personas: 1, invitado_a: "Recepción", rsvp: "Confirmado", transporte: "Por definir", plato: "Carne", actualizado: "Hoy" },
  { id: "g-015", nombre: "Sandra Garcia", personas: 1, invitado_a: "Recepción", rsvp: "Confirmado", transporte: "Por definir", plato: "Carne", actualizado: "Hoy" },
  { id: "g-016", nombre: "Alicia Garcia", personas: 1, invitado_a: "Recepción", rsvp: "Confirmado", transporte: "Por definir", plato: "Pollo", actualizado: "Hoy" },
  { id: "g-017", nombre: "Andrea Saenz", personas: 1, invitado_a: "Recepción", rsvp: "Confirmado", transporte: "Por definir", plato: "Carne", actualizado: "Hoy" },
  { id: "g-018", nombre: "Jose Saenz", personas: 1, invitado_a: "Recepción", rsvp: "Confirmado", transporte: "Por definir", plato: "Carne", actualizado: "Hoy" },
  { id: "g-019", nombre: "Sebastian Marulanda", personas: 1, invitado_a: "Recepción", rsvp: "Confirmado", transporte: "Por definir", plato: "Carne", actualizado: "Hoy" },
  { id: "g-020", nombre: "Luisa Fernanda", personas: 1, invitado_a: "Recepción", rsvp: "Confirmado", transporte: "Por definir", plato: "Carne", actualizado: "Hoy" },
  { id: "g-021", nombre: "Daniela Quintero", personas: 1, invitado_a: "Recepción", rsvp: "Confirmado", transporte: "Por definir", plato: "Carne", actualizado: "Hoy" },
  { id: "g-022", nombre: "Marina Quintero", personas: 1, invitado_a: "Recepción", rsvp: "Confirmado", transporte: "Por definir", plato: "Carne", actualizado: "Hoy" },
  { id: "g-023", nombre: "Samuel Quintero", personas: 1, invitado_a: "Recepción", rsvp: "Confirmado", transporte: "Por definir", plato: "Carne", actualizado: "Hoy" },
  { id: "g-024", nombre: "Daniel Quiñones", personas: 1, invitado_a: "Recepción", rsvp: "Confirmado", transporte: "Por definir", plato: "Carne", actualizado: "Hoy" },
  { id: "g-025", nombre: "Jessica saenz", personas: 1, invitado_a: "Recepción", rsvp: "Confirmado", transporte: "Por definir", plato: "Carne", actualizado: "Hoy" },
  { id: "g-026", nombre: "Sara Cubillos", personas: 1, invitado_a: "Recepción", rsvp: "Confirmado", transporte: "Por definir", plato: "Carne", actualizado: "Hoy" },
  { id: "g-027", nombre: "Alejandra Cubillos", personas: 1, invitado_a: "Recepción", rsvp: "Confirmado", transporte: "Por definir", plato: "Carne", actualizado: "Hoy" },
  { id: "g-028", nombre: "Cristian Arevalo", personas: 1, invitado_a: "Recepción", rsvp: "Confirmado", transporte: "Por definir", plato: "Carne", actualizado: "Hoy" },
  { id: "g-029", nombre: "Karen Gomez", personas: 1, invitado_a: "Recepción", rsvp: "Confirmado", transporte: "Por definir", plato: "Carne", actualizado: "Hoy" },
  { id: "g-030", nombre: "Adriana Cubillos", personas: 1, invitado_a: "Recepción", rsvp: "Confirmado", transporte: "Por definir", plato: "Carne", actualizado: "Hoy" },
  { id: "g-031", nombre: "Sabine Borie Cubillos", personas: 1, invitado_a: "Recepción", rsvp: "Confirmado", transporte: "Por definir", plato: "Carne", actualizado: "Hoy" },
  { id: "g-032", nombre: "Camila Sanchez", personas: 1, invitado_a: "Recepción", rsvp: "Confirmado", transporte: "Por definir", plato: "Pollo", actualizado: "Hoy" },
  { id: "g-033", nombre: "Nicolas Moreno", personas: 1, invitado_a: "Recepción", rsvp: "Confirmado", transporte: "Por definir", plato: "Carne", actualizado: "Hoy" },
  { id: "g-034", nombre: "Liliana Cubillos", personas: 1, invitado_a: "Recepción", rsvp: "Confirmado", transporte: "Por definir", plato: "Pollo", actualizado: "Hoy" },
  { id: "g-035", nombre: "Fernanda Herrera", personas: 1, invitado_a: "Recepción", rsvp: "Confirmado", transporte: "Por definir", plato: "Pollo", actualizado: "Hoy" },
  { id: "g-036", nombre: "Miguel Angel Borie Cubillos", personas: 1, invitado_a: "Recepción", rsvp: "Confirmado", transporte: "Por definir", plato: "Carne", actualizado: "Hoy" },
  { id: "g-037", nombre: "Dayana Pineda", personas: 1, invitado_a: "Recepción", rsvp: "Confirmado", transporte: "Por definir", plato: "Pollo", actualizado: "Hoy" },
  { id: "g-038", nombre: "Carmen Saenz", personas: 1, invitado_a: "Recepción", rsvp: "Confirmado", transporte: "Por definir", plato: "Pollo", actualizado: "Hoy" },
  { id: "g-039", nombre: "Rosita Saenz", personas: 1, invitado_a: "Recepción", rsvp: "Confirmado", transporte: "Por definir", plato: "Carne", actualizado: "Hoy" },
  { id: "g-040", nombre: "Javier Tellez", personas: 1, invitado_a: "Recepción", rsvp: "Confirmado", transporte: "Por definir", plato: "Carne", actualizado: "Hoy" },
  { id: "g-041", nombre: "Daniela Sanchez", personas: 1, invitado_a: "Recepción", rsvp: "Confirmado", transporte: "Por definir", plato: "Pollo", actualizado: "Hoy" },
  { id: "g-042", nombre: "Bonifacio Saenz", personas: 1, invitado_a: "Recepción", rsvp: "Confirmado", transporte: "Por definir", plato: "Pollo", actualizado: "Hoy" },
  { id: "g-043", nombre: "Dora Murcia", personas: 1, invitado_a: "Recepción", rsvp: "Confirmado", transporte: "Por definir", plato: "Pollo", actualizado: "Hoy" },
  { id: "g-044", nombre: "Paty Santana", personas: 1, invitado_a: "Recepción", rsvp: "Confirmado", transporte: "Por definir", plato: "Carne", actualizado: "Hoy" },
  { id: "g-045", nombre: "Diana Guzman", personas: 1, invitado_a: "Recepción", rsvp: "Confirmado", transporte: "Por definir", plato: "Carne", actualizado: "Hoy" },
  { id: "g-046", nombre: "Saray Gordillo", personas: 1, invitado_a: "Recepción", rsvp: "Confirmado", transporte: "Por definir", plato: "Pollo", actualizado: "Hoy" },
  { id: "g-047", nombre: "Martin Gordillo", personas: 1, invitado_a: "Recepción", rsvp: "Confirmado", transporte: "Por definir", plato: "Carne", actualizado: "Hoy" },
  { id: "g-048", nombre: "Pablito Gordillo", personas: 1, invitado_a: "Recepción", rsvp: "Confirmado", transporte: "Por definir", plato: "Pollo", actualizado: "Hoy" },
  { id: "g-049", nombre: "Giovany Gordillo", personas: 1, invitado_a: "Recepción", rsvp: "Confirmado", transporte: "Por definir", plato: "Carne", actualizado: "Hoy" },
  { id: "g-050", nombre: "Javier Ortiz", personas: 1, invitado_a: "Recepción", rsvp: "Confirmado", transporte: "Por definir", plato: "Pollo", actualizado: "Hoy" },
  { id: "g-051", nombre: "Clarena Gómez", personas: 1, invitado_a: "Recepción", rsvp: "Confirmado", transporte: "Por definir", plato: "Pollo", actualizado: "Hoy" },
  { id: "g-052", nombre: "Raul Borie", personas: 1, invitado_a: "Recepción", rsvp: "Confirmado", transporte: "Por definir", plato: "Pollo", actualizado: "Hoy" },
  { id: "g-053", nombre: "Rosa Julieth Saenz Alarcon", personas: 1, invitado_a: "Recepción", rsvp: "Confirmado", transporte: "Por definir", plato: "Carne", actualizado: "Hoy" },
  { id: "g-054", nombre: "Mateo Espinosa Cubillos", personas: 1, invitado_a: "Recepción", rsvp: "Confirmado", transporte: "Por definir", plato: "Pollo", actualizado: "Hoy" },
  { id: "g-055", nombre: "Nicolas Riveros", personas: 1, invitado_a: "Recepción", rsvp: "Confirmado", transporte: "Por definir", plato: "Carne", actualizado: "Hoy" },
  { id: "g-056", nombre: "Viviana Saenz", personas: 1, invitado_a: "Recepción", rsvp: "Confirmado", transporte: "Por definir", plato: "Carne", actualizado: "Hoy" },
  { id: "g-057", nombre: "Ricardo Alarcon", personas: 1, invitado_a: "Recepción", rsvp: "Confirmado", transporte: "Por definir", plato: "Carne", actualizado: "Hoy" },
  { id: "g-058", nombre: "Luz Dary Romero", personas: 1, invitado_a: "Recepción", rsvp: "Confirmado", transporte: "Por definir", plato: "Pollo", actualizado: "Hoy" },
  { id: "g-059", nombre: "Santiago Alarcon", personas: 1, invitado_a: "Recepción", rsvp: "Confirmado", transporte: "Por definir", plato: "Carne", actualizado: "Hoy" },
  { id: "g-060", nombre: "Deibby Saenz", personas: 1, invitado_a: "Recepción", rsvp: "Confirmado", transporte: "Por definir", plato: "Carne", actualizado: "Hoy" },
  { id: "g-061", nombre: "Luis Mendoza", personas: 1, invitado_a: "Recepción", rsvp: "Confirmado", transporte: "Por definir", plato: "Pollo", actualizado: "Hoy" },
  { id: "g-062", nombre: "Maribel Marin", personas: 1, invitado_a: "Recepción", rsvp: "Confirmado", transporte: "Por definir", plato: "Pollo", actualizado: "Hoy" },
  { id: "g-063", nombre: "Vicente Quintero", personas: 1, invitado_a: "Recepción", rsvp: "Confirmado", transporte: "Por definir", plato: "Carne", actualizado: "Hoy" },
  { id: "g-064", nombre: "Blanca Quintero", personas: 1, invitado_a: "Recepción", rsvp: "Confirmado", transporte: "Por definir", plato: "Pollo", actualizado: "Hoy" },
  { id: "g-065", nombre: "Nubia Gordillo", personas: 1, invitado_a: "Recepción", rsvp: "Confirmado", transporte: "Por definir", plato: "Carne", actualizado: "Hoy" },
  { id: "g-066", nombre: "Sebastian Rojas", personas: 1, invitado_a: "Recepción", rsvp: "Confirmado", transporte: "Por definir", plato: "Carne", actualizado: "Hoy" },
  { id: "g-067", nombre: "Santiago Rojas", personas: 1, invitado_a: "Recepción", rsvp: "Confirmado", transporte: "Por definir", plato: "Pollo", actualizado: "Hoy" },
  { id: "g-068", nombre: "Lucho Rojas", personas: 1, invitado_a: "Recepción", rsvp: "Confirmado", transporte: "Por definir", plato: "Pollo", actualizado: "Hoy" },
  { id: "g-069", nombre: "Dona Cecilia Gordillo", personas: 1, invitado_a: "Recepción", rsvp: "Confirmado", transporte: "Por definir", plato: "Pollo", actualizado: "Hoy" },
  { id: "g-070", nombre: "Juan David Velasquez", personas: 1, invitado_a: "Recepción", rsvp: "Confirmado", transporte: "Por definir", plato: "Carne", actualizado: "Hoy" },
  { id: "g-071", nombre: "Elias Nassar", personas: 1, invitado_a: "Recepción", rsvp: "Confirmado", transporte: "Por definir", plato: "Carne", actualizado: "Hoy" },
  { id: "g-072", nombre: "Giovany Saenz", personas: 1, invitado_a: "Recepción", rsvp: "Confirmado", transporte: "Por definir", plato: "Carne", actualizado: "Hoy" },
  { id: "g-073", nombre: "German Saenz", personas: 1, invitado_a: "Recepción", rsvp: "Confirmado", transporte: "Por definir", plato: "Carne", actualizado: "Hoy" },
  { id: "g-074", nombre: "Marlen Murcia", personas: 1, invitado_a: "Recepción", rsvp: "Confirmado", transporte: "Por definir", plato: "Pollo", actualizado: "Hoy" },
  { id: "g-075", nombre: "Samuel Saenz", personas: 1, invitado_a: "Recepción", rsvp: "Confirmado", transporte: "Por definir", plato: "Carne", actualizado: "Hoy" },
  { id: "g-076", nombre: "Francisco Valencia", personas: 1, invitado_a: "Recepción", rsvp: "Confirmado", transporte: "Por definir", plato: "Pollo", actualizado: "Hoy" },
];

const initialCorte: CortePerson[] = [
  { id: "corte-dama-1", nombre: "", rol: "Dama de la corte", confirmado: "No" },
  { id: "corte-dama-2", nombre: "", rol: "Dama de la corte", confirmado: "No" },
  { id: "corte-dama-3", nombre: "", rol: "Dama de la corte", confirmado: "No" },
  { id: "corte-dama-4", nombre: "", rol: "Dama de la corte", confirmado: "No" },
  { id: "corte-cab-1", nombre: "", rol: "Caballero de la corte", confirmado: "No" },
  { id: "corte-cab-2", nombre: "", rol: "Caballero de la corte", confirmado: "No" },
  { id: "corte-cab-3", nombre: "", rol: "Caballero de la corte", confirmado: "No" },
  { id: "corte-cab-4", nombre: "", rol: "Caballero de la corte", confirmado: "No" },
  { id: "corte-testigo-1", nombre: "", rol: "Testigo", confirmado: "Sí", notas: "Documentos entregados" },
  { id: "corte-testigo-2", nombre: "", rol: "Testigo", confirmado: "Sí", notas: "Documentos entregados" },
  { id: "corte-paje-1", nombre: "", rol: "Pajecito", confirmado: "No", notas: "Falta confirmar con los papás" },
  { id: "corte-paje-2", nombre: "", rol: "Pajecito", confirmado: "No", notas: "Falta confirmar con los papás" },
];

const initialIglesia: LogisticsItem[] = [
  { clave: "hora_ceremonia", titulo: "Hora de la ceremonia", valor: "11:00 a.m. – 12:30 p.m.", estado: "Listo", responsable: "Ambos", notas: "Ceremonia en la iglesia" },
  { clave: "oficiante", titulo: "Oficiante", valor: "Hermano Jairo Cardozo", estado: "Listo", responsable: "Ambos", notas: "Encargado de dirigir la ceremonia" },
  { clave: "decoracion", titulo: "Decoración", valor: "Ana Cubillos", estado: "En progreso", responsable: "Novia", notas: "A cargo de la decoración con ayuda de mamá" },
  { clave: "protocolo", titulo: "Checklist del protocolo", valor: "Pendiente de completar", estado: "Pendiente", responsable: "Ambos", notas: "Revisar el protocolo solicitado por la iglesia" },
  { clave: "fotografia", titulo: "Checklist de fotografías", valor: "Checklist listo", estado: "Listo", responsable: "Ambos", notas: "Fotografías clave de la ceremonia en la iglesia" },
  { clave: "carro", titulo: "Checklist del carro de los novios", valor: "Pendiente por definir", estado: "Pendiente", responsable: "Novio", notas: "Confirmar carro, conductor, decoración y hora de llegada" },
  { clave: "lugar", titulo: "Lugar de la iglesia", valor: "Por confirmar", estado: "Pendiente", responsable: "Ambos" },
  { clave: "musica", titulo: "Música de la ceremonia", valor: "Canciones y músicos", estado: "Pendiente", responsable: "Ambos" },
];

const initialRecepcion: LogisticsItem[] = [
  { clave: "hora_recepcion", titulo: "Hora de la recepción", valor: "5:00 p.m. – 11:00 p.m.", estado: "Listo", responsable: "Ambos", notas: "Ingreso de invitados, cena y celebración." },
  { clave: "lugar", titulo: "Lugar de la recepción", valor: "Por confirmar", estado: "Pendiente", responsable: "Ambos", notas: "Dirección, salón y punto de llegada por cerrar." },
  { clave: "fotografia", titulo: "Fotografía de recepción", valor: "Invitada y staff incluidos", estado: "Listo", responsable: "Ambos", notas: "Cobertura durante la recepción y el baile." },
  { clave: "dj", titulo: "DJ, equipo y staff", valor: "Montaje y horarios por confirmar", estado: "Pendiente", responsable: "Novio", notas: "Confirmar montaje, horas de servicio y requerimientos técnicos." },
  { clave: "itinerario", titulo: "Itinerario", valor: "Horarios y responsables por definir", estado: "Pendiente", responsable: "Ambos", notas: "Recepción 5:00 p.m. · cena · baile · cierre 11:00 p.m." },
  { clave: "baile", titulo: "Información del baile", valor: "Primer baile por elegir", estado: "Pendiente", responsable: "Ambos", notas: "Definir canción, ensayo y momento dentro del itinerario." },
  { clave: "transporte", titulo: "Transporte de invitados", valor: "Uber o transporte interno", estado: "Pendiente", responsable: "Novio", notas: "Definir quién necesita traslado y los horarios de regreso." },
  { clave: "contrato", titulo: "Contrato y cotización final", valor: "Esperando respuesta del salón", estado: "Pendiente", responsable: "Ambos", notas: "Revisar versión final, pagos incluidos y fecha límite.", fecha_limite: "2026-09-07" },
];

function emptySettings(): Settings {
  return { weddingDate: DEFAULT_WEDDING_DATE, apiUrl: "", token: "" };
}

function loadInitialState() {
  const fallback = { tasks: initialTasks, guests: initialGuests, corte: initialCorte, iglesia: initialIglesia, recepcion: initialRecepcion, settings: emptySettings() };
  if (typeof window === "undefined") return fallback;

  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (!saved) throw new Error("No saved data");
    const parsed = JSON.parse(saved) as { tasks?: Task[]; guests?: GuestGroup[]; corte?: CortePerson[]; iglesia?: LogisticsItem[]; recepcion?: LogisticsItem[]; settings?: Settings };
    return {
      tasks: parsed.tasks?.length ? parsed.tasks : initialTasks,
      guests: parsed.guests?.length ? parsed.guests : initialGuests,
      corte: parsed.corte?.length ? parsed.corte : initialCorte,
      iglesia: mapLogistics(parsed.iglesia, initialIglesia),
      recepcion: mapLogistics(parsed.recepcion, initialRecepcion),
      settings: { ...emptySettings(), ...parsed.settings, weddingDate: parsed.settings?.weddingDate || DEFAULT_WEDDING_DATE },
    };
  } catch {
    return fallback;
  }
}

function peopleCount(groups: GuestGroup[], status?: GuestStatus) {
  return groups
    .filter((group) => (status ? group.rsvp === status : true))
    .reduce((total, group) => total + group.personas, 0);
}

function parsePlato(value: unknown): Meal | undefined {
  return value === "Pollo" || value === "Carne" ? value : undefined;
}

function parseStatus(value: unknown): TaskStatus {
  return value === "En progreso" || value === "Bloqueado" || value === "Listo" ? value : "Pendiente";
}

function parseResponsible(value: unknown): Responsible {
  return value === "Novio" || value === "Novia" ? value : "Ambos";
}

function parseRol(value: unknown): CorteRol {
  const raw = String(value ?? "");
  if (raw === "Caballero de la corte" || raw === "Caballero") return "Caballero de la corte";
  if (raw === "Testigo") return "Testigo";
  if (raw === "Pajecito") return "Pajecito";
  return "Dama de la corte";
}

function parseFuente(value: unknown): GuestGroup["fuente"] {
  return value === "formulario" || value === "lista" || value === "invitacion" || value === "tracker" ? value : undefined;
}

function mapLogistics(rows: Array<Record<string, unknown>> | undefined, fallback: LogisticsItem[]) {
  if (!Array.isArray(rows)) return fallback;
  if (!rows.length) return [];
  const mapped = rows.map((row, index) => ({
    clave: String(row.clave ?? `item-${index}`),
    titulo: String(row.titulo ?? row.clave ?? "Detalle"),
    valor: String(row.valor ?? ""),
    estado: parseStatus(row.estado),
    responsable: parseResponsible(row.responsable),
    notas: row.notas ? String(row.notas) : undefined,
    fecha_limite: row.fecha_limite ? String(row.fecha_limite) : undefined,
  }));
  const byKey = new Map(mapped.map((item) => [item.clave, item]));
  const merged = fallback.map((defaultItem) => {
    const saved = byKey.get(defaultItem.clave);
    if (!saved) return defaultItem;
    const item = { ...defaultItem, ...saved };

    if (defaultItem.clave === "hora_ceremonia" && saved.valor === "11:00 a.m.") item.valor = defaultItem.valor;
    if (defaultItem.clave === "hora_recepcion" && !saved.valor) item.valor = defaultItem.valor;
    if (defaultItem.clave === "lugar" && !saved.valor) item.valor = defaultItem.valor;
    if (defaultItem.clave === "decoracion" && saved.valor === "Confirmada con la parroquia") {
      item.valor = defaultItem.valor;
      item.notas = defaultItem.notas;
      item.estado = defaultItem.estado;
    }
    if (defaultItem.clave === "protocolo" && saved.titulo === "Protocolo de la iglesia") item.titulo = defaultItem.titulo;
    if (defaultItem.clave === "fotografia" && saved.titulo === "Fotografía de ceremonia") item.titulo = defaultItem.titulo;
    if (defaultItem.clave === "carro" && saved.titulo === "Carro de los novios") item.titulo = defaultItem.titulo;
    if (defaultItem.clave === "baile" && saved.titulo === "Primer baile") item.titulo = defaultItem.titulo;
    return item;
  });
  const extras = mapped.filter((item) => !fallback.some((defaultItem) => defaultItem.clave === item.clave));
  return [...merged, ...extras];
}

function enrichFromConfig(config: Array<Record<string, unknown>> | undefined, church: LogisticsItem[], reception: LogisticsItem[]) {
  if (!Array.isArray(config) || !config.length) return { church, reception };
  const values = new Map(config.map((row) => [String(row.clave ?? ""), String(row.valor ?? "").trim()]));
  const withFallback = (items: LogisticsItem[], pairs: Record<string, string>) => items.map((item) => {
    const configKey = pairs[item.clave];
    const configValue = configKey ? values.get(configKey) : "";
    return configValue && !item.valor.trim() ? { ...item, valor: configValue } : item;
  });
  return {
    church: withFallback(church, { hora_ceremonia: "hora_iglesia", lugar: "lugar_iglesia" }),
    reception: withFallback(reception, { hora_recepcion: "hora_recepcion", lugar: "lugar_recepcion" }),
  };
}

function mapCorte(rows: Array<Record<string, unknown>> | undefined): CortePerson[] {
  if (!Array.isArray(rows) || !rows.length) return initialCorte;
  return rows.map((row, index) => ({
    id: String(row.id ?? `corte-${index}`),
    nombre: String(row.nombre ?? ""),
    rol: parseRol(row.rol),
    confirmado: (row.confirmado === "Sí" || row.confirmado === "Si" ? "Sí" : "No") as CortePerson["confirmado"],
    telefono: row.telefono ? String(row.telefono) : undefined,
    notas: row.notas ? String(row.notas) : undefined,
  }));
}

function mapGuests(rows: Array<Record<string, unknown>>) {
  return rows.map((row, index) => ({
    id: String(row.id ?? `sheet-${index}`),
    nombre: String(row.nombre ?? "Invitado"),
    personas: Math.max(1, Number(row.personas ?? Number(row.acompanantes ?? 0) + 1)),
    invitado_a: (row.invitado_a === "Iglesia" || row.invitado_a === "Recepción" || row.invitado_a === "Ambas" ? row.invitado_a : "Recepción") as GuestGroup["invitado_a"],
    rsvp: (row.rsvp === "Confirmado" || row.rsvp === "No asiste" ? row.rsvp : "Pendiente") as GuestStatus,
    transporte: (row.transporte === "Uber" || row.transporte === "Interno" || row.transporte === "Propio" ? row.transporte : "Por definir") as Transport,
    plato: parsePlato(row.plato) ?? parsePlato(row.notas),
    fuente: parseFuente(row.fuente),
    actualizado: row.actualizado_en ? "Sheet" : undefined,
  }));
}

function mealCount(groups: GuestGroup[], meal: Meal) {
  return groups.filter((group) => group.plato === meal).reduce((total, group) => total + group.personas, 0);
}

function daysUntil(date: string) {
  if (!date) return null;
  const target = new Date(`${date}T12:00:00`);
  if (Number.isNaN(target.getTime())) return null;
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  return Math.max(0, Math.ceil((target.getTime() - today.getTime()) / 86_400_000));
}

function formatWeddingDate(date: string) {
  if (!date) return "[Fecha de la boda]";
  const parsed = new Date(`${date}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return "[Fecha de la boda]";
  return new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "long", year: "numeric" }).format(parsed);
}

function sectionProgress(tasks: Task[], section: Section) {
  const relevant = tasks.filter((task) => task.seccion === section);
  const done = relevant.filter((task) => task.estado === "Listo").length;
  return { done, total: relevant.length, percent: relevant.length ? Math.round((done / relevant.length) * 100) : 0 };
}

function nextPendingTask(tasks: Task[], section: Section) {
  return tasks.find((task) => task.seccion === section && task.estado !== "Listo") ?? null;
}

function nextDueTask(tasks: Task[]) {
  const dated = tasks.filter((task) => task.fecha_limite && task.estado !== "Listo");
  dated.sort((a, b) => String(a.fecha_limite).localeCompare(String(b.fecha_limite)));
  return dated[0] ?? null;
}

function splitDueDate(date?: string) {
  if (!date) return null;
  const parsed = new Date(`${date}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return null;
  return {
    day: new Intl.DateTimeFormat("es-CO", { day: "numeric" }).format(parsed),
    month: new Intl.DateTimeFormat("es-CO", { month: "long" }).format(parsed),
    short: new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short" })
      .format(parsed)
      .replace(".", "")
      .toUpperCase(),
  };
}

function readQueue(): PendingMutation[] {
  try {
    return JSON.parse(window.localStorage.getItem(QUEUE_KEY) ?? "[]") as PendingMutation[];
  } catch {
    return [];
  }
}

function normalizeApiUrl(url: string) {
  return url.trim().replace(/[?&]token=[^&]*$/, "").replace(/\/+$/, "");
}

function isUsableUrl(url: string) {
  const value = url.trim();
  return /^https:\/\//.test(value) || /^http:\/\/localhost(:\d+)?\//.test(value);
}

/**
 * Los campos de Ajustes son un override opcional (útil para apuntar a una hoja
 * de pruebas). Si están vacíos manda la conexión horneada en el build, así que
 * un dispositivo nuevo lee el Sheet real sin que nadie configure nada.
 */
function resolveConnection(settings: Settings) {
  const apiUrl = isUsableUrl(settings.apiUrl) ? normalizeApiUrl(settings.apiUrl) : isUsableUrl(DEFAULT_API_URL) ? normalizeApiUrl(DEFAULT_API_URL) : "";
  return { apiUrl, token: settings.token || DEFAULT_TOKEN };
}

async function fetchVersion(settings: Settings) {
  try {
    if (isUsableUrl(VERSION_CSV_URL)) {
      const response = await fetch(VERSION_CSV_URL, { cache: "no-store" });
      if (!response.ok) return null;
      const lines = (await response.text()).trim().split(/\r?\n/);
      const value = lines[lines.length - 1]?.replace(/"/g, "").trim();
      return value || null;
    }
    // Respaldo si la pestaña Tracker_Version no está publicada: se lo pedimos al
    // propio Web App. Más caro en cuota, por eso no es el camino normal.
    const { apiUrl } = resolveConnection(settings);
    if (!apiUrl) return null;
    const response = await fetch(`${apiUrl}?check=1`, { redirect: "follow", cache: "no-store" });
    if (!response.ok) return null;
    const data = JSON.parse(await response.text()) as { version?: string };
    return data.version ? String(data.version) : null;
  } catch {
    return null;
  }
}

function createCorteId() {
  return `corte-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function sendMutation(settings: Settings, mutation: PendingMutation) {
  const { apiUrl, token } = resolveConnection(settings);
  if (!apiUrl || !token) throw new Error("Sin conexión configurada");
  const response = await fetch(apiUrl, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ accion: "actualizar", hoja: mutation.hoja, token, payload: mutation.payload }),
  });
  if (!response.ok) throw new Error("No se pudo sincronizar");
  const result = (await response.json()) as { ok?: boolean };
  if (result.ok === false) throw new Error("El Sheet rechazó el cambio");
}

function ProgressRing({ percent, size = 116, stroke = 7, children }: { percent: number; size?: number; stroke?: number; children?: ReactNode }) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (Math.min(100, Math.max(0, percent)) / 100) * circumference;

  return (
    <div className="progress-ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle className="ring-track" cx={size / 2} cy={size / 2} r={radius} fill="none" strokeWidth={stroke} />
        <circle className="ring-value" cx={size / 2} cy={size / 2} r={radius} fill="none" strokeWidth={stroke} strokeDasharray={circumference} strokeDashoffset={offset} />
      </svg>
      <div className="ring-content">{children}</div>
    </div>
  );
}

export default function Prototype() {
  const initial = useMemo(loadInitialState, []);
  const [screen, setScreen] = useState<Screen>("Resumen");
  const [tasks, setTasks] = useState<Task[]>(initial.tasks);
  const [guests, setGuests] = useState<GuestGroup[]>(initial.guests);
  const [corte, setCorte] = useState<CortePerson[]>(initial.corte);
  const [iglesia, setIglesia] = useState<LogisticsItem[]>(initial.iglesia);
  const [recepcion, setRecepcion] = useState<LogisticsItem[]>(initial.recepcion);
  const [settings, setSettings] = useState<Settings>(initial.settings);
  const [settingsDraft, setSettingsDraft] = useState<Settings>(initial.settings);
  const [sheet, setSheet] = useState<"settings" | "task" | "guest" | "guest-detail" | "church-person" | "church-person-new" | "logistics-detail" | null>(null);
  const [selectedGuestId, setSelectedGuestId] = useState<string | null>(null);
  const [selectedCorteId, setSelectedCorteId] = useState<string | null>(null);
  const [selectedLogisticsSection, setSelectedLogisticsSection] = useState<"Iglesia" | "Recepción" | null>(null);
  const [selectedLogisticsKey, setSelectedLogisticsKey] = useState<string | null>(null);
  const [connectionState, setConnectionState] = useState<"idle" | "syncing" | "success" | "error" | "queued">("idle");
  const [connectionDetail, setConnectionDetail] = useState("");
  const shell = useShell();
  const { isKeyboardVisible } = shell;
  const autoSyncStarted = useRef(false);
  const lastVersion = useRef<string | null>(null);
  const lastFullSync = useRef(0);
  const syncInFlight = useRef(false);

  const flushQueue = async (sourceSettings: Settings) => {
    const queue = readQueue();
    const { apiUrl, token } = resolveConnection(sourceSettings);
    if (!queue.length) return true;
    if (!apiUrl || !token) return false;
    const remaining: PendingMutation[] = [];
    for (const mutation of queue) {
      try {
        await sendMutation(sourceSettings, mutation);
      } catch {
        remaining.push(mutation);
      }
    }
    window.localStorage.setItem(QUEUE_KEY, JSON.stringify(remaining));
    return remaining.length === 0;
  };

  const syncFromSheet = async (sourceSettings: Settings, preferredDate?: string) => {
    const { apiUrl, token } = resolveConnection(sourceSettings);
    if (!apiUrl) return false;
    setConnectionState("syncing");
    setConnectionDetail("");

    try {
      const queueFlushed = await flushQueue(sourceSettings);
      // El token viaja solo para seguir funcionando con implementaciones viejas
      // del Web App; desde esta versión doGet ya no lo pide.
      const query = token ? `?token=${encodeURIComponent(token)}` : "";
      const response = await fetch(`${apiUrl}${query}`, { redirect: "follow", cache: "no-store" });
      const raw = await response.text();
      let data: SheetResponse;
      try {
        data = JSON.parse(raw) as SheetResponse;
      } catch {
        throw new Error("Apps Script no devolvió JSON. Publica una nueva versión del Web App y verifica que el acceso sea para cualquiera con el enlace.");
      }
      if (!response.ok || data.ok === false) throw new Error(data.error || "Google Sheets rechazó la conexión. Revisa el token.");

      const remoteDate = String(data.Config?.find((row) => row.clave === "fecha_boda")?.valor ?? "");
      const dateToUse = preferredDate || remoteDate || sourceSettings.weddingDate;
      setSettings((current) => ({ ...current, weddingDate: dateToUse }));
      setSettingsDraft((current) => ({ ...current, weddingDate: dateToUse }));
      if (Array.isArray(data.Tareas)) setTasks(data.Tareas);
      if (Array.isArray(data.Invitados)) setGuests(mapGuests(data.Invitados));
      setCorte(mapCorte(data.Corte));
      const enriched = enrichFromConfig(data.Config, mapLogistics(data.Iglesia, initialIglesia), mapLogistics(data.Recepcion ?? data["Recepción"], initialRecepcion));
      setIglesia(enriched.church);
      setRecepcion(enriched.reception);
      setConnectionState(queueFlushed ? "success" : "error");
      setConnectionDetail(queueFlushed ? "" : "Conectado. Hay cambios locales pendientes de enviar.");
      return true;
    } catch (error) {
      setConnectionState("error");
      const raw = error instanceof Error ? error.message : "";
      setConnectionDetail(
        raw === "Failed to fetch" || raw === "Load failed" || raw === "NetworkError when attempting to fetch resource."
          ? "No pudimos llegar al Web App. Comprueba que esté publicado como Aplicación web y con acceso para cualquiera con el enlace."
          : raw || "No pudimos actualizar los datos desde Google Sheets."
      );
      return false;
    }
  };

  useEffect(() => {
    if (isKeyboardVisible) return;
    const frame = window.requestAnimationFrame(() => {
      const deviceScreen = document.querySelector<HTMLElement>('[data-testid="device-screen"]');
      if (deviceScreen) deviceScreen.scrollTop = 0;
    });
    return () => window.cancelAnimationFrame(frame);
  }, [isKeyboardVisible, screen]);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ tasks, guests, corte, iglesia, recepcion, settings }));
  }, [tasks, guests, corte, iglesia, recepcion, settings]);

  const runSync = async (sourceSettings: Settings, version: string | null) => {
    if (syncInFlight.current) return;
    syncInFlight.current = true;
    try {
      if (await syncFromSheet(sourceSettings)) {
        lastFullSync.current = Date.now();
        if (version) lastVersion.current = version;
      }
    } finally {
      syncInFlight.current = false;
    }
  };

  /**
   * Sondeo barato: preguntamos por el número de versión de la hoja y solo
   * traemos el JSON completo cuando cambió. Cada cierto tiempo forzamos una
   * lectura completa igualmente, por si el trigger onChange se perdió un evento.
   */
  const checkForChanges = async (sourceSettings: Settings, ignoreHidden = false) => {
    if (!resolveConnection(sourceSettings).apiUrl) return;
    // La pausa por pestaña oculta aplica al sondeo periódico, no a la carga
    // inicial: una app abierta en segundo plano igual tiene que traer datos.
    if (!ignoreHidden && typeof document !== "undefined" && document.hidden) return;
    const version = await fetchVersion(sourceSettings);
    const stale = Date.now() - lastFullSync.current > FULL_SYNC_MS;
    if (version === null) {
      if (stale) await runSync(sourceSettings, null);
      return;
    }
    if (version !== lastVersion.current || stale) await runSync(sourceSettings, version);
  };

  useEffect(() => {
    if (autoSyncStarted.current) return;
    autoSyncStarted.current = true;
    void checkForChanges(settings, true);
  }, []);

  useEffect(() => {
    const check = () => void checkForChanges(settings);
    const handleVisibility = () => {
      if (!document.hidden) void checkForChanges(settings, true);
    };
    const refreshTimer = window.setInterval(check, VERSION_POLL_MS);
    window.addEventListener("online", check);
    window.addEventListener("focus", check);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      window.removeEventListener("online", check);
      window.removeEventListener("focus", check);
      document.removeEventListener("visibilitychange", handleVisibility);
      window.clearInterval(refreshTimer);
    };
  }, [settings.apiUrl, settings.token]);

  const navigate = (next: Screen) => {
    shell.hideKeyboard();
    setScreen(next);
  };

  const persistMutation = async (mutation: PendingMutation) => {
    const queue = readQueue();
    const connection = resolveConnection(settings);
    if (!connection.apiUrl || !connection.token) {
      window.localStorage.setItem(QUEUE_KEY, JSON.stringify([...queue, mutation]));
      setConnectionState("queued");
      setConnectionDetail("Guardado localmente. Se enviará cuando la app pueda escribir en Google Sheets.");
      return;
    }
    try {
      await sendMutation(settings, mutation);
      setConnectionState("success");
      setConnectionDetail("");
    } catch (error) {
      window.localStorage.setItem(QUEUE_KEY, JSON.stringify([...queue, mutation]));
      setConnectionState("error");
      setConnectionDetail("Guardado localmente. Se enviará a Google Sheets cuando vuelva la conexión.");
    }
  };

  const toggleTask = (id: string) => {
    const current = tasks.find((task) => task.id === id);
    if (!current) return;
    const updated: Task = { ...current, estado: current.estado === "Listo" ? "Pendiente" : "Listo" };
    setTasks((items) => items.map((task) => task.id === id ? updated : task));
    void persistMutation({ hoja: "Tareas", payload: updated as unknown as Record<string, unknown> });
  };

  const updateCorte = (updated: CortePerson) => {
    setCorte((items) => items.map((person) => person.id === updated.id ? updated : person));
    void persistMutation({ hoja: "Corte", payload: updated as unknown as Record<string, unknown> });
  };

  const toggleLogistics = (section: "Iglesia" | "Recepción", clave: string) => {
    const list = section === "Iglesia" ? iglesia : recepcion;
    const current = list.find((item) => item.clave === clave);
    if (!current) return;
    const updated: LogisticsItem = { ...current, estado: current.estado === "Listo" ? "Pendiente" : "Listo" };
    if (section === "Iglesia") setIglesia((items) => items.map((item) => item.clave === clave ? updated : item));
    else setRecepcion((items) => items.map((item) => item.clave === clave ? updated : item));
    void persistMutation({ hoja: section === "Iglesia" ? "Iglesia" : "Recepcion", payload: updated as unknown as Record<string, unknown> });
  };

  const updateLogistics = (section: "Iglesia" | "Recepción", updated: LogisticsItem) => {
    if (section === "Iglesia") setIglesia((items) => items.map((item) => item.clave === updated.clave ? updated : item));
    else setRecepcion((items) => items.map((item) => item.clave === updated.clave ? updated : item));
    void persistMutation({ hoja: section === "Iglesia" ? "Iglesia" : "Recepcion", payload: updated as unknown as Record<string, unknown> });
  };

  const updateGuest = (id: string, changes: Partial<GuestGroup>) => {
    const current = guests.find((guest) => guest.id === id);
    if (!current) return;
    const updated: GuestGroup = { ...current, ...changes, actualizado: "Ahora" };
    setGuests((items) => items.map((guest) => guest.id === id ? updated : guest));
    void persistMutation({ hoja: "Invitados", payload: { ...updated, notas: updated.plato ?? "", acompanantes: Math.max(0, updated.personas - 1) } as unknown as Record<string, unknown> });
  };

  const selectedGuest = guests.find((guest) => guest.id === selectedGuestId) ?? null;
  const selectedCortePerson = corte.find((person) => person.id === selectedCorteId) ?? null;
  const selectedLogistics = (selectedLogisticsSection === "Recepción" ? recepcion : iglesia).find((item) => item.clave === selectedLogisticsKey) ?? null;
  const openSettings = () => {
    setSettingsDraft(settings);
    setSheet("settings");
  };

  return (
    <div className="wedding-app" data-shell={shell.mode}>
      <AppSidebar current={screen} tasks={tasks} guests={guests} settings={settings} onNavigate={navigate} onOpenSettings={openSettings} />

      <div className="app-main">
        <shell.Scroll key={screen} className="app-screen">
          <main className="wedding-screen" data-testid="wedding-screen" aria-live="polite">
            {screen === "Resumen" ? (
              <SummaryScreen tasks={tasks} guests={guests} settings={settings} connectionState={connectionState} connectionDetail={connectionDetail} onOpenSettings={openSettings} onNavigate={navigate} />
            ) : screen === "Invitados" ? (
              <GuestsScreen guests={guests} onAdd={() => setSheet("guest")} onSelect={(id) => { setSelectedGuestId(id); setSheet("guest-detail"); }} />
            ) : (
              <SectionScreen
                section={screen}
                tasks={tasks}
                corte={corte}
                logistics={screen === "Iglesia" ? iglesia : screen === "Recepción" ? recepcion : []}
                guests={guests}
                onBack={() => navigate("Resumen")}
                onAdd={() => setSheet("task")}
                onAddCorte={() => setSheet("church-person-new")}
                onToggle={toggleTask}
                onSelectCorte={(id) => { setSelectedCorteId(id); setSheet("church-person"); }}
                onSelectLogistics={(section, key) => { setSelectedLogisticsSection(section); setSelectedLogisticsKey(key); setSheet("logistics-detail"); }}
                onOpenGuests={() => navigate("Invitados")}
              />
            )}
          </main>
        </shell.Scroll>

        <BottomNav current={screen} hidden={isKeyboardVisible} onNavigate={navigate} />
      </div>

      <shell.Sheet open={sheet === "settings"} onOpenChange={(open) => setSheet(open ? "settings" : null)} title="Configurar" description="La app ya viene conectada a la hoja de la boda y se actualiza sola cada pocos segundos. Aquí puedes ajustar la fecha o apuntar a otra hoja.">
        <div className="sheet-form">
          <label className="field-block" htmlFor="wedding-date"><span>Fecha de la boda</span><shell.Field id="wedding-date" inputMode="numeric" placeholder="2026-10-03" value={settingsDraft.weddingDate} onChange={(event) => setSettingsDraft((current) => ({ ...current, weddingDate: event.target.value }))} /></label>
          <details className="advanced-connection">
            <summary>Avanzado (opcional)</summary>
            <p className="sheet-note">Solo si quieres apuntar esta app a otra hoja, por ejemplo una de pruebas. Déjalo vacío para usar la conexión de siempre.</p>
            <label className="field-block" htmlFor="api-url"><span>URL del Web App</span><shell.Field id="api-url" inputMode="url" placeholder="https://script.google.com/macros/s/..." value={settingsDraft.apiUrl} onChange={(event) => setSettingsDraft((current) => ({ ...current, apiUrl: event.target.value }))} /></label>
            <label className="field-block" htmlFor="api-token"><span>Token privado</span><shell.Field id="api-token" type="password" placeholder="Solo hace falta para guardar cambios" value={settingsDraft.token} onChange={(event) => setSettingsDraft((current) => ({ ...current, token: event.target.value }))} /></label>
          </details>
          <p className={`connection-message ${connectionState}`}>{connectionState === "syncing" ? "Actualizando..." : connectionState === "success" ? "Al día con Google Sheets." : connectionState === "error" ? (connectionDetail || "No pudimos conectar con Google Sheets.") : connectionState === "queued" ? (connectionDetail || "Hay cambios locales por enviar.") : "Leyendo la hoja de la boda."}</p>
          <button className="primary-button" type="button" onClick={async () => {
            shell.hideKeyboard();
            const localDateChanged = settingsDraft.weddingDate !== settings.weddingDate;
            const apiUrl = normalizeApiUrl(settingsDraft.apiUrl);
            const nextSettings = { ...settingsDraft, apiUrl };
            setSettings(nextSettings);
            setSettingsDraft((current) => ({ ...current, apiUrl }));
            if (apiUrl && !apiUrl.endsWith("/exec") && !apiUrl.endsWith("/dev")) {
              setConnectionState("error");
              setConnectionDetail("La URL tiene que terminar en /exec o /dev. Copia la URL de la implementación del Web App.");
              return;
            }
            if (!resolveConnection(nextSettings).apiUrl) { setConnectionState("idle"); setSheet(null); return; }
            if (localDateChanged) {
              try {
                await sendMutation(nextSettings, { hoja: "Config", payload: { clave: "fecha_boda", valor: settingsDraft.weddingDate } });
              } catch {
                const queue = readQueue();
                window.localStorage.setItem(QUEUE_KEY, JSON.stringify([...queue, { hoja: "Config", payload: { clave: "fecha_boda", valor: settingsDraft.weddingDate } }]));
              }
            }
            await syncFromSheet(nextSettings, localDateChanged ? settingsDraft.weddingDate : undefined);
            lastFullSync.current = Date.now();
            lastVersion.current = await fetchVersion(nextSettings);
          }}><ReloadIcon /> Guardar y sincronizar</button>
        </div>
      </shell.Sheet>

      <AddTaskSheet open={sheet === "task"} section={screen === "Resumen" || screen === "Invitados" ? "General" : screen} onClose={() => setSheet(null)} onAdd={(task) => { setTasks((current) => [...current, task]); setSheet(null); void persistMutation({ hoja: "Tareas", payload: task as unknown as Record<string, unknown> }); }} />
      <AddGuestSheet open={sheet === "guest"} onClose={() => setSheet(null)} onAdd={(guest) => { setGuests((current) => [guest, ...current]); setSheet(null); void persistMutation({ hoja: "Invitados", payload: { ...guest, notas: guest.plato ?? "", acompanantes: Math.max(0, guest.personas - 1) } as unknown as Record<string, unknown> }); }} />

      <shell.Sheet open={sheet === "guest-detail" && Boolean(selectedGuest)} onOpenChange={(open) => setSheet(open ? "guest-detail" : null)} title={selectedGuest?.nombre ?? "Invitado"} description={selectedGuest ? `${selectedGuest.personas} ${selectedGuest.personas === 1 ? "persona" : "personas"} para ${selectedGuest.invitado_a.toLowerCase()}${selectedGuest.plato ? ` · ${selectedGuest.plato}` : ""}` : undefined}>
        {selectedGuest ? (
          <div className="guest-actions">
            <div><span className="action-label">Confirmación</span><div className="segmented-actions">{(["Pendiente", "Confirmado", "No asiste"] as GuestStatus[]).map((status) => <button key={status} className={selectedGuest.rsvp === status ? "selected" : ""} type="button" onClick={() => updateGuest(selectedGuest.id, { rsvp: status })}>{status}</button>)}</div></div>
            <div><span className="action-label">Plato</span><div className="segmented-actions">{(["Pollo", "Carne"] as Meal[]).map((meal) => <button key={meal} className={selectedGuest.plato === meal ? "selected" : ""} type="button" onClick={() => updateGuest(selectedGuest.id, { plato: meal })}>{meal}</button>)}</div></div>
            <div><span className="action-label">Transporte</span><div className="transport-grid">{(["Uber", "Interno", "Propio", "Por definir"] as Transport[]).map((transport) => <button key={transport} className={selectedGuest.transporte === transport ? "selected" : ""} type="button" onClick={() => updateGuest(selectedGuest.id, { transporte: transport })}>{transport}</button>)}</div></div>
            {selectedGuest.fuente === "formulario" ? <p className="sheet-note">RSVP y plato salen del formulario de la invitación. El transporte se guarda en Tracker_InvitadosExtra; Confirmacion no se reescribe.</p> : null}
          </div>
        ) : null}
      </shell.Sheet>

      <ChurchPersonSheet
        open={sheet === "church-person" && Boolean(selectedCortePerson)}
        person={selectedCortePerson}
        onClose={() => setSheet(null)}
        onSave={(person) => { updateCorte(person); setSheet(null); }}
      />
      <AddChurchPersonSheet
        open={sheet === "church-person-new"}
        onClose={() => setSheet(null)}
        onSave={(person) => {
          setCorte((items) => [...items, person]);
          setSheet(null);
          void persistMutation({ hoja: "Corte", payload: person as unknown as Record<string, unknown> });
        }}
      />
      <LogisticsDetailSheet
        open={sheet === "logistics-detail" && Boolean(selectedLogistics)}
        item={selectedLogistics}
        section={selectedLogisticsSection ?? "Iglesia"}
        onClose={() => setSheet(null)}
        onSave={(item) => { updateLogistics(selectedLogisticsSection ?? "Iglesia", item); setSheet(null); }}
      />
    </div>
  );
}

const sectionIcons: Record<Section, ReactNode> = {
  Iglesia: <BookmarkIcon />,
  "Recepción": <MixerHorizontalIcon />,
  General: <ListBulletIcon />,
};

const sectionDescriptions: Record<Section, string> = {
  Iglesia: "Corte, decoración, fotografía",
  "Recepción": "Hora, DJ, itinerario, invitados",
  General: "Traje, vestido, hotel",
};

function RingsMark() {
  return (
    <svg className="brand-mark" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
      <circle cx="9.2" cy="14.6" r="6" />
      <circle cx="14.8" cy="14.6" r="6" />
      <path d="M12 2.4l1.7 3.3L12 7.4 10.3 5.7z" fill="currentColor" stroke="none" />
    </svg>
  );
}

function AppSidebar({ current, tasks, guests, settings, onNavigate, onOpenSettings }: { current: Screen; tasks: Task[]; guests: GuestGroup[]; settings: Settings; onNavigate: (screen: Screen) => void; onOpenSettings: () => void }) {
  const countdown = daysUntil(settings.weddingDate);
  const pendingGroups = guests.filter((guest) => guest.rsvp === "Pendiente").length;

  return (
    <aside className="app-sidebar">
      <div className="sidebar-brand"><RingsMark /><span>Nuestra boda</span></div>
      <p className="sidebar-eyebrow">Panel</p>

      <nav className="sidebar-nav" aria-label="Navegación de escritorio">
        <button className={`sidebar-link ${current === "Resumen" ? "active" : ""}`} type="button" onClick={() => onNavigate("Resumen")}>
          <HomeIcon /><span>Resumen</span>
        </button>
        {(["Iglesia", "Recepción", "General"] as Section[]).map((section) => {
          const progress = sectionProgress(tasks, section);
          const remaining = progress.total - progress.done;
          return (
            <button key={section} className={`sidebar-link ${current === section ? "active" : ""}`} type="button" onClick={() => onNavigate(section)}>
              {sectionIcons[section]}<span>{section}</span>
              {remaining > 0 ? <b className="sidebar-badge">{remaining}</b> : null}
            </button>
          );
        })}
        <button className={`sidebar-link ${current === "Invitados" ? "active" : ""}`} type="button" onClick={() => onNavigate("Invitados")}>
          <PersonIcon /><span>Invitados</span>
          {pendingGroups > 0 ? <b className="sidebar-badge accent">{pendingGroups}</b> : null}
        </button>
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-countdown">
          <span className="sidebar-countdown-label"><CalendarIcon /> Cuenta regresiva</span>
          <span className="sidebar-countdown-date">{formatWeddingDate(settings.weddingDate)}</span>
          {countdown === null ? (
            <button className="sidebar-countdown-cta" type="button" onClick={onOpenSettings}><PlusIcon /> Configurar fecha</button>
          ) : (
            <span className="sidebar-countdown-days"><strong>{countdown}</strong><small>días, {WEDDING_TIME}</small></span>
          )}
        </div>
        <button className="sidebar-link" type="button" onClick={onOpenSettings}><GearIcon /><span>Configuración</span></button>
      </div>
    </aside>
  );
}

function KpiCard({ label, value, unit, note, tone, bar }: { label: string; value: ReactNode; unit?: string; note?: string; tone?: "accent" | "sage" | "urgent"; bar?: number }) {
  return (
    <div className="kpi-card">
      <span className="kpi-label">{label}</span>
      <span className="kpi-value">
        <strong className={tone ? `kpi-number ${tone}` : "kpi-number"}>{value}</strong>
        {unit ? <small>{unit}</small> : null}
      </span>
      {typeof bar === "number" ? (
        <span className="kpi-bar"><i style={{ width: `${Math.max(4, bar)}%` }} /></span>
      ) : note ? (
        <span className="kpi-note">{note}</span>
      ) : null}
    </div>
  );
}

function SummaryScreen({ tasks, guests, settings, connectionState, connectionDetail, onNavigate, onOpenSettings }: { tasks: Task[]; guests: GuestGroup[]; settings: Settings; connectionState: "idle" | "syncing" | "success" | "error" | "queued"; connectionDetail: string; onNavigate: (screen: Screen) => void; onOpenSettings: () => void }) {
  const total = peopleCount(guests);
  const confirmed = peopleCount(guests, "Confirmado");
  const pending = peopleCount(guests, "Pendiente");
  const pendingChurch = guests.filter((group) => group.rsvp === "Pendiente" && group.invitado_a === "Iglesia").reduce((sum, group) => sum + group.personas, 0);
  const pendingReception = pending - pendingChurch;
  const countdown = daysUntil(settings.weddingDate);
  const pendingGroups = guests.filter((guest) => guest.rsvp === "Pendiente");
  const doneTasks = tasks.filter((task) => task.estado === "Listo").length;
  const due = nextDueTask(tasks);
  const dueParts = splitDueDate(due?.fecha_limite);

  return (
    <section className="summary-page page-shell">
      <header className="summary-header">
        <div>
          <h1>Nuestra boda</h1>
          <p className="date-line">
            <span>{formatWeddingDate(settings.weddingDate)}</span>
            <span>{countdown === null ? "configura la fecha" : `faltan ${countdown} días`}</span>
          </p>
          <p className={`sync-status ${connectionState}`}><span aria-hidden="true" />{connectionState === "success" ? "Google Sheets conectado" : connectionState === "syncing" ? "Actualizando desde Sheets…" : connectionState === "error" ? (connectionDetail || "Revisa la conexión con Sheets") : connectionState === "queued" ? (connectionDetail || "Hay cambios locales por enviar") : "Conecta Google Sheets desde Configuración"}</p>
        </div>
        <button className="icon-button" type="button" aria-label="Abrir configuración" onClick={onOpenSettings}><GearIcon /></button>
      </header>

      <div className="kpi-strip">
        <KpiCard label="Por confirmar" value={pending} unit="personas" note={`en ${pendingGroups.length} grupos sin responder`} tone="accent" />
        <KpiCard label="Confirmados" value={confirmed} unit={`de ${total}`} note={`${mealCount(guests, "Pollo")} pollo · ${mealCount(guests, "Carne")} carne`} tone="sage" />
        <KpiCard label="Pendientes listos" value={doneTasks} unit={`de ${tasks.length}`} bar={tasks.length ? Math.round((doneTasks / tasks.length) * 100) : 0} />
        <KpiCard label="Próximo vencimiento" value={dueParts ? dueParts.day : "—"} unit={dueParts ? `de ${dueParts.month}` : "sin fechas"} note={due ? due.titulo : "Nada con fecha límite"} tone="urgent" />
      </div>

      <div className="summary-columns">
        <div className="summary-main">
          <button className="hero-card" type="button" onClick={() => onNavigate("Invitados")} aria-label={`${pending} personas por confirmar`}>
            <ProgressRing percent={total ? (confirmed / total) * 100 : 0}><span className="hero-number">{pending}</span><span className="hero-label">por confirmar</span></ProgressRing>
            <div className="hero-stats"><div><strong>{pendingChurch}</strong><span>Iglesia</span></div><div><strong>{pendingReception}</strong><span>Recepción</span></div><div><strong className="sage-number">{confirmed}</strong><span>Confirmados</span></div></div>
          </button>

          <div className="section-list">
            {(["Iglesia", "Recepción", "General"] as Section[]).map((section) => {
              const progress = sectionProgress(tasks, section);
              const next = nextPendingTask(tasks, section);
              return (
                <button key={section} className="section-card" type="button" onClick={() => onNavigate(section)}>
                  <ProgressRing percent={progress.percent} size={36} stroke={4} />
                  <span className="section-copy">
                    <strong>{section}</strong>
                    <small>{sectionDescriptions[section]}</small>
                    {next ? <em className="section-next">Sigue: {next.titulo}</em> : null}
                  </span>
                  <span className="section-count">{progress.done}/{progress.total}</span>
                  <ChevronRightIcon className="section-chevron" />
                </button>
              );
            })}
          </div>
        </div>

        <aside className="summary-side">
          {due ? (
            <button className="urgent-card" type="button" onClick={() => onNavigate(due.seccion)}>
              <ClockIcon />
              <span><strong>{due.titulo}</strong><small>{due.seccion}: {due.detalle.toLowerCase()}</small></span>
              <b>{dueParts?.short}</b>
            </button>
          ) : null}

          <div className="pending-panel">
            <div className="pending-panel-head"><strong>Sin responder</strong><span>{pending} personas</span></div>
            {pendingGroups.slice(0, 5).map((guest) => (
              <button key={guest.id} className="pending-row" type="button" onClick={() => onNavigate("Invitados")}>
                <span><strong>{guest.nombre}</strong><small>{guest.invitado_a}, {guest.transporte.toLowerCase()}</small></span>
                <b>{guest.personas}</b>
              </button>
            ))}
            <button className="pending-panel-more" type="button" onClick={() => onNavigate("Invitados")}>Ver los {pendingGroups.length} grupos &rarr;</button>
          </div>
        </aside>
      </div>
    </section>
  );
}

function receptionIcon(key: string, done: boolean) {
  if (done) return <CheckIcon />;
  if (key === "lugar") return <BookmarkIcon />;
  if (key === "fotografia") return <MagicWandIcon />;
  if (key === "dj") return <SpeakerLoudIcon />;
  if (key === "itinerario") return <ReaderIcon />;
  if (key === "baile") return <StopwatchIcon />;
  if (key === "transporte") return <BackpackIcon />;
  if (key === "contrato") return <FileTextIcon />;
  return <ListBulletIcon />;
}

function SectionScreen({
  section,
  tasks,
  corte,
  logistics,
  guests,
  onBack,
  onAdd,
  onAddCorte,
  onToggle,
  onSelectCorte,
  onSelectLogistics,
  onOpenGuests,
}: {
  section: Section;
  tasks: Task[];
  corte: CortePerson[];
  logistics: LogisticsItem[];
  guests: GuestGroup[];
  onBack: () => void;
  onAdd: () => void;
  onAddCorte: () => void;
  onToggle: (id: string) => void;
  onSelectCorte: (id: string) => void;
  onSelectLogistics: (section: "Iglesia" | "Recepción", key: string) => void;
  onOpenGuests: () => void;
}) {
  const [filter, setFilter] = useState<"Todas" | Responsible>("Todas");
  const [churchTab, setChurchTab] = useState<ChurchTab>("Ceremonia");
  const sectionTasks = tasks.filter((task) => task.seccion === section);
  const visible = sectionTasks.filter((task) => filter === "Todas" || task.responsable === filter);
  const pending = visible.filter((task) => task.estado !== "Listo");
  const complete = visible.filter((task) => task.estado === "Listo");
  const progress = sectionProgress(tasks, section);
  const receptionGuests = guests.filter((guest) => guest.invitado_a === "Recepción" || guest.invitado_a === "Ambas");
  const confirmed = peopleCount(receptionGuests, "Confirmado");
  const pendingGuests = peopleCount(receptionGuests, "Pendiente");
  const totalReceptionGuests = peopleCount(receptionGuests);
  const chicken = mealCount(receptionGuests, "Pollo");
  const beef = mealCount(receptionGuests, "Carne");
  const churchReady = logistics.filter((item) => item.estado === "Listo").length + corte.filter((person) => person.confirmado === "Sí").length;
  const churchTotal = logistics.length + corte.length;
  const shownProgress = section === "Iglesia"
    ? { done: churchReady, total: churchTotal, percent: churchTotal ? Math.round((churchReady / churchTotal) * 100) : 0 }
    : progress;
  const ceremonyTime = logistics.find((item) => item.clave === "hora_ceremonia");
  const ceremonyDetails = logistics.filter((item) => item.clave !== "hora_ceremonia");
  const receptionTime = logistics.find((item) => item.clave === "hora_recepcion");
  const receptionDetails = logistics.filter((item) => item.clave !== "hora_recepcion");

  return (
    <section className="tasks-page page-shell">
      <header className="screen-header"><button className="icon-button back-button" type="button" aria-label="Volver al resumen" onClick={onBack}><ChevronLeftIcon /></button><h1>{section}</h1>{section === "Iglesia" ? <button className="icon-button" type="button" aria-label="Agregar persona de corte" onClick={onAddCorte}><PlusIcon /></button> : <button className="icon-button" type="button" aria-label={`Agregar pendiente de ${section}`} onClick={onAdd}><PlusIcon /></button>}</header>
      <div className="section-progress" aria-label={`${shownProgress.done} de ${shownProgress.total} elementos listos`}><span style={{ width: `${Math.max(4, shownProgress.percent)}%` }} /></div><p className="progress-caption">{shownProgress.done} de {shownProgress.total} listos</p>

      {section === "Iglesia" ? (
        <div className="church-module">
          <div className="filter-row church-tabs" role="tablist" aria-label="Información de la iglesia">
            {(["Ceremonia", "Corte ceremonial"] as ChurchTab[]).map((tab) => (
              <button key={tab} className={churchTab === tab ? "active" : ""} type="button" role="tab" aria-selected={churchTab === tab} onClick={() => setChurchTab(tab)}>{tab}</button>
            ))}
          </div>

          {churchTab === "Ceremonia" ? (
            <div className="ceremony-content" role="tabpanel">
              {ceremonyTime ? (
                <button className="ceremony-time-card" type="button" onClick={() => onSelectLogistics("Iglesia", ceremonyTime.clave)}>
                  <span className="ceremony-time-icon"><ClockIcon /></span>
                  <span className="ceremony-time-copy"><small>Hora de la ceremonia</small><strong>{ceremonyTime.valor || "Por definir"}</strong><span>{ceremonyTime.notas || "Toca para completar la información"}</span></span>
                  <ChevronRightIcon className="ceremony-chevron" />
                </button>
              ) : null}

              <div className="group-title"><span>Detalles de la ceremonia</span></div>
              <div className="ceremony-card-grid">
                {ceremonyDetails.map((item) => {
                  const done = item.estado === "Listo";
                  return (
                    <button key={item.clave} className="ceremony-detail-card" type="button" onClick={() => onSelectLogistics("Iglesia", item.clave)}>
                      <span className={`ceremony-card-icon ${done ? "done" : ""}`}>{item.clave === "oficiante" ? <PersonIcon /> : item.clave === "decoracion" ? <BookmarkIcon /> : done ? <CheckIcon /> : <ListBulletIcon />}</span>
                      <span className="ceremony-card-copy"><small>{item.titulo}</small><strong>{item.valor || "Por completar"}</strong><span>{item.notas || `${item.responsable} · toca para editar`}</span></span>
                      <span className={`status-pill ${done ? "confirmed" : ""}`}>{item.estado}</span>
                      <ChevronRightIcon className="ceremony-chevron" />
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="corte-groups" role="tabpanel">
              {CORTE_ROLES.map((rol) => {
                const people = corte.filter((person) => person.rol === rol);
                if (!people.length) return null;
                const ready = people.filter((person) => person.confirmado === "Sí").length;
                return (
                  <div key={rol} className="corte-group">
                    <p className="corte-group-label">{rol}<span>{ready}/{people.length} confirmados</span></p>
                    <div className="corte-people">
                      {people.map((person, index) => (
                        <button key={person.id} className={`corte-person ${person.confirmado === "Sí" ? "confirmed" : ""}`} type="button" onClick={() => onSelectCorte(person.id)}>
                          <span className="corte-avatar">{person.nombre.trim() ? person.nombre.trim().slice(0, 1).toLocaleUpperCase("es") : index + 1}</span>
                          <span className="corte-person-copy"><strong>{person.nombre.trim() || `${rol} ${index + 1}`}</strong><small>{person.notas || person.telefono || "Información por completar"}</small></span>
                          <span className={`status-pill ${person.confirmado === "Sí" ? "confirmed" : ""}`}>{person.confirmado === "Sí" ? "Confirmado" : "Pendiente"}</span>
                          <ChevronRightIcon className="ceremony-chevron" />
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <>
          {section === "Recepción" ? (
            <div className="reception-module">
              {receptionTime ? (
                <button className="reception-time-card" type="button" onClick={() => onSelectLogistics("Recepción", receptionTime.clave)}>
                  <span className="reception-time-icon"><ClockIcon /></span>
                  <span className="reception-time-copy"><small>Hora de la recepción</small><strong>{receptionTime.valor || "Por definir"}</strong><span>{receptionTime.notas || "Toca para completar la información"}</span></span>
                  <ChevronRightIcon className="ceremony-chevron" />
                </button>
              ) : null}

              <div className="reception-guests-card">
                <div className="reception-card-heading">
                  <div><span className="section-block-title">Invitados de la recepción</span><small>Confirmaciones del formulario y el Sheet</small></div>
                  <button type="button" onClick={onOpenGuests}>Ver lista <ChevronRightIcon /></button>
                </div>
                <div className="reception-guest-stats">
                  <div><strong className="sage-number">{confirmed}</strong><span>confirmados</span></div>
                  <div><strong className="accent-number">{pendingGuests}</strong><span>por confirmar</span></div>
                </div>
                <p className="reception-guest-note">{totalReceptionGuests} personas registradas{chicken + beef > 0 ? ` · ${chicken} pollo · ${beef} carne` : ""}</p>
              </div>

              {receptionDetails.length ? (
                <div className="reception-details">
                  <div className="group-title"><span>Información de la recepción</span></div>
                  <div className="reception-detail-grid">
                    {receptionDetails.map((item) => {
                      const done = item.estado === "Listo";
                      return (
                        <button key={item.clave} className="reception-detail-card" type="button" onClick={() => onSelectLogistics("Recepción", item.clave)}>
                          <span className={`reception-card-icon ${done ? "done" : ""}`}>{receptionIcon(item.clave, done)}</span>
                          <span className="reception-card-copy"><small>{item.titulo}</small><strong>{item.valor || "Por completar"}</strong><span>{item.notas || `${item.responsable} · toca para editar`}</span></span>
                          <span className={`status-pill ${done ? "confirmed" : ""}`}>{item.estado}</span>
                          <ChevronRightIcon className="ceremony-chevron" />
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          {section !== "Recepción" && logistics.length ? (
            <div className="section-block">
              <div className="group-title"><span>Logística</span></div>
              <div className="logistics-list">
                {logistics.map((item) => <button key={item.clave} className="logistic-row" type="button" onClick={() => onSelectLogistics("Iglesia", item.clave)}><div className="task-copy"><strong>{item.titulo}</strong><span>{item.valor || item.notas || "Por completar"}</span></div><span className={`status-pill ${item.estado === "Listo" ? "confirmed" : ""}`}>{item.estado}</span><ChevronRightIcon className="ceremony-chevron" /></button>)}
              </div>
            </div>
          ) : null}

          <div className="section-block reception-tasks-block"><div className="group-title"><span>{section === "Recepción" ? "Pendientes por cerrar" : "Pendientes"}</span></div><div className="filter-row" role="group" aria-label="Filtrar por responsable">{(["Todas", "Novio", "Novia", "Ambos"] as const).map((option) => <button key={option} className={filter === option ? "active" : ""} type="button" onClick={() => setFilter(option)}>{option}</button>)}</div>
          <div className="task-list">{pending.map((task) => <TaskRow key={task.id} task={task} onToggle={onToggle} />)}{!pending.length ? <div className="empty-state"><CheckIcon /><strong>Todo listo por aquí</strong><span>Prueba otro filtro o agrega un pendiente.</span></div> : null}</div>
          {complete.length ? <div className="completed-group"><div className="group-title"><span>Listas: {complete.length}</span></div><div className="task-list complete-list">{complete.map((task) => <TaskRow key={task.id} task={task} onToggle={onToggle} />)}</div></div> : null}
          </div>
        </>
      )}
    </section>
  );
}

function AddChurchPersonSheet({
  open,
  onClose,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (person: CortePerson) => void;
}) {
  const shell = useShell();
  const [draft, setDraft] = useState<CortePerson>(() => ({ id: createCorteId(), nombre: "", rol: "Dama de la corte", confirmado: "No" }));

  useEffect(() => {
    if (open) setDraft({ id: createCorteId(), nombre: "", rol: "Dama de la corte", confirmado: "No" });
  }, [open]);

  return (
    <shell.Sheet open={open} onOpenChange={(next) => { if (!next) onClose(); }} title="Agregar persona de corte" description="Crea una tarjeta nueva y sincronízala con Tracker_Corte.">
      <div className="sheet-form church-sheet-form">
        <div className="sheet-overview" tabIndex={0} aria-label="Nueva persona de corte"><span>Nueva tarjeta</span><strong>Información por completar</strong><small>Elige el rol y guarda para añadirla al listado.</small></div>
        <div><span className="action-label">Rol</span><div className="segmented-actions role-options">{CORTE_ROLES.map((role) => <button key={role} className={draft.rol === role ? "selected" : ""} type="button" onClick={() => setDraft((current) => ({ ...current, rol: role }))}>{role}</button>)}</div></div>
        <label className="field-block" htmlFor="new-corte-name"><span>Nombre</span><shell.Field id="new-corte-name" autoFocus placeholder="Nombre completo" value={draft.nombre} onChange={(event) => setDraft((current) => ({ ...current, nombre: event.target.value }))} /></label>
        <label className="field-block" htmlFor="new-corte-phone"><span>Teléfono</span><shell.Field id="new-corte-phone" inputMode="tel" placeholder="Número de contacto" value={draft.telefono ?? ""} onChange={(event) => setDraft((current) => ({ ...current, telefono: event.target.value }))} /></label>
        <label className="field-block" htmlFor="new-corte-notes"><span>Notas</span><shell.Field id="new-corte-notes" placeholder="Vestuario, llegada o recordatorios" value={draft.notas ?? ""} onChange={(event) => setDraft((current) => ({ ...current, notas: event.target.value }))} /></label>
        <div><span className="action-label">Confirmación</span><div className="segmented-actions two-options">{(["No", "Sí"] as CortePerson["confirmado"][]).map((status) => <button key={status} className={draft.confirmado === status ? "selected" : ""} type="button" onClick={() => setDraft((current) => ({ ...current, confirmado: status }))}>{status === "Sí" ? "Confirmado" : "Pendiente"}</button>)}</div></div>
        <button className="primary-button" type="button" disabled={!draft.nombre.trim()} onClick={() => { shell.hideKeyboard(); onSave({ ...draft, nombre: draft.nombre.trim() }); }}><PlusIcon /> Agregar persona</button>
      </div>
    </shell.Sheet>
  );
}

function ChurchPersonSheet({
  open,
  person,
  onClose,
  onSave,
}: {
  open: boolean;
  person: CortePerson | null;
  onClose: () => void;
  onSave: (person: CortePerson) => void;
}) {
  const [draft, setDraft] = useState<CortePerson | null>(person);
  const shell = useShell();

  useEffect(() => {
    setDraft(person ? { ...person } : null);
  }, [person, open]);

  return (
    <shell.Sheet open={open} onOpenChange={(next) => { if (!next) onClose(); }} title={draft?.nombre.trim() || draft?.rol || "Corte ceremonial"} description={draft ? `Información de ${draft.rol.toLowerCase()}` : undefined}>
      {draft ? (
        <div className="sheet-form church-sheet-form">
          <div className="sheet-overview" tabIndex={0} aria-label={`${draft.rol}: ${draft.confirmado === "Sí" ? "confirmado" : "pendiente"}`}><span>{draft.rol}</span><strong>{draft.confirmado === "Sí" ? "Confirmado" : "Pendiente de confirmar"}</strong><small>Toca cualquier campo para actualizar la información.</small></div>
          <label className="field-block" htmlFor={`corte-name-${draft.id}`}><span>Nombre</span><shell.Field id={`corte-name-${draft.id}`} placeholder="Nombre completo" value={draft.nombre} onChange={(event) => setDraft((current) => current ? { ...current, nombre: event.target.value } : current)} /></label>
          <label className="field-block" htmlFor={`corte-phone-${draft.id}`}><span>Teléfono</span><shell.Field id={`corte-phone-${draft.id}`} inputMode="tel" placeholder="Número de contacto" value={draft.telefono ?? ""} onChange={(event) => setDraft((current) => current ? { ...current, telefono: event.target.value } : current)} /></label>
          <label className="field-block" htmlFor={`corte-notes-${draft.id}`}><span>Notas</span><shell.Field id={`corte-notes-${draft.id}`} placeholder="Vestuario, llegada o recordatorios" value={draft.notas ?? ""} onChange={(event) => setDraft((current) => current ? { ...current, notas: event.target.value } : current)} /></label>
          <div><span className="action-label">Confirmación</span><div className="segmented-actions two-options">{(["No", "Sí"] as CortePerson["confirmado"][]).map((status) => <button key={status} className={draft.confirmado === status ? "selected" : ""} type="button" onClick={() => setDraft((current) => current ? { ...current, confirmado: status } : current)}>{status === "Sí" ? "Confirmado" : "Pendiente"}</button>)}</div></div>
          <button className="primary-button" type="button" onClick={() => { shell.hideKeyboard(); onSave(draft); }}><CheckIcon /> Guardar persona</button>
        </div>
      ) : null}
    </shell.Sheet>
  );
}

function LogisticsDetailSheet({
  open,
  item,
  section,
  onClose,
  onSave,
}: {
  open: boolean;
  item: LogisticsItem | null;
  section: "Iglesia" | "Recepción";
  onClose: () => void;
  onSave: (item: LogisticsItem) => void;
}) {
  const [draft, setDraft] = useState<LogisticsItem | null>(item);
  const shell = useShell();
  const isChurch = section === "Iglesia";
  const isChecklist = isChurch && draft ? ["protocolo", "fotografia", "carro"].includes(draft.clave) : false;

  useEffect(() => {
    setDraft(item ? { ...item } : null);
  }, [item, open]);

  return (
    <shell.Sheet open={open} onOpenChange={(next) => { if (!next) onClose(); }} title={draft?.titulo ?? (isChurch ? "Ceremonia" : "Recepción")} description={isChecklist ? "Actualiza si el checklist ya está listo y deja los detalles necesarios." : `Consulta y actualiza la información de la ${isChurch ? "ceremonia en la iglesia" : "recepción"}.`}>
      {draft ? (
        <div className="sheet-form church-sheet-form">
          <div className="sheet-overview" tabIndex={0} aria-label={`${draft.titulo}: ${draft.valor || "por completar"}`}><span>Información actual</span><strong>{draft.valor || "Por completar"}</strong><small>{draft.notas || "Toca cualquier campo para actualizar este detalle."}</small></div>
          <label className="field-block" htmlFor={`logistics-value-${section}-${draft.clave}`}><span>{draft.clave === "hora_ceremonia" || draft.clave === "hora_recepcion" ? "Horario" : draft.clave === "oficiante" ? "Nombre" : "Información principal"}</span><shell.Field id={`logistics-value-${section}-${draft.clave}`} placeholder={draft.clave === "hora_ceremonia" ? "Ej. 11:00 a.m. – 12:30 p.m." : draft.clave === "hora_recepcion" ? "Ej. 5:00 p.m. – 11:00 p.m." : "Completa este dato"} value={draft.valor} onChange={(event) => setDraft((current) => current ? { ...current, valor: event.target.value } : current)} /></label>
          <label className="field-block" htmlFor={`logistics-notes-${section}-${draft.clave}`}><span>Notas</span><shell.Field id={`logistics-notes-${section}-${draft.clave}`} placeholder="Responsables, acuerdos o siguiente paso" value={draft.notas ?? ""} onChange={(event) => setDraft((current) => current ? { ...current, notas: event.target.value } : current)} /></label>
          <div><span className="action-label">{isChecklist ? "Estado del checklist" : "Estado"}</span><div className="segmented-actions">{(["Pendiente", "En progreso", "Listo"] as TaskStatus[]).map((status) => <button key={status} className={draft.estado === status ? "selected" : ""} type="button" onClick={() => setDraft((current) => current ? { ...current, estado: status } : current)}>{status}</button>)}</div></div>
          <div><span className="action-label">Responsable</span><div className="segmented-actions">{(["Novio", "Novia", "Ambos"] as Responsible[]).map((responsible) => <button key={responsible} className={draft.responsable === responsible ? "selected" : ""} type="button" onClick={() => setDraft((current) => current ? { ...current, responsable: responsible } : current)}>{responsible}</button>)}</div></div>
          <button className="primary-button" type="button" onClick={() => { shell.hideKeyboard(); onSave(draft); }}><CheckIcon /> Guardar cambios</button>
        </div>
      ) : null}
    </shell.Sheet>
  );
}

function TaskRow({ task, onToggle }: { task: Task; onToggle: (id: string) => void }) {
  const done = task.estado === "Listo";
  return (
    <article className={`task-row ${done ? "done" : ""}`}>
      <button className="task-check" type="button" aria-label={done ? `Marcar ${task.titulo} como pendiente` : `Marcar ${task.titulo} como listo`} onClick={() => onToggle(task.id)}>{done ? <CheckIcon /> : null}</button>
      <div className="task-copy">
        <strong>{task.titulo}</strong>
        {!done ? <span>{task.detalle}</span> : null}
        {!done ? <span className="task-tags"><b>{task.responsable}</b><b className={task.prioridad === "Alta" ? "high" : ""}>{task.prioridad}</b></span> : null}
      </div>
      {!done ? <small>{task.responsable}</small> : null}
    </article>
  );
}

function GuestsScreen({ guests, onAdd, onSelect }: { guests: GuestGroup[]; onAdd: () => void; onSelect: (id: string) => void }) {
  const [filter, setFilter] = useState<"Pendiente" | "Confirmado" | "Todos">(guests.some((guest) => guest.rsvp === "Pendiente") ? "Pendiente" : "Confirmado");
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const shell = useShell();
  const total = peopleCount(guests);
  const pending = peopleCount(guests, "Pendiente");
  const confirmed = peopleCount(guests, "Confirmado");
  const chicken = mealCount(guests, "Pollo");
  const beef = mealCount(guests, "Carne");
  const matching = guests.filter((guest) => guest.nombre.toLocaleLowerCase("es").includes(query.toLocaleLowerCase("es")));
  const pendingGroups = matching.filter((guest) => guest.rsvp === "Pendiente");
  const recentConfirmed = matching.filter((guest) => guest.rsvp === "Confirmado" && guest.actualizado).slice(0, 2);
  const visible = filter === "Pendiente" && !query
    ? [...pendingGroups.slice(0, 4), ...recentConfirmed, ...pendingGroups.slice(4)]
    : matching.filter((guest) => filter === "Todos" || guest.rsvp === filter);
  return (
    <section className="guests-page page-shell">
      <header className="screen-header guests-header">
        {searchOpen ? <div className="search-box"><MagnifyingGlassIcon /><shell.Field autoFocus aria-label="Buscar invitados" placeholder="Buscar nombre" value={query} onChange={(event) => setQuery(event.target.value)} /><button type="button" onClick={() => { shell.hideKeyboard(); setSearchOpen(false); setQuery(""); }}>Cancelar</button></div> : <><h1>Invitados</h1><div className="header-actions"><button className="icon-button" type="button" aria-label="Buscar invitados" onClick={() => setSearchOpen(true)}><MagnifyingGlassIcon /></button><button className="icon-button" type="button" aria-label="Agregar invitados" onClick={onAdd}><PlusIcon /></button></div></>}
      </header>
      <div className="guest-stats"><div><strong className="accent-number">{pending}</strong><span>sin responder</span></div><div><strong className="sage-number">{confirmed}</strong><span>confirmados</span></div><div><strong>{total}</strong><span>en total</span></div></div>
      {chicken + beef > 0 ? <p className="meal-breakdown">{chicken} pollo · {beef} carne</p> : null}
      <div className="filter-row guest-filters" role="group" aria-label="Filtrar invitados"><button className={filter === "Pendiente" ? "active" : ""} type="button" onClick={() => setFilter("Pendiente")}>Sin responder</button><button className={filter === "Confirmado" ? "active" : ""} type="button" onClick={() => setFilter("Confirmado")}>Confirmados</button><button className={filter === "Todos" ? "active" : ""} type="button" onClick={() => setFilter("Todos")}>Todos</button></div>
      <div className="guest-table-head" aria-hidden="true"><span>Grupo</span><span>Personas</span><span>Invitado a</span><span>Plato</span><span>Transporte</span><span>Confirmación</span></div>
      <div className="guest-list">
        {visible.map((guest, index) => (
          <div key={guest.id} className="guest-card-wrap">
            {index > 0 && visible[index - 1]?.rsvp !== guest.rsvp ? <div className="group-title"><span>{guest.rsvp === "Confirmado" ? "Confirmados hace poco" : "Más pendientes"}</span></div> : null}
            <button className="guest-card" type="button" onClick={() => onSelect(guest.id)}>
              <span className="guest-copy">
                <strong>{guest.nombre}</strong>
                <small className="guest-meta">
                  <span className="guest-people">{guest.personas} {guest.personas === 1 ? "persona" : "personas"}</span>
                  <span className="guest-where">{guest.invitado_a}</span>
                  <span className="guest-meal">{guest.plato ?? "Sin plato"}</span>
                  <span className="guest-transport">{guest.transporte}</span>
                </small>
              </span>
              <span className={`status-pill ${guest.rsvp === "Confirmado" ? "confirmed" : guest.rsvp === "No asiste" ? "declined" : ""}`}>{guest.rsvp === "Pendiente" ? "Sin responder" : guest.rsvp}</span>
            </button>
          </div>
        ))}
        {!visible.length ? <div className="empty-state"><PersonIcon /><strong>No encontramos invitados</strong><span>Cambia el filtro o prueba otro nombre.</span></div> : null}
      </div>
    </section>
  );
}

function BottomNav({ current, hidden, onNavigate }: { current: Screen; hidden: boolean; onNavigate: (screen: Screen) => void }) {
  const items = [
    { label: "Resumen", screen: "Resumen" as Screen, Icon: HomeIcon },
    { label: "Iglesia", screen: "Iglesia" as Screen, Icon: BookmarkIcon },
    { label: "Recepción", screen: "Recepción" as Screen, Icon: MixerHorizontalIcon },
    { label: "Invitados", screen: "Invitados" as Screen, Icon: PersonIcon },
  ];
  return <nav className={`bottom-nav ${hidden ? "nav-hidden" : ""}`} aria-label="Navegación principal">{items.map(({ label, screen, Icon }) => <button key={label} className={current === screen ? "active" : ""} type="button" onClick={() => onNavigate(screen)}><Icon /><span>{label}</span></button>)}</nav>;
}

function AddTaskSheet({ open, section, onClose, onAdd }: { open: boolean; section: Section; onClose: () => void; onAdd: (task: Task) => void }) {
  const [title, setTitle] = useState("");
  const [detail, setDetail] = useState("");
  const shell = useShell();
  return <shell.Sheet open={open} onOpenChange={(next) => { if (!next) onClose(); }} title={`Nuevo pendiente de ${section}`} description="Agrégalo ahora y completen el detalle cuando lo tengan claro."><div className="sheet-form"><label className="field-block" htmlFor="task-title"><span>Pendiente</span><shell.Field id="task-title" placeholder="Ej. Confirmar música" value={title} onChange={(event) => setTitle(event.target.value)} /></label><label className="field-block" htmlFor="task-detail"><span>Detalle</span><shell.Field id="task-detail" placeholder="Nota breve o siguiente paso" value={detail} onChange={(event) => setDetail(event.target.value)} /></label><button className="primary-button" type="button" disabled={!title.trim()} onClick={() => { shell.hideKeyboard(); onAdd({ id: `task-${Date.now()}`, seccion: section, titulo: title.trim(), detalle: detail.trim() || "Sin detalle", responsable: "Ambos", estado: "Pendiente", prioridad: "Media" }); setTitle(""); setDetail(""); }}><PlusIcon /> Agregar pendiente</button></div></shell.Sheet>;
}

function AddGuestSheet({ open, onClose, onAdd }: { open: boolean; onClose: () => void; onAdd: (guest: GuestGroup) => void }) {
  const [name, setName] = useState("");
  const [count, setCount] = useState("1");
  const shell = useShell();
  return <shell.Sheet open={open} onOpenChange={(next) => { if (!next) onClose(); }} title="Agregar invitados" description="Puedes registrar una persona o un grupo familiar."><div className="sheet-form"><label className="field-block" htmlFor="guest-name"><span>Nombre o grupo</span><shell.Field id="guest-name" placeholder="Ej. Familia Ramírez" value={name} onChange={(event) => setName(event.target.value)} /></label><label className="field-block" htmlFor="guest-count"><span>Número de personas</span><shell.Field id="guest-count" inputMode="numeric" placeholder="1" value={count} onChange={(event) => setCount(event.target.value.replace(/[^0-9]/g, ""))} /></label><button className="primary-button" type="button" disabled={!name.trim()} onClick={() => { shell.hideKeyboard(); onAdd({ id: `guest-${Date.now()}`, nombre: name.trim(), personas: Math.max(1, Number(count) || 1), invitado_a: "Recepción", rsvp: "Pendiente", transporte: "Por definir" }); setName(""); setCount("1"); }}><PersonIcon /> Agregar invitados</button></div></shell.Sheet>;
}
