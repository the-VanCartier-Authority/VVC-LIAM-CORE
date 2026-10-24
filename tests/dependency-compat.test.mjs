import { test } from 'node:test';
import assert from 'node:assert/strict';
import { jsPDF } from 'jspdf';
import * as grpc from '@grpc/grpc-js';

test('patched jsPDF/DOMPurify dependency chain still generates a local text PDF', () => {
  const document = new jsPDF();
  document.text('synthetic-export-fixture', 10, 10);
  const pdf = Buffer.from(document.output('arraybuffer')).toString('latin1');
  assert.ok(pdf.startsWith('%PDF-'));
  assert.match(pdf, /synthetic-export-fixture/);
});

test('patched gRPC client dependency loads and creates credentials without connecting', () => {
  const credentials = grpc.credentials.createSsl();
  assert.ok(credentials);
  assert.equal(typeof grpc.Client, 'function');
});
