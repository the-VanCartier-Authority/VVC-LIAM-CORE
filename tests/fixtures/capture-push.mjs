// Intercepts the OLD vulnerable sender while reproducing B05. Never sends to a push service.
import webpush from 'web-push';
import { appendFileSync } from 'node:fs';
webpush.sendNotification = async () => {
  appendFileSync(process.env.VVC_PUSH_CAPTURE, 'intercepted\n');
  return { statusCode: 201, body: '', headers: {} };
};
