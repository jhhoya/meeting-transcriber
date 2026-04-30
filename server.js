const express = require('express');
const cors = require('cors');
const multer = require('multer');
const axios = require('axios');
const FormData = require('form-data');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

const upload = multer({ storage: multer.memoryStorage() });

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.post('/transcribe', upload.single('file'), async (req, res) => {
  try {
    const apiKey = req.headers['x-openai-key'];
    if (!apiKey) return res.status(400).json({ error: 'API 키 없음' });

    const form = new FormData();
    form.append('file', req.file.buffer, {
      filename: req.file.originalname,
      contentType: req.file.mimetype,
    });
    form.append('model', 'whisper-1');
    form.append('language', 'ko');
    form.append('response_format', 'text');

    const response = await axios.post(
      'https://api.openai.com/v1/audio/transcriptions',
      form,
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          ...form.getHeaders(),
        },
      }
    );

    res.json({ transcript: response.data });
  } catch (e) {
    const msg = e.response?.data?.error?.message || e.message;
    res.status(500).json({ error: msg });
  }
});

app.post('/minutes', async (req, res) => {
  try {
    const { transcript, prompt } = req.body;

    const response = await axios.post(
      'https://api.anthropic.com/v1/messages',
      {
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        messages: [{ role: 'user', content: prompt + '\n\n---\n음성 변환 원문:\n' + transcript }]
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'anthropic-version': '2023-06-01'
        }
      }
    );

    const text = response.data.content?.find(b => b.type === 'text')?.text || '';
    res.json({ minutes: text });
  } catch (e) {
    const msg = e.response?.data?.error?.message || e.message;
    res.status(500).json({ error: msg });
  }
});

app.listen(3000, () => console.log('서버 실행 중 → http://localhost:3000'));