import Redis from 'ioredis';

const redis = new Redis('rediss://default:gQAAAAAAAp20AAIgcDE1NTI2NjE2MWJhZDE0ZDJmOTVmNDVjZGY0MDAwNzNmOA@proud-heron-171444.upstash.io:6379', { tls: { rejectUnauthorized: false } });

const queues = ['pdf-upload', 'ai-extraction', 'image-extraction', 'question-processing', 'result-saving'];

for (const q of queues) {
  const keys = await redis.keys(`bull:${q}:*`);
  if (keys.length > 0) {
    await redis.del(...keys);
    console.log('Cleared', keys.length, 'keys for', q);
  } else {
    console.log('No keys for', q);
  }
}

await redis.quit();
console.log('Done - all queues cleaned');
