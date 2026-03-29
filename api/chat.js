export default async function handler(req, res) {
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });
  const { message } = req.body;

  const systemPrompt =
    "Anda adalah asisten ELING (Engage, Learn, Internalize, Navigate, Grow) untuk remaja Bali. Tugas: 1. Edukasi reproduksi reflektif. 2. Dekonstruksi habitus 'Sing Beling Sing Nganten'. 3. Jelaskan risiko medis & sosial secara suportif. Gunakan gaya bahasa remaja yang sopan.";

  // --- OPSI 1: UTAMA (GEMINI) ---
  try {
    const geminiURL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`;

    const geminiResponse = await fetch(geminiURL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: `Sistem: ${systemPrompt}\nUser: ${message}`,
              },
            ],
          },
        ],
      }),
    });

    const geminiData = await geminiResponse.json();

    if (geminiResponse.ok && geminiData.candidates) {
      // Kita bungkus respon Gemini agar formatnya sama dengan OpenAI
      // Jadi index.html kamu tidak perlu diedit
      return res.status(200).json({
        choices: [
          {
            message: {
              content: geminiData.candidates[0].content.parts[0].text,
            },
          },
        ],
      });
    }

    throw new Error("Gemini Limit/Error");
  } catch (error) {
    console.log("Gemini gagal atau limit, beralih ke Cadangan (OpenAI)...");

    // --- OPSI 2: CADANGAN (OPENAI) ---
    try {
      const openAIResponse = await fetch(
        "https://api.openai.com/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: message },
            ],
          }),
        },
      );

      const data = await openAIResponse.json();
      if (openAIResponse.ok) return res.status(200).json(data);

      throw new Error("Semua pintu AI tertutup");
    } catch (openError) {
      return res
        .status(500)
        .json({ error: "Layanan sedang sibuk, coba lagi nanti." });
    }
  }
}
