'use strict';
// Облачная функция Yandex Cloud (Node.js 18+): принимает рекорды и отдаёт таблицы.
// Переменные окружения: BOT_TOKEN, BUCKET, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY (статический ключ сервисного аккаунта).
// Запросы — POST с телом JSON в text/plain (так браузер не шлёт предварительный OPTIONS-запрос).

const crypto = require('crypto');
const { S3Client, GetObjectCommand, PutObjectCommand } = require('@aws-sdk/client-s3');
const core = require('./core');

const s3 = new S3Client({ region: 'ru-central1', endpoint: 'https://storage.yandexcloud.net' });
const BUCKET = process.env.BUCKET;

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
    const r = await core.handle(body, { store, botToken: process.env.BOT_TOKEN, hmac });
    return { statusCode: r.status, headers: Object.assign({ 'Content-Type': 'application/json' }, CORS), body: JSON.stringify(r.data) };
  } catch (e) {
    console.error(e);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: 'server' }) };
  }
};
