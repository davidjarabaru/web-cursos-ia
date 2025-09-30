import React, { useEffect, useState } from "react";

/** =========================================================
 *  Creador de Cursos – App.jsx (versión robusta)
 *  - UI con tarjetas, botones y sidebar
 *  - Llama a /api/generate (OpenAI); si falla → usa MOCK
 *  - NUNCA se queda en blanco: checks en todos los arrays
 *  - Muestra mensajes de error amigables en la interfaz
 *  - Tailwind: el <link> va en index.html (no aquí)
 * ========================================================= */

/* ---------------- Utils ---------------- */
const slug = (s) =>
  (s || "")
    .toString()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

const clamp = (n, a, b) => Math.max(a, Math.min(n, b));

function useLocal(key, initial) {
  const [v, setV] = useState(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : initial;
    } catch {
      return initial;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(v));
    } catch {}
  }, [key, v]);
  return [v, setV];
}

function download(name, content, type = "application/json") {
  try {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  } catch {}
}

/* --------------- Generador MOCK (fallback) --------------- */
function mockCourse(
  topic,
  {
    level = "Principiante",
    audience = "Autodidactas curiosos",
    goal = `Aprender ${topic} con práctica`,
  } = {}
) {
  const id = slug(topic) + "-" + Date.now();
  const moduleTitles = [
    `Fundamentos de ${topic}`,
    `Herramientas y flujo de trabajo en ${topic}`,
    `Proyecto guiado en ${topic}`,
    `Mejores prácticas y siguientes pasos`,
  ];
  const makeLesson = (base, i) => ({
    id: slug(base) + "-" + i,
    title: `${base} · Lección ${i + 1}`,
    concept: `Idea central de ${base} #${i + 1}.`,
    explainer: `Explicación paso a paso con mini ejercicio.`,
    quiz: [
      {
        question: `¿Qué afirma mejor sobre ${base}?`,
        options: ["A", "B", "C", "D"],
        answerIndex: Math.floor(Math.random() * 4),
        explanation: `Conecta ${base} con el objetivo.`,
      },
    ],
    flashcards: [
      { front: `Definición de ${base}`, back: `Recordatorio breve.` },
      { front: `Ejemplo de ${base}`, back: `Caso práctico.` },
    ],
    checklist: [
      { task: `Anota 3 ideas de ${base}`, done: false },
      { task: `Crea un mini ejemplo de ${base}`, done: false },
    ],
    resources: [{ label: `Artículo sobre ${base}`, url: `https://example.com/${slug(base)}` }],
  });

  const modules = moduleTitles.map((t, i) => ({
    id: slug(t) + "-" + i,
    title: t,
    summary: `Qué aprenderás en “${t}”.`,
    lessons: [0, 1, 2].map((j) => makeLesson(t, j)),
  }));

  return {
    id,
    topic,
    goal,
    audience,
    level,
    estimatedHours: 10 + Math.floor(Math.random() * 6),
    modules,
    __metrics: { provider: "mock", latency_ms: 0 },
  };
}

/* ---------------- UI Atoms ---------------- */
const Card = ({ title, action, children, className = "" }) => (
  <div className={`rounded-2xl border border-neutral-200 bg-white shadow-sm p-5 ${className}`}>
    <div className="flex items-center justify-between gap-4 mb-3">
      {title ? <h3 className="text-lg font-semibold">{title}</h3> : <span />}
      {action}
    </div>
    {children}
  </div>
);

const Btn = ({ variant = "primary", className = "", ...props }) => {
  const base = "px-4 py-2 rounded-xl text-sm font-medium transition";
  const styles = {
    primary:
      "bg-black text-white hover:bg-neutral-800 disabled:bg-neutral-300 disabled:text-neutral-600",
    ghost: "bg-transparent border border-neutral-300 hover:bg-neutral-100",
    subtle: "bg-neutral-100 hover:bg-neutral-200",
  };
  return <button {...props} className={`${base} ${styles[variant]} ${className}`} />;
};

const Pill = ({ children }) => (
  <span className="inline-flex items-center rounded-full px-3 py-1 text-xs font-medium bg-neutral-100 border border-neutral-200">
    {children}
  </span>
);

/* --------------- Header --------------- */
function Header() {
  return (
    <header className="sticky top-0 z-10 backdrop-blur supports-[backdrop-filter]:bg-white/70 bg-white/90 border-b border-neutral-200">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-black to-neutral-700 text-white grid place-items-center font-bold">
          C
        </div>
        <div className="leading-tight">
          <h1 className="text-base font-semibold">Creador de Cursos — PRO</h1>
          <p className="text-xs text-neutral-500">Escribe un tema y genera un curso interactivo</p>
        </div>
        <div className="ml-auto hidden md:flex gap-2">
          <Pill>UI Pro</Pill>
          <Pill>Export/Import</Pill>
          <Pill>Progreso local</Pill>
        </div>
      </div>
    </header>
  );
}

/* --------------- Prompt (formulario) --------------- */
function Prompt({ onGenerate, setUiError }) {
  const [topic, setTopic] = useState("");
  const [level, setLevel] = useState("Principiante");
  const [audience, setAudience] = useState("Autodidactas curiosos");
  const [goal, setGoal] = useState("");
  const [loading, setLoading] = useState(false);

  async function generate() {
    setUiError("");
    if (!topic.trim()) {
      setUiError("Escribe un tema (prompt) antes de generar.");
      return;
    }
    setLoading(true);

    // 1) Intentar backend real
    try {
      const t0 = performance.now();
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, level, audience, goal }),
      });

      if (!res.ok) throw new Error(`/api/generate respondió ${res.status}`);
      const data = await res.json();

      // Validación mínima de estructura
      if (!data || !Array.isArray(data.modules)) throw new Error("JSON inválido (sin modules[])");

      const t1 = performance.now();
      const course = {
        ...data,
        __metrics: {
          ...(data.__metrics || {}),
          provider: (data.__metrics && data.__metrics.provider) || "openai",
          latency_ms: Math.round(t1 - t0),
        },
      };
      onGenerate(course);
      setLoading(false);
      return;
    } catch (err) {
      console.warn("Fallo la API, usaré MOCK:", err);
      setUiError("No se pudo generar con IA. Usando contenido de ejemplo (mock).");
    }

    // 2) Fallback MOCK
    const mock = mockCourse(topic, { level, audience, goal });
    onGenerate(mock);
    setLoading(false);
  }

  return (
    <Card
      title="1) Describe el curso"
      action={
        <Btn onClick={generate} disabled={loading || !topic.trim()}>
          {loading ? "Generando…" : "Generar curso"}
        </Btn>
      }
    >
      <div className="grid md:grid-cols-2 gap-4">
        <div className="md:col-span-2">
          <label className="text-sm font-medium">Tema / Prompt</label>
          <input
            className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2 outline-none focus:ring-2 focus:ring-black"
            placeholder="Ej: Programación creativa con p5.js"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
          />
        </div>
        <div>
          <label className="text-sm font-medium">Nivel</label>
          <select
            className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2"
            value={level}
            onChange={(e) => setLevel(e.target.value)}
          >
            {["Principiante", "Intermedio", "Avanzado", "Mixto"].map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-sm font-medium">Audiencia</label>
          <input
            className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2"
            value={audience}
            onChange={(e) => setAudience(e.target.value)}
            placeholder="A quién va dirigido"
          />
        </div>
        <div className="md:col-span-2">
          <label className="text-sm font-medium">Objetivo (opcional)</label>
          <input
            className="mt-1 w-full rounded-xl border border-neutral-300 px-3 py-2"
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            placeholder="¿Qué resultado buscas?"
          />
        </div>
      </div>
      <div className="mt-3 text-xs text-neutral-500">
        Consejo: tema + público + resultado. Ej: “Ilustración digital para principiantes que quieren
        su primer portafolio”.
      </div>
    </Card>
  );
}

