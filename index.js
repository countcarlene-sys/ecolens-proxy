const express = require('express');
const multer = require('multer');
const axios = require('axios');
const FormData = require('form-data');
const { GoogleGenAI } = require('@google/genai');

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

// Cole a sua chave oficial da Pl@ntNet aqui no servidor (ela fica segura na nuvem, longe do app)
const PLANTNET_API_KEY = '2b10dr8hlBbcNHFcHzzYGm9HR'; 

// Chave e configuração do Google Gemini
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

// Função auxiliar para tentar novamente caso dê erro 503 (alta demanda)
async function generateWithRetry(modelName, contents, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model: modelName,
        contents: contents,
      });
      return response;
    } catch (error) {
      console.log(`Tentativa ${attempt} falhou. Erro:`, error.message);
      if (attempt === maxRetries || (!error.message.includes('503') && !error.message.includes('UNAVAILABLE'))) {
        throw error;
      }
      console.log(`Aguardando 2 segundos para tentar novamente...`);
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
}

app.post('/identify', upload.single('images'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Nenhuma imagem enviada.' });
    }

    // Prepara os dados para enviar para a Pl@ntNet
    const formData = new FormData();
    formData.append('images', req.file.buffer, {
      filename: req.file.originalname,
      contentType: req.file.mimetype,
    });

    const plantNetUrl = `https://my-api.plantnet.org/v2/identify/all?api-key=${PLANTNET_API_KEY}`;

    // Faz a chamada para a Pl@ntNet usando o servidor proxy
    const response = await axios.post(plantNetUrl, formData, {
      headers: {
        ...formData.getHeaders(),
      },
    });

    // Devolve o resultado da planta para o seu aplicativo Flutter
    res.json(response.data);
  } catch (error) {
    console.error('Erro no proxy:', error.response?.data || error.message);
    res.status(500).json({ 
      error: 'Erro ao comunicar com a Pl@ntNet', 
      details: error.response?.data || error.message 
    });
  }
});

// Nova rota para análise de poluição hídrica/ambiental via Gemini com proteção contra erro 503
app.post('/pollution', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Nenhuma imagem enviada.' });
    }

    const imagePart = {
      inlineData: {
        data: req.file.buffer.toString('base64'),
        mimeType: req.file.mimetype,
      },
    };

    const prompt = `Analise esta imagem focando em recursos hídricos, corpos d'água ou resíduos/poluição ambiental. 
    Identifique se há sinais visíveis de poluição (como lixo, detritos, turbidez severa, espuma anormal, óleo ou despejos). 
    Se for um copo d'água ou similar, aponte apenas o aspecto visual (se parece límpida ou com partículas). 
    Seja objetivo e estruture a resposta de forma clara para um aplicativo socioambiental.`;

    // Chamada protegida por tentativas automáticas usando o modelo compatível
    const response = await generateWithRetry('gemini-1.5-flash', [prompt, imagePart]);

    res.json({ analysis: response.text });

  } catch (error) {
    console.error('Erro no proxy Gemini:', error);
    res.status(500).json({ 
      error: 'Erro ao analisar poluição com o Gemini', 
      details: error.message 
    });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Proxy rodando na porta ${PORT}`);
});
