import { test, expect } from 'bun:test';
import { readFileSync } from 'node:fs';

// Run with an approved Litoral Norte director session, never a service credential.
const sessionPath = process.env.FORMULARIOS_TEST_SESSION_FILE;
const backendUrl = process.env.FORMULARIOS_TEST_BACKEND_URL;
const publishableKey = process.env.FORMULARIOS_TEST_PUBLISHABLE_KEY;
if (!sessionPath || !backendUrl || !publishableKey) {
  throw new Error('Configure the authorized session, backend URL and publishable key for the integration test.');
}
const { session } = JSON.parse(readFileSync(sessionPath, 'utf8'));
const headers = { apikey: publishableKey, Authorization: `Bearer ${session.access_token}` };
const response = await fetch(`${backendUrl}/rest/v1/formularios_catalogo?select=titulo,global,ativo&ativo=eq.true`, { headers });
if (!response.ok) throw new Error(`Catalog request failed: ${response.status}`);
const forms = await response.json();

test('Litoral Norte director can read global PD catalog entry', () => {
  expect(forms.some(form => form.titulo === 'PD – Processo Disciplinar' && form.global)).toBe(true);
});
test('Litoral Norte director can read global travel notice catalog entry', () => {
  expect(forms.some(form => form.titulo === 'Aviso de Deslocamento' && form.global)).toBe(true);
});
test('Litoral Norte director can read global INSIGHTS catalog entry', () => {
  expect(forms.some(form => form.titulo === 'Controle de INSIGHTS' && form.global)).toBe(true);
});
test('local forms of another regional remain inaccessible', () => {
  expect(forms.some(form => form.titulo === 'Relatório CMD (LN)')).toBe(true);
  expect(forms.some(form => form.titulo === 'Relatório CMD (VP1)')).toBe(false);
  expect(forms.some(form => form.titulo === 'Relatório CMD (VP2)')).toBe(false);
  expect(forms.some(form => form.titulo === 'Relatório CMD (VP3)')).toBe(false);
});