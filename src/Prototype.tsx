import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  BookmarkIcon,
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ClockIcon,
  GearIcon,
  HomeIcon,
  MagnifyingGlassIcon,
  MixerHorizontalIcon,
  PersonIcon,
  PlusIcon,
  ReloadIcon,
} from "@radix-ui/react-icons";
import "@fontsource/instrument-serif/400.css";
import "@fontsource/instrument-sans/400.css";
import "@fontsource/instrument-sans/500.css";
import "@fontsource/instrument-sans/600.css";
import {
  BottomSheet,
  KeyboardInput,
  MobileScroll,
  useKeyboard,
  useKeyboardInsets,
} from "./mobile";

type Section = "Iglesia" | "Recepción" | "General";
type Screen = "Resumen" | Section | "Invitados";
type Responsible = "Novio" | "Novia" | "Ambos";
type TaskStatus = "Pendiente" | "En progreso" | "Bloqueado" | "Listo";
type GuestStatus = "Pendiente" | "Confirmado" | "No asiste";
type Transport = "Uber" | "Interno" | "Propio" | "Por definir";

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
  actualizado?: string;
};

type Settings = {
  weddingDate: string;
  apiUrl: string;
  token: string;
};

type PendingMutation = {
  hoja: "Config" | "Tareas" | "Invitados";
  payload: Record<string, unknown>;
};

const STORAGE_KEY = "nuestra-boda-v1";
const QUEUE_KEY = "nuestra-boda-queue-v1";

const initialTasks: Task[] = [
  { id: "ig-1", seccion: "Iglesia", titulo: "Damas y caballeros de la corte", detalle: "4 de 6 confirmados", responsable: "Novia", estado: "Pendiente", prioridad: "Alta" },
  { id: "ig-2", seccion: "Iglesia", titulo: "Decoración de la iglesia", detalle: "Confirmada con la parroquia", responsable: "Novia", estado: "Listo", prioridad: "Media" },
  { id: "ig-3", seccion: "Iglesia", titulo: "Testigos", detalle: "Documentos entregados", responsable: "Ambos", estado: "Listo", prioridad: "Alta" },
  { id: "ig-4", seccion: "Iglesia", titulo: "Pajecitos", detalle: "Falta confirmar con los papás", responsable: "Novia", estado: "Pendiente", prioridad: "Media" },
  { id: "ig-5", seccion: "Iglesia", titulo: "Carro de los novios", detalle: "Sin cotizar", responsable: "Novio", estado: "Pendiente", prioridad: "Media" },
  { id: "ig-6", seccion: "Iglesia", titulo: "Fotógrafa confirmada", detalle: "Cobertura de la ceremonia", responsable: "Ambos", estado: "Listo", prioridad: "Alta" },
  { id: "ig-7", seccion: "Iglesia", titulo: "Protocolo de la iglesia", detalle: "Pedirlo en la parroquia", responsable: "Ambos", estado: "Pendiente", prioridad: "Alta" },
  { id: "ig-8", seccion: "Iglesia", titulo: "Lista de invitados a la iglesia", detalle: "12 personas sin responder", responsable: "Ambos", estado: "Pendiente", prioridad: "Alta" },
  { id: "rec-1", seccion: "Recepción", titulo: "DJ, equipo y staff", detalle: "Confirmar montaje y horarios", responsable: "Novio", estado: "Pendiente", prioridad: "Alta" },
  { id: "rec-2", seccion: "Recepción", titulo: "Fotógrafa de recepción", detalle: "Invitada y staff incluidos", responsable: "Ambos", estado: "Listo", prioridad: "Alta" },
  { id: "rec-3", seccion: "Recepción", titulo: "Transporte de invitados", detalle: "Definir Uber o transporte interno", responsable: "Novio", estado: "Pendiente", prioridad: "Media" },
  { id: "rec-4", seccion: "Recepción", titulo: "Confirmación de invitados", detalle: "34 personas sin responder", responsable: "Ambos", estado: "En progreso", prioridad: "Alta" },
  { id: "rec-5", seccion: "Recepción", titulo: "Contrato y cotización final", detalle: "Esperando respuesta del salón", responsable: "Ambos", estado: "Pendiente", prioridad: "Alta", fecha_limite: "2026-09-07" },
  { id: "gen-1", seccion: "General", titulo: "Fechas del traje del novio", detalle: "Agendar prueba final", responsable: "Novio", estado: "Pendiente", prioridad: "Media" },
  { id: "gen-2", seccion: "General", titulo: "Fechas del vestido de la novia", detalle: "Confirmar última prueba", responsable: "Novia", estado: "Pendiente", prioridad: "Alta" },
  { id: "gen-3", seccion: "General", titulo: "Hotel de noche de bodas", detalle: "Revisar opciones y reservar", responsable: "Ambos", estado: "Pendiente", prioridad: "Media" },
];

const initialGuests: GuestGroup[] = [
  { id: "g-1", nombre: "Familia Restrepo", personas: 4, invitado_a: "Iglesia", rsvp: "Pendiente", transporte: "Uber" },
  { id: "g-2", nombre: "Ana María Gómez", personas: 2, invitado_a: "Recepción", rsvp: "Pendiente", transporte: "Interno" },
  { id: "g-3", nombre: "Tíos de la novia", personas: 6, invitado_a: "Iglesia", rsvp: "Pendiente", transporte: "Por definir" },
  { id: "g-4", nombre: "Compañeros de oficina", personas: 8, invitado_a: "Recepción", rsvp: "Pendiente", transporte: "Uber" },
  { id: "g-5", nombre: "Familia Mejía", personas: 5, invitado_a: "Recepción", rsvp: "Pendiente", transporte: "Propio" },
  { id: "g-6", nombre: "Amigos de universidad", personas: 4, invitado_a: "Recepción", rsvp: "Pendiente", transporte: "Uber" },
  { id: "g-7", nombre: "Vecinos de los novios", personas: 2, invitado_a: "Iglesia", rsvp: "Pendiente", transporte: "Interno" },
  { id: "g-8", nombre: "Primos de la novia", personas: 3, invitado_a: "Recepción", rsvp: "Pendiente", transporte: "Por definir" },
  { id: "g-9", nombre: "Familia Vélez", personas: 3, invitado_a: "Ambas", rsvp: "Confirmado", transporte: "Propio", actualizado: "Hoy" },
  { id: "g-10", nombre: "Padrinos de bautizo", personas: 2, invitado_a: "Ambas", rsvp: "Confirmado", transporte: "Interno", actualizado: "Hoy" },
  { id: "g-11", nombre: "Familia Espinosa", personas: 12, invitado_a: "Ambas", rsvp: "Confirmado", transporte: "Propio" },
  { id: "g-12", nombre: "Familia Cubillos", personas: 10, invitado_a: "Ambas", rsvp: "Confirmado", transporte: "Propio" },
  { id: "g-13", nombre: "Amigos de la universidad", personas: 14, invitado_a: "Recepción", rsvp: "Confirmado", transporte: "Uber" },
  { id: "g-14", nombre: "Familia Gómez", personas: 9, invitado_a: "Ambas", rsvp: "Confirmado", transporte: "Interno" },
  { id: "g-15", nombre: "Compañeros de ella", personas: 11, invitado_a: "Recepción", rsvp: "Confirmado", transporte: "Uber" },
  { id: "g-16", nombre: "Primos del novio", personas: 8, invitado_a: "Ambas", rsvp: "Confirmado", transporte: "Propio" },
  { id: "g-17", nombre: "Amigos de Medellín", personas: 7, invitado_a: "Recepción", rsvp: "Confirmado", transporte: "Interno" },
  { id: "g-18", nombre: "Familia Ospina", personas: 6, invitado_a: "Ambas", rsvp: "Confirmado", transporte: "Propio" },
  { id: "g-19", nombre: "Tíos del novio", personas: 4, invitado_a: "Ambas", rsvp: "Confirmado", transporte: "Uber" },
];

function loadInitialState() {
  if (typeof window === "undefined") {
    return { tasks: initialTasks, guests: initialGuests, settings: { weddingDate: "", apiUrl: "", token: "" } };
  }

  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (!saved) throw new Error("No saved data");
    const parsed = JSON.parse(saved) as { tasks?: Task[]; guests?: GuestGroup[]; settings?: Settings };
    return {
      tasks: parsed.tasks?.length ? parsed.tasks : initialTasks,
      guests: parsed.guests?.length ? parsed.guests : initialGuests,
      settings: parsed.settings ?? { weddingDate: "", apiUrl: "", token: "" },
    };
  } catch {
    return { tasks: initialTasks, guests: initialGuests, settings: { weddingDate: "", apiUrl: "", token: "" } };
  }
}

function peopleCount(groups: GuestGroup[], status?: GuestStatus) {
  return groups
    .filter((group) => (status ? group.rsvp === status : true))
    .reduce((total, group) => total + group.personas, 0);
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

function readQueue(): PendingMutation[] {
  try {
    return JSON.parse(window.localStorage.getItem(QUEUE_KEY) ?? "[]") as PendingMutation[];
  } catch {
    return [];
  }
}

async function sendMutation(settings: Settings, mutation: PendingMutation) {
  if (!settings.apiUrl || !settings.token) throw new Error("Sin conexión configurada");
  const response = await fetch(settings.apiUrl, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ accion: "actualizar", hoja: mutation.hoja, token: settings.token, payload: mutation.payload }),
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
  const [settings, setSettings] = useState<Settings>(initial.settings);
  const [settingsDraft, setSettingsDraft] = useState<Settings>(initial.settings);
  const [sheet, setSheet] = useState<"settings" | "task" | "guest" | "guest-detail" | null>(null);
  const [selectedGuestId, setSelectedGuestId] = useState<string | null>(null);
  const [connectionState, setConnectionState] = useState<"idle" | "syncing" | "success" | "error">("idle");
  const keyboard = useKeyboard();
  const { isKeyboardVisible } = useKeyboardInsets();

  useEffect(() => {
    if (isKeyboardVisible) return;
    const frame = window.requestAnimationFrame(() => {
      const deviceScreen = document.querySelector<HTMLElement>('[data-testid="device-screen"]');
      if (deviceScreen) deviceScreen.scrollTop = 0;
    });
    return () => window.cancelAnimationFrame(frame);
  }, [isKeyboardVisible, screen]);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ tasks, guests, settings }));
  }, [tasks, guests, settings]);

  useEffect(() => {
    const flushQueue = async () => {
      const queue = readQueue();
      if (!queue.length || !settings.apiUrl || !settings.token) return;
      const remaining: PendingMutation[] = [];
      for (const mutation of queue) {
        try {
          await sendMutation(settings, mutation);
        } catch {
          remaining.push(mutation);
        }
      }
      window.localStorage.setItem(QUEUE_KEY, JSON.stringify(remaining));
    };
    window.addEventListener("online", flushQueue);
    void flushQueue();
    return () => window.removeEventListener("online", flushQueue);
  }, [settings]);

  const navigate = (next: Screen) => {
    keyboard.hide();
    setScreen(next);
  };

  const persistMutation = async (mutation: PendingMutation) => {
    if (!settings.apiUrl || !settings.token) return;
    try {
      await sendMutation(settings, mutation);
    } catch {
      const queue = readQueue();
      window.localStorage.setItem(QUEUE_KEY, JSON.stringify([...queue, mutation]));
    }
  };

  const toggleTask = (id: string) => {
    const current = tasks.find((task) => task.id === id);
    if (!current) return;
    const updated: Task = { ...current, estado: current.estado === "Listo" ? "Pendiente" : "Listo" };
    setTasks((items) => items.map((task) => task.id === id ? updated : task));
    void persistMutation({ hoja: "Tareas", payload: updated as unknown as Record<string, unknown> });
  };

  const updateGuest = (id: string, changes: Partial<GuestGroup>) => {
    const current = guests.find((guest) => guest.id === id);
    if (!current) return;
    const updated: GuestGroup = { ...current, ...changes, actualizado: "Ahora" };
    setGuests((items) => items.map((guest) => guest.id === id ? updated : guest));
    void persistMutation({ hoja: "Invitados", payload: updated as unknown as Record<string, unknown> });
  };

  const selectedGuest = guests.find((guest) => guest.id === selectedGuestId) ?? null;

  return (
    <div className="wedding-app">
      <MobileScroll key={screen} className="app-screen">
        <main className="wedding-screen" data-testid="wedding-screen" aria-live="polite">
          {screen === "Resumen" ? (
            <SummaryScreen tasks={tasks} guests={guests} settings={settings} onOpenSettings={() => { setSettingsDraft(settings); setSheet("settings"); }} onNavigate={navigate} />
          ) : screen === "Invitados" ? (
            <GuestsScreen guests={guests} onAdd={() => setSheet("guest")} onSelect={(id) => { setSelectedGuestId(id); setSheet("guest-detail"); }} />
          ) : (
            <TasksScreen section={screen} tasks={tasks} onBack={() => navigate("Resumen")} onAdd={() => setSheet("task")} onToggle={toggleTask} />
          )}
        </main>
      </MobileScroll>

      <BottomNav current={screen} hidden={isKeyboardVisible} onNavigate={navigate} />

      <BottomSheet open={sheet === "settings"} onOpenChange={(open) => setSheet(open ? "settings" : null)} title="Conectar y configurar" description="La fecha se sincroniza en Config y la URL/token conectan el Google Sheet.">
        <div className="sheet-form">
          <label className="field-block" htmlFor="wedding-date"><span>Fecha de la boda</span><KeyboardInput id="wedding-date" inputMode="numeric" placeholder="2026-12-05" value={settingsDraft.weddingDate} onChange={(event) => setSettingsDraft((current) => ({ ...current, weddingDate: event.target.value }))} /></label>
          <label className="field-block" htmlFor="api-url"><span>URL del Web App</span><KeyboardInput id="api-url" inputMode="url" placeholder="https://script.google.com/macros/s/..." value={settingsDraft.apiUrl} onChange={(event) => setSettingsDraft((current) => ({ ...current, apiUrl: event.target.value }))} /></label>
          <label className="field-block" htmlFor="api-token"><span>Token privado</span><KeyboardInput id="api-token" type="password" placeholder="Pega el token del Apps Script" value={settingsDraft.token} onChange={(event) => setSettingsDraft((current) => ({ ...current, token: event.target.value }))} /></label>
          <p className={`connection-message ${connectionState}`}>{connectionState === "syncing" ? "Conectando..." : connectionState === "success" ? "Datos actualizados desde Google Sheets." : connectionState === "error" ? "No pudimos conectar. Revisa la URL y el token." : "Sin credenciales, la app funciona con datos de prueba guardados localmente."}</p>
          <button className="primary-button" type="button" onClick={async () => {
            keyboard.hide();
            const localDateChanged = settingsDraft.weddingDate !== settings.weddingDate;
            setSettings(settingsDraft);
            if (!settingsDraft.apiUrl || !settingsDraft.token) { setConnectionState("idle"); setSheet(null); return; }
            setConnectionState("syncing");
            try {
              const joiner = settingsDraft.apiUrl.includes("?") ? "&" : "?";
              const response = await fetch(`${settingsDraft.apiUrl}${joiner}token=${encodeURIComponent(settingsDraft.token)}`);
              if (!response.ok) throw new Error("Bad response");
              const data = await response.json() as { ok?: boolean; Config?: Array<Record<string, unknown>>; Tareas?: Task[]; Invitados?: Array<Record<string, unknown>> };
              if (data.ok === false) throw new Error("Sheet rechazó la conexión");
              const remoteDate = String(data.Config?.find((row) => row.clave === "fecha_boda")?.valor ?? "");
              const dateToUse = localDateChanged ? settingsDraft.weddingDate : remoteDate || settingsDraft.weddingDate;
              setSettings((current) => ({ ...current, weddingDate: dateToUse }));
              setSettingsDraft((current) => ({ ...current, weddingDate: dateToUse }));
              if (localDateChanged) await sendMutation(settingsDraft, { hoja: "Config", payload: { clave: "fecha_boda", valor: dateToUse } });
              if (Array.isArray(data.Tareas) && data.Tareas.length) setTasks(data.Tareas);
              if (Array.isArray(data.Invitados) && data.Invitados.length) {
                setGuests(data.Invitados.map((row, index) => ({
                  id: String(row.id ?? `sheet-${index}`),
                  nombre: String(row.nombre ?? "Invitado"),
                  personas: Math.max(1, Number(row.personas ?? Number(row.acompanantes ?? 0) + 1)),
                  invitado_a: (row.invitado_a === "Iglesia" || row.invitado_a === "Recepción" || row.invitado_a === "Ambas" ? row.invitado_a : "Recepción") as GuestGroup["invitado_a"],
                  rsvp: (row.rsvp === "Confirmado" || row.rsvp === "No asiste" ? row.rsvp : "Pendiente") as GuestStatus,
                  transporte: (row.transporte === "Uber" || row.transporte === "Interno" || row.transporte === "Propio" ? row.transporte : "Por definir") as Transport,
                })));
              }
              setConnectionState("success");
            } catch {
              setConnectionState("error");
            }
          }}><ReloadIcon /> Guardar y sincronizar</button>
        </div>
      </BottomSheet>

      <AddTaskSheet open={sheet === "task"} section={screen === "Resumen" || screen === "Invitados" ? "General" : screen} onClose={() => setSheet(null)} onAdd={(task) => { setTasks((current) => [...current, task]); setSheet(null); void persistMutation({ hoja: "Tareas", payload: task as unknown as Record<string, unknown> }); }} />
      <AddGuestSheet open={sheet === "guest"} onClose={() => setSheet(null)} onAdd={(guest) => { setGuests((current) => [guest, ...current]); setSheet(null); void persistMutation({ hoja: "Invitados", payload: guest as unknown as Record<string, unknown> }); }} />

      <BottomSheet open={sheet === "guest-detail" && Boolean(selectedGuest)} onOpenChange={(open) => setSheet(open ? "guest-detail" : null)} title={selectedGuest?.nombre ?? "Invitado"} description={selectedGuest ? `${selectedGuest.personas} ${selectedGuest.personas === 1 ? "persona" : "personas"} para ${selectedGuest.invitado_a.toLowerCase()}` : undefined}>
        {selectedGuest ? (
          <div className="guest-actions">
            <div><span className="action-label">Confirmación</span><div className="segmented-actions">{(["Pendiente", "Confirmado", "No asiste"] as GuestStatus[]).map((status) => <button key={status} className={selectedGuest.rsvp === status ? "selected" : ""} type="button" onClick={() => updateGuest(selectedGuest.id, { rsvp: status })}>{status}</button>)}</div></div>
            <div><span className="action-label">Transporte</span><div className="transport-grid">{(["Uber", "Interno", "Propio", "Por definir"] as Transport[]).map((transport) => <button key={transport} className={selectedGuest.transporte === transport ? "selected" : ""} type="button" onClick={() => updateGuest(selectedGuest.id, { transporte: transport })}>{transport}</button>)}</div></div>
          </div>
        ) : null}
      </BottomSheet>
    </div>
  );
}

