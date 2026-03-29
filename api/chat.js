export default async function handler(req, res) {
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  const { message } = req.body;
  const systemPrompt =
    "Anda adalah asisten ELING untuk remaja Bali. Bantu dekonstruksi habitus 'Sing Beling Sing Nganten' secara suportif.";

  // --- OPSI 1: UTAMA (GEMINI) ---
  try {
    console.log("Mencoba akses Gemini v1...");

    // PERUBAHAN DI SINI: v1beta jadi v1
    const geminiURL = `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`;

    const geminiResponse = await fetch(geminiURL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: `Sistem: ${systemPrompt}\n\nUser: ${message}` }],
          },
        ],
      }),
    });

    const geminiData = await geminiResponse.json();

    if (!geminiResponse.ok) {
      console.error("Gemini Error Detail:", JSON.stringify(geminiData));
      throw new Error(`Gemini Error: ${geminiResponse.status}`);
    }

    if (geminiData.candidates && geminiData.candidates[0].content) {
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

    throw new Error("Format respon tidak sesuai");
  } catch (error) {
    console.warn("Gemini Gagal, lempar ke OpenAI. Alasan:", error.message);

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

      throw new Error("Semua AI tumbang");
    } catch (openError) {
      return res.status(500).json({ error: "Layanan sedang sibuk." });
    }
  }
}
