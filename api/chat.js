export default async function handler(req, res) {
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  const { message } = req.body;
  const systemPrompt =
    "Anda adalah asisten ELING untuk remaja di Bali. Bantu dekonstruksi habitus melalui Strategi E-L-I-N-G (Engage, Learn, Internalize, Navigate, Grow) adalah sebuah pendekatan edukatif yang dirancang untuk merespons fenomena sosial 'Sing Beling Sing Nganten' (tidak hamil, tidak menikah) di Bali";

  // Daftar model Gemini yang akan dicoba (Urutan prioritas)
  const geminiModels = ["gemini-2.5-flash-lite"];
  let geminiSuccess = false;
  let responseData = null;

  // --- OPSI 1: LOOPING MODEL GEMINI ---
  for (const modelName of geminiModels) {
    if (geminiSuccess) break;

    try {
      console.log(`Mencoba akses Gemini: ${modelName}...`);
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${process.env.GEMINI_API_KEY}`;

      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            { parts: [{ text: `${systemPrompt}\n\nUser: ${message}` }] },
          ],
        }),
      });

      const data = await response.json();

      if (response.ok && data.candidates) {
        console.log(`Berhasil pakai model: ${modelName}`);
        responseData = {
          choices: [
            {
              message: { content: data.candidates[0].content.parts[0].text },
            },
          ],
        };
        geminiSuccess = true;
      } else {
        console.warn(
          `Model ${modelName} gagal:`,
          data.error?.message || "Unknown error",
        );
      }
    } catch (err) {
      console.error(`Error saat mencoba ${modelName}:`, err.message);
    }
  }

  // Jika salah satu Gemini berhasil, kirim hasilnya
  if (geminiSuccess) return res.status(200).json(responseData);

  // --- OPSI 2: CADANGAN TERAKHIR (OPENAI) ---
  console.log("Semua Gemini gagal, beralih ke OpenAI...");
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

    return res
      .status(500)
      .json({ error: "Semua pintu AI tertutup sementara." });
  } catch (openError) {
    return res.status(500).json({ error: "Layanan benar-benar sedang sibuk." });
  }
}