function SummaryScreen({ tasks, guests, settings, onNavigate, onOpenSettings }: { tasks: Task[]; guests: GuestGroup[]; settings: Settings; onNavigate: (screen: Screen) => void; onOpenSettings: () => void }) {
  const total = peopleCount(guests);
  const confirmed = peopleCount(guests, "Confirmado");
  const pending = peopleCount(guests, "Pendiente");
  const pendingChurch = guests.filter((group) => group.rsvp === "Pendiente" && group.invitado_a === "Iglesia").reduce((sum, group) => sum + group.personas, 0);
  const pendingReception = pending - pendingChurch;
  const countdown = daysUntil(settings.weddingDate);
  const urgent = tasks.find((task) => task.id === "rec-5");
  return (
    <section className="summary-page page-shell">
      <header className="summary-header"><div><h1>Nuestra boda</h1><p className="date-line"><span>{formatWeddingDate(settings.weddingDate)}</span><span>{countdown === null ? "configura la fecha" : `faltan ${countdown} días`}</span></p></div><button className="icon-button" type="button" aria-label="Abrir configuración" onClick={onOpenSettings}><GearIcon /></button></header>
      <button className="hero-card" type="button" onClick={() => onNavigate("Invitados")} aria-label={`${pending} personas por confirmar`}>
        <ProgressRing percent={total ? (confirmed / total) * 100 : 0}><span className="hero-number">{pending}</span><span className="hero-label">por confirmar</span></ProgressRing>
        <div className="hero-stats"><div><strong>{pendingChurch}</strong><span>Iglesia</span></div><div><strong>{pendingReception}</strong><span>Recepción</span></div><div><strong className="sage-number">{confirmed}</strong><span>Confirmados</span></div></div>
      </button>
      <div className="section-list">
        {(["Iglesia", "Recepción", "General"] as Section[]).map((section) => {
          const progress = sectionProgress(tasks, section);
          const descriptions: Record<Section, string> = { Iglesia: "Pajecitos, carro, protocolo", Recepción: "DJ y staff, transporte, contrato", General: "Traje, vestido, hotel" };
          return <button key={section} className="section-card" type="button" onClick={() => onNavigate(section)}><ProgressRing percent={progress.percent} size={36} stroke={4} /><span className="section-copy"><strong>{section}</strong><small>{descriptions[section]}</small></span><span className="section-count">{progress.done}/{progress.total}</span><ChevronRightIcon className="section-chevron" /></button>;
        })}
      </div>
      {urgent ? <button className="urgent-card" type="button" onClick={() => onNavigate("Recepción")}><ClockIcon /><span><strong>{urgent.titulo}</strong><small>Recepción: {urgent.detalle.toLowerCase()}</small></span><b>7 SEP</b></button> : null}
    </section>
  );
}

function TasksScreen({ section, tasks, onBack, onAdd, onToggle }: { section: Section; tasks: Task[]; onBack: () => void; onAdd: () => void; onToggle: (id: string) => void }) {
  const [filter, setFilter] = useState<"Todas" | Responsible>("Todas");
  const sectionTasks = tasks.filter((task) => task.seccion === section);
  const visible = sectionTasks.filter((task) => filter === "Todas" || task.responsable === filter);
  const pending = visible.filter((task) => task.estado !== "Listo");
  const complete = visible.filter((task) => task.estado === "Listo");
  const progress = sectionProgress(tasks, section);
  return (
    <section className="tasks-page page-shell">
      <header className="screen-header"><button className="icon-button back-button" type="button" aria-label="Volver al resumen" onClick={onBack}><ChevronLeftIcon /></button><h1>{section}</h1><button className="icon-button" type="button" aria-label={`Agregar pendiente de ${section}`} onClick={onAdd}><PlusIcon /></button></header>
      <div className="section-progress" aria-label={`${progress.done} de ${progress.total} tareas listas`}><span style={{ width: `${Math.max(4, progress.percent)}%` }} /></div><p className="progress-caption">{progress.done} de {progress.total} listas</p>
      <div className="filter-row" role="group" aria-label="Filtrar por responsable">{(["Todas", "Novio", "Novia", "Ambos"] as const).map((option) => <button key={option} className={filter === option ? "active" : ""} type="button" onClick={() => setFilter(option)}>{option}</button>)}</div>
      <div className="task-list">{pending.map((task) => <TaskRow key={task.id} task={task} onToggle={onToggle} />)}{!pending.length ? <div className="empty-state"><CheckIcon /><strong>Todo listo por aquí</strong><span>Prueba otro filtro o agrega un pendiente.</span></div> : null}</div>
      {complete.length ? <div className="completed-group"><div className="group-title"><span>Listas: {complete.length}</span></div><div className="task-list complete-list">{complete.map((task) => <TaskRow key={task.id} task={task} onToggle={onToggle} />)}</div></div> : null}
    </section>
  );
}

function TaskRow({ task, onToggle }: { task: Task; onToggle: (id: string) => void }) {
  const done = task.estado === "Listo";
  return <article className={`task-row ${done ? "done" : ""}`}><button className="task-check" type="button" aria-label={done ? `Marcar ${task.titulo} como pendiente` : `Marcar ${task.titulo} como listo`} onClick={() => onToggle(task.id)}>{done ? <CheckIcon /> : null}</button><div className="task-copy"><strong>{task.titulo}</strong>{!done ? <span>{task.detalle}</span> : null}{!done && task.id === "ig-1" ? <span className="inline-count-progress"><i /></span> : null}</div>{!done ? <small>{task.responsable}</small> : null}</article>;
}

function GuestsScreen({ guests, onAdd, onSelect }: { guests: GuestGroup[]; onAdd: () => void; onSelect: (id: string) => void }) {
  const [filter, setFilter] = useState<"Pendiente" | "Confirmado" | "Todos">("Pendiente");
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const keyboard = useKeyboard();
  const total = peopleCount(guests);
  const pending = peopleCount(guests, "Pendiente");
  const confirmed = peopleCount(guests, "Confirmado");
  const matching = guests.filter((guest) => guest.nombre.toLocaleLowerCase("es").includes(query.toLocaleLowerCase("es")));
  const pendingGroups = matching.filter((guest) => guest.rsvp === "Pendiente");
  const recentConfirmed = matching.filter((guest) => guest.rsvp === "Confirmado" && guest.actualizado).slice(0, 2);
  const visible = filter === "Pendiente" && !query
    ? [...pendingGroups.slice(0, 4), ...recentConfirmed, ...pendingGroups.slice(4)]
    : matching.filter((guest) => filter === "Todos" || guest.rsvp === filter);
  return (
    <section className="guests-page page-shell">
      <header className="screen-header guests-header">
        {searchOpen ? <div className="search-box"><MagnifyingGlassIcon /><KeyboardInput autoFocus aria-label="Buscar invitados" placeholder="Buscar nombre" value={query} onChange={(event) => setQuery(event.target.value)} /><button type="button" onClick={() => { keyboard.hide(); setSearchOpen(false); setQuery(""); }}>Cancelar</button></div> : <><h1>Invitados</h1><div className="header-actions"><button className="icon-button" type="button" aria-label="Buscar invitados" onClick={() => setSearchOpen(true)}><MagnifyingGlassIcon /></button><button className="icon-button" type="button" aria-label="Agregar invitados" onClick={onAdd}><PlusIcon /></button></div></>}
      </header>
      <div className="guest-stats"><div><strong className="accent-number">{pending}</strong><span>sin responder</span></div><div><strong className="sage-number">{confirmed}</strong><span>confirmados</span></div><div><strong>{total}</strong><span>en total</span></div></div>
      <div className="filter-row guest-filters" role="group" aria-label="Filtrar invitados"><button className={filter === "Pendiente" ? "active" : ""} type="button" onClick={() => setFilter("Pendiente")}>Sin responder</button><button className={filter === "Confirmado" ? "active" : ""} type="button" onClick={() => setFilter("Confirmado")}>Confirmados</button><button className={filter === "Todos" ? "active" : ""} type="button" onClick={() => setFilter("Todos")}>Todos</button></div>
      <div className="guest-list">
        {visible.map((guest, index) => <div key={guest.id} className="guest-card-wrap">{index > 0 && visible[index - 1]?.rsvp !== guest.rsvp ? <div className="group-title"><span>{guest.rsvp === "Confirmado" ? "Confirmados hace poco" : "Más pendientes"}</span></div> : null}<button className="guest-card" type="button" onClick={() => onSelect(guest.id)}><span className="guest-copy"><strong>{guest.nombre}</strong><small>{guest.personas} {guest.personas === 1 ? "persona" : "personas"}, {guest.invitado_a}, {guest.transporte}</small></span><span className={`status-pill ${guest.rsvp === "Confirmado" ? "confirmed" : guest.rsvp === "No asiste" ? "declined" : ""}`}>{guest.rsvp === "Pendiente" ? "Sin responder" : guest.rsvp}</span></button></div>)}
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
  const keyboard = useKeyboard();
  return <BottomSheet open={open} onOpenChange={(next) => { if (!next) onClose(); }} title={`Nuevo pendiente de ${section}`} description="Agrégalo ahora y completen el detalle cuando lo tengan claro."><div className="sheet-form"><label className="field-block" htmlFor="task-title"><span>Pendiente</span><KeyboardInput id="task-title" placeholder="Ej. Confirmar música" value={title} onChange={(event) => setTitle(event.target.value)} /></label><label className="field-block" htmlFor="task-detail"><span>Detalle</span><KeyboardInput id="task-detail" placeholder="Nota breve o siguiente paso" value={detail} onChange={(event) => setDetail(event.target.value)} /></label><button className="primary-button" type="button" disabled={!title.trim()} onClick={() => { keyboard.hide(); onAdd({ id: `task-${Date.now()}`, seccion: section, titulo: title.trim(), detalle: detail.trim() || "Sin detalle", responsable: "Ambos", estado: "Pendiente", prioridad: "Media" }); setTitle(""); setDetail(""); }}><PlusIcon /> Agregar pendiente</button></div></BottomSheet>;
}

function AddGuestSheet({ open, onClose, onAdd }: { open: boolean; onClose: () => void; onAdd: (guest: GuestGroup) => void }) {
  const [name, setName] = useState("");
  const [count, setCount] = useState("1");
  const keyboard = useKeyboard();
  return <BottomSheet open={open} onOpenChange={(next) => { if (!next) onClose(); }} title="Agregar invitados" description="Puedes registrar una persona o un grupo familiar."><div className="sheet-form"><label className="field-block" htmlFor="guest-name"><span>Nombre o grupo</span><KeyboardInput id="guest-name" placeholder="Ej. Familia Ramírez" value={name} onChange={(event) => setName(event.target.value)} /></label><label className="field-block" htmlFor="guest-count"><span>Número de personas</span><KeyboardInput id="guest-count" inputMode="numeric" placeholder="1" value={count} onChange={(event) => setCount(event.target.value.replace(/[^0-9]/g, ""))} /></label><button className="primary-button" type="button" disabled={!name.trim()} onClick={() => { keyboard.hide(); onAdd({ id: `guest-${Date.now()}`, nombre: name.trim(), personas: Math.max(1, Number(count) || 1), invitado_a: "Recepción", rsvp: "Pendiente", transporte: "Por definir" }); setName(""); setCount("1"); }}><PersonIcon /> Agregar invitados</button></div></BottomSheet>;
}