/* --------------- Sidebar --------------- */
function Sidebar({ course, current, onPick, onExport, onImport }) {
  const modules = Array.isArray(course?.modules) ? course.modules : [];

  return (
    <aside className="w-full md:w-80 shrink-0">
      <div className="sticky top-16 space-y-4">
        <Card title="Curso">
          <h4 className="font-semibold">{course?.topic || "Sin tema"}</h4>
          <p className="text-sm text-neutral-600">{course?.goal || "Objetivo no definido"}</p>
          <div className="flex gap-2 mt-2 flex-wrap">
            <Pill>{course?.level || "Nivel"}</Pill>
            <Pill>{course?.estimatedHours ? `${course.estimatedHours}h` : "?"}</Pill>
            <Pill>{course?.audience || "Audiencia"}</Pill>
          </div>
          {course?.__metrics && (
            <div className="mt-3 text-xs text-neutral-500">
              Motor: {course.__metrics.provider || "?"} · Latencia:{" "}
              {course.__metrics.latency_ms ?? "–"} ms · Tokens:{" "}
              {course.__metrics?.usage?.total_tokens ?? "–"}
            </div>
          )}
          <div className="mt-4 flex gap-2">
            <Btn variant="ghost" onClick={onExport}>
              Exportar
            </Btn>
            <label className="px-4 py-2 rounded-xl text-sm font-medium border border-neutral-300 cursor-pointer">
              Importar
              <input type="file" accept="application/json" className="hidden" onChange={onImport} />
            </label>
          </div>
        </Card>

        <Card title="Módulos & Lecciones">
          {modules.length === 0 ? (
            <p className="text-sm text-neutral-500">No hay módulos disponibles.</p>
          ) : (
            <nav className="space-y-3">
              {modules.map((m) => (
                <div key={m?.id || m?.title}>
                  <p className="font-medium">{m?.title || "Módulo"}</p>
                  <ul className="mt-1 space-y-1">
                    {(Array.isArray(m?.lessons) ? m.lessons : []).map((l) => (
                      <li key={l?.id || l?.title}>
                        <button
                          onClick={() => onPick(m.id, l.id)}
                          className={`text-left w-full px-3 py-2 rounded-lg border ${
                            current?.lesson?.id === l?.id
                              ? "bg-black text-white border-black"
                              : "border-neutral-300 hover:bg-neutral-100"
                          }`}
                        >
                          {l?.title || "Lección"}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </nav>
          )}
        </Card>
      </div>
    </aside>
  );
}

/* --------------- Quiz, Flashcards, Checklist --------------- */
function Quiz({ item, onScore }) {
  if (!item) return null;
  const [pick, setPick] = useState(null);
  const [done, setDone] = useState(false);
  const options = Array.isArray(item.options) ? item.options : [];
  const ok = pick === item.answerIndex;

  return (
    <div className="space-y-2">
      <p className="font-medium">{item.question || "Pregunta"}</p>
      <div className="grid gap-2">
        {options.length === 0 ? (
          <p className="text-sm text-neutral-500">Sin opciones.</p>
        ) : (
          options.map((opt, i) => (
            <label
              key={i}
              className={`flex items-center gap-2 rounded-xl border p-3 cursor-pointer ${
                pick === i ? "border-black" : "border-neutral-300"
              }`}
            >
              <input type="radio" name="quiz" checked={pick === i} onChange={() => setPick(i)} />
              <span>{opt}</span>
            </label>
          ))
        )}
      </div>
      <div className="flex items-center gap-2">
        <Btn
          onClick={() => {
            setDone(true);
            onScore?.(ok);
          }}
          disabled={pick === null}
        >
          Comprobar
        </Btn>
        {done && (
          <span className={`text-sm ${ok ? "text-green-600" : "text-red-600"}`}>
            {ok ? "¡Correcto!" : "No es correcto"} · {item.explanation || ""}
          </span>
        )}
      </div>
    </div>
  );
}

function Flashcards({ cards }) {
  const list = Array.isArray(cards) ? cards : [];
  const [i, setI] = useState(0);
  const c = list[i] || { front: "Sin tarjetas", back: "" };
  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-neutral-200 p-6 bg-neutral-50">
        <p className="text-sm text-neutral-500">
          Tarjeta {list.length ? i + 1 : 0}/{list.length}
        </p>
        <p className="text-xl font-semibold mt-2">{c.front}</p>
        {c.back ? (
          <details className="mt-2">
            <summary className="cursor-pointer text-sm text-neutral-600">Mostrar respuesta</summary>
            <p className="mt-2">{c.back}</p>
          </details>
        ) : null}
      </div>
      {list.length > 0 && (
        <div className="flex gap-2">
          <Btn variant="ghost" onClick={() => setI(clamp(i - 1, 0, list.length - 1))}>
            Anterior
          </Btn>
          <Btn onClick={() => setI(clamp(i + 1, 0, list.length - 1))}>Siguiente</Btn>
        </div>
      )}
    </div>
  );
}

function Checklist({ items, onToggle }) {
  const list = Array.isArray(items) ? items : [];
  if (list.length === 0) return <p className="text-sm text-neutral-500">Sin tareas.</p>;
  return (
    <ul className="space-y-2">
      {list.map((it, idx) => (
        <li key={idx} className="flex items-center gap-2">
          <input type="checkbox" checked={!!it.done} onChange={() => onToggle?.(idx)} />
          <span className={it.done ? "line-through text-neutral-500" : ""}>
            {it.task || "Tarea"}
          </span>
        </li>
      ))}
    </ul>
  );
}

/* --------------- LessonView --------------- */
function LessonView({ lesson, onUpdate, progressKey }) {
  const safeLesson =
    lesson || {
      id: "empty",
      title: "Lección no disponible",
      concept: "",
      explainer: "",
      quiz: [],
      flashcards: [],
      checklist: [],
      resources: [],
    };

  const [local, setLocal] = useState(safeLesson);
  useEffect(() => setLocal(safeLesson), [lesson?.id]);
  useEffect(() => {
    onUpdate?.(local);
  }, [local]);

  const [quizScore, setQuizScore] = useLocal(`${progressKey}:${safeLesson.id}:quiz`, 0);
  const [done, setDone] = useLocal(`${progressKey}:${safeLesson.id}:done`, false);

  const quizList = Array.isArray(local?.quiz) ? local.quiz : [];
  const cards = Array.isArray(local?.flashcards) ? local.flashcards : [];
  const checks = Array.isArray(local?.checklist) ? local.checklist : [];
  const resources = Array.isArray(local?.resources) ? local.resources : [];

  return (
    <div className="space-y-6">
      <Card
        title={safeLesson.title}
        action={
          <Btn variant="ghost" onClick={() => setDone(!done)}>
            {done ? "Marcar pendiente" : "Marcar completada"}
          </Btn>
        }
      >
        {safeLesson.concept && (
          <p className="text-sm text-neutral-600 mb-2">{safeLesson.concept}</p>
        )}
        {safeLesson.explainer && <p className="mb-4">{safeLesson.explainer}</p>}
        <div className="flex gap-2 flex-wrap">
          <Pill>{done ? "Completada" : "En progreso"}</Pill>
          <Pill>Quiz: {quizScore}%</Pill>
          <Pill>Flashcards: {cards.length}</Pill>
        </div>
      </Card>

      <Card title="Quiz rápido">
        {quizList.length === 0 ? (
          <p className="text-sm text-neutral-500">Esta lección no tiene preguntas.</p>
        ) : (
          quizList.map((q, i) => (
            <Quiz
              key={i}
              item={q}
              onScore={(ok) =>
                setQuizScore((s) => clamp(Math.round((s + (ok ? 100 : 0)) / 2), 0, 100))
              }
            />
          ))
        )}
      </Card>

      <Card title="Flashcards">
        <Flashcards cards={cards} />
      </Card>

      <Card title="Checklist práctica">
        <Checklist
          items={checks}
          onToggle={(idx) => {
            const up = [...checks];
            up[idx] = { ...up[idx], done: !up[idx]?.done };
            setLocal({ ...local, checklist: up });
          }}
        />
      </Card>

      <Card title="Recursos">
        {resources.length === 0 ? (
          <p className="text-sm text-neutral-500">Sin recursos.</p>
        ) : (
          <ul className="list-disc pl-6">
            {resources.map((r, i) => (
              <li key={i}>
                <a className="underline" href={r?.url || "#"} target="_blank" rel="noreferrer">
                  {r?.label || r?.url || "Recurso"}
                </a>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

/* --------------- Workspace (layout) --------------- */
function Workspace({ course, setCourse }) {
  const modules = Array.isArray(course?.modules) ? course.modules : [];
  const [sel, setSel] = useLocal(`course:${course?.id}:sel`, {
    moduleId: modules[0]?.id,
    lessonId: modules[0]?.lessons?.[0]?.id,
  });

  const mod = modules.find((m) => m?.id === sel.moduleId) || modules[0];
  const lessons = Array.isArray(mod?.lessons) ? mod.lessons : [];
  const les = lessons.find((l) => l?.id === sel.lessonId) || lessons[0];

  const key = `course:${course?.id || "unknown"}`;

  const pick = (mid, lid) => setSel({ moduleId: mid, lessonId: lid });

  const updateLesson = (u) => {
    if (!u?.id) return;
    setCourse((prev) => {
      const prevMods = Array.isArray(prev?.modules) ? prev.modules : [];
      const newMods = prevMods.map((m) =>
        m?.id === mod?.id
          ? {
              ...m,
              lessons: (Array.isArray(m?.lessons) ? m.lessons : []).map((l) =>
                l?.id === u.id ? u : l
              ),
            }
          : m
      );
      return { ...(prev || {}), modules: newMods };
    });
  };

  const onExport = () =>
    download(`${slug(course?.topic || "curso")}.json`, JSON.stringify(course || {}, null, 2));

  const onImport = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const rd = new FileReader();
    rd.onload = () => {
      try {
        const imp = JSON.parse(rd.result);
        if (!imp || !Array.isArray(imp.modules)) throw new Error("JSON inválido");
        setCourse(imp);
      } catch {
        alert("No se pudo importar. Sube un JSON válido.");
      }
    };
    rd.readAsText(f);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 grid md:grid-cols-[20rem,1fr] gap-6 pb-16">
      <Sidebar
        course={course}
        current={{ module: mod, lesson: les }}
        onPick={pick}
        onExport={onExport}
        onImport={onImport}
      />
      <main>
        <LessonView lesson={les} onUpdate={updateLesson} progressKey={key} />
      </main>
    </div>
  );
}

/* --------------- App (root) --------------- */
export default function App() {
  const [course, setCourse] = useLocal("pro:course", null);
  const [uiError, setUiError] = useState("");

  return (
    <div className="min-h-screen bg-neutral-50">
      <Header />
      <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {uiError ? (
          <div className="rounded-xl bg-red-50 border border-red-200 text-red-700 p-3 text-sm">
            {uiError}
          </div>
        ) : null}

        {!course ? (
          <Prompt onGenerate={setCourse} setUiError={setUiError} />
        ) : (
          <Card
            title="2) Tu curso"
            action={
              <Btn variant="ghost" onClick={() => setCourse(null)}>
                Crear otro
              </Btn>
            }
          >
            <div className="flex flex-col md:flex-row md:items-center gap-2 text-sm text-neutral-700">
              <div>
                <span className="font-semibold">Tema:</span> {course?.topic || "—"}
              </div>
              <div className="hidden md:block">·</div>
              <div>
                <span className="font-semibold">Nivel:</span> {course?.level || "—"}
              </div>
              <div className="hidden md:block">·</div>
              <div>
                <span className="font-semibold">Audiencia:</span> {course?.audience || "—"}
              </div>
              <div className="hidden md:block">·</div>
              <div>
                <span className="font-semibold">Horas estimadas:</span>{" "}
                {course?.estimatedHours ? `${course.estimatedHours}h` : "—"}
              </div>
            </div>
          </Card>
        )}
      </div>

      {course ? <Workspace course={course} setCourse={setCourse} /> : null}
    </div>
  );
}
