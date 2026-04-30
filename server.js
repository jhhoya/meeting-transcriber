const express = require('express');
const cors = require('cors');
const multer = require('multer');
const axios = require('axios');
const FormData = require('form-data');
const path = require('path');

console.log('OPENAI_API_KEY:', process.env.OPENAI_API_KEY ? '있음' : '없음');
console.log('ANTHROPIC_API_KEY:', process.env.ANTHROPIC_API_KEY ? '있음' : '없음');

const app = express();
app.use(cors());
app.use(express.json());

const upload = multer({ storage: multer.memoryStorage() });

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.post('/transcribe', upload.single('file'), async (req, res) => {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return res.status(400).json({ error: 'OpenAI API 키 없음' });

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
      { headers: { Authorization: `Bearer ${apiKey}`, ...form.getHeaders() } }
    );

    res.json({ transcript: response.data });
  } catch (e) {
    res.status(500).json({ error: e.response?.data?.error?.message || e.message });
  }
});

app.post('/minutes', async (req, res) => {
  try {
    const { transcript, prompt, model } = req.body;
    const ANTHROPIC_MODELS = ['claude-sonnet-4-20250514', 'claude-opus-4-5', 'claude-haiku-4-5-20251001'];
    const isAnthropic = ANTHROPIC_MODELS.includes(model);
    let minutes = '';

    if (isAnthropic) {
      const key = process.env.ANTHROPIC_API_KEY;
      if (!key) return res.status(400).json({ error: 'Anthropic API 키 없음' });
      const response = await axios.post(
        'https://api.anthropic.com/v1/messages',
        { model, max_tokens: 2000, messages: [{ role: 'user', content: prompt + '\n\n---\n음성 변환 원문:\n' + transcript }] },
        { headers: { 'Content-Type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' } }
      );
      minutes = response.data.content?.find(b => b.type === 'text')?.text || '';
    } else {
      const key = process.env.OPENAI_API_KEY;
      if (!key) return res.status(400).json({ error: 'OpenAI API 키 없음' });
      const response = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        { model, messages: [{ role: 'user', content: prompt + '\n\n---\n음성 변환 원문:\n' + transcript }] },
        { headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` } }
      );
      minutes = response.data.choices?.[0]?.message?.content || '';
    }

    res.json({ minutes });
  } catch (e) {
    res.status(500).json({ error: e.response?.data?.error?.message || e.message });
  }
});

app.listen(3000, () => console.log('서버 실행 중 → http://localhost:3000'));
