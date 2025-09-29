export default async function handler(req, res) {
  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    const { topic="Tema demo", level="Principiante", audience="General", goal="Aprender" } = body;
    const course = {
      id: "demo-123",
      topic, level, audience, goal,
      estimatedHours: 8,
      modules: [
        { id: "m1", title: `Fundamentos de ${topic}`, summary: "Intro", lessons: [
          { id: "l1", title: "Lección 1", concept: "Concepto", explainer: "Explicación",
            quiz:[{question:"¿Listo?", options:["Sí","No","Tal vez","Más tarde"], answerIndex:0, explanation:"Era Sí."}],
            flashcards:[{front:"Pregunta", back:"Respuesta"}],
            checklist:[{task:"Hacer algo", done:false}],
            resources:[{label:"Recurso", url:"https://example.com"}]
          }
        ]}
      ],
      __metrics: { provider: "mock", latency_ms: 0 }
    };
    return res.status(200).json(course);
  } catch (e) {
    return res.status(400).json({ error: String(e?.message || e) });
  }
}