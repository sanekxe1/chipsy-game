'use strict';
// Облачная функция Yandex Cloud (Node.js 18+): принимает рекорды и отдаёт таблицы.
// Переменные окружения: BOT_TOKEN, BUCKET, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY (статический ключ сервисного аккаунта).
// Запросы — POST с телом JSON в text/plain (так браузер не шлёт предварительный OPTIONS-запрос).

const crypto = require('crypto');
const { S3Client, GetObjectCommand, PutObjectCommand } = require('@aws-sdk/client-s3');
const core = require('./core');

// значения переменных чистим от пробелов, переносов строк и кавычек — их легко захватить при копировании
const env = k => String(process.env[k] || '').trim().replace(/^["'«]+|["'»]+$/g, '').trim();
const KEY_ID = env('AWS_ACCESS_KEY_ID'), SECRET = env('AWS_SECRET_ACCESS_KEY');
const s3 = new S3Client({
  region: 'ru-central1', endpoint: 'https://storage.yandexcloud.net',
  credentials: { accessKeyId: KEY_ID, secretAccessKey: SECRET },
});
const BUCKET = env('BUCKET');

const store = {
  async load(game) {
    try {
      const r = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: 'rating/' + game + '.json' }));
      return JSON.parse(await r.Body.transformToString());
    } catch (e) {
      if (e.name === 'NoSuchKey' || (e.$metadata && e.$metadata.httpStatusCode === 404)) return null;
      throw e;
    }
  },
  async save(game, board) {
    await s3.send(new PutObjectCommand({
      Bucket: BUCKET, Key: 'rating/' + game + '.json', Body: JSON.stringify(board), ContentType: 'application/json',
    }));
  },
};

const hmac = async (key, msg) => new Uint8Array(crypto.createHmac('sha256', key).update(msg).digest());

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

module.exports.handler = async event => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' };
  let body;
  try {
    const raw = event.isBase64Encoded ? Buffer.from(event.body || '', 'base64').toString('utf8') : event.body;
    body = JSON.parse(raw || '{}');
  } catch (e) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'json' }) };
  }
  try {
    const r = await core.handle(body, { store, botToken: env('BOT_TOKEN'), hmac });
    return { statusCode: r.status, headers: Object.assign({ 'Content-Type': 'application/json' }, CORS), body: JSON.stringify(r.data) };
  } catch (e) {
    console.error(e);
    // логи в консоли Yandex Cloud бывают недоступны — причину отдаём в ответе (без значений переменных)
    // заданы ли переменные и нет ли в них лишних символов (сами значения не показываем)
    const vars = {};
    for (const k of ['BOT_TOKEN', 'BUCKET', 'AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY']) {
      const v = env(k);
      vars[k] = !v ? 'нет' : /^[\x21-\x7e]+$/.test(v) ? 'ок' : 'есть лишние символы (кириллица или невидимые)';
    }
    const detail = { name: e.name, code: e.Code || e.code, http: e.$metadata && e.$metadata.httpStatusCode, message: String(e.message || '').slice(0, 200) };
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: 'server', detail, vars }) };
  }
};
