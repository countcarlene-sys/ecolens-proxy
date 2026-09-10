const express = require('express');
const multer = require('multer');
const axios = require('axios');
const FormData = require('form-data');

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

// Cole a sua chave oficial da Pl@ntNet aqui no servidor (ela fica segura na nuvem, longe do app)
const PLANTNET_API_KEY = '2b10LrhtbpJCYLimoPBT2lzSu'; 

app.post('/identify', upload.single('image'), async (req, res) => {
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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Proxy rodando na porta ${PORT}`);
});