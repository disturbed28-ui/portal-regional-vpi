import { describe, expect, test } from 'bun:test';
import { execFileSync } from 'node:child_process';

// Integration tests exercise the database's actual selector with synthetic contacts.
// No profiles are changed and no email or WhatsApp messages are sent.
const regional = '11111111-1111-4111-8111-111111111111';
const outraRegional = '22222222-2222-4222-8222-222222222222';
const responsavel = { profile_id: 'marcelo-ferramenta', nome: 'Marcelo Pacheco', regional_id: outraRegional,
  profile_status: 'Ativo', admin: true, telefone: '12999998888', email: 'marcelo@example.com' };
const local = { ...responsavel, profile_id: 'admin-local', nome: 'Admin local', regional_id: regional };
const diretor = { ...local, profile_id: 'pacheco-diretor', nome: 'Pacheco', admin: false };
const scenarios = [
  { name: 'prioriza administrador ativo da regional', canal: 'whatsapp', candidates: [responsavel, local], expected: ['admin-local'] },
  { name: 'sem administrador regional envia ao Marcelo da ferramenta, não ao Pacheco diretor', canal: 'whatsapp', candidates: [responsavel, diretor], expected: ['marcelo-ferramenta'] },
  { name: 'administrador inativo não recebe pedidos', canal: 'whatsapp', candidates: [responsavel, { ...local, profile_status: 'Inativo' }], expected: ['marcelo-ferramenta'] },
  { name: 'telefone regional ausente ou inválido usa o próprio responsável da ferramenta', canal: 'whatsapp', candidates: [responsavel, { ...local, telefone: 'N/A' }], expected: ['marcelo-ferramenta'] },
  { name: 'e-mail regional ausente usa o e-mail do responsável da ferramenta', canal: 'email', candidates: [responsavel, { ...local, email: null }], expected: ['marcelo-ferramenta'] },
  { name: 'e-mail regional válido é preservado mesmo sem telefone', canal: 'email', candidates: [responsavel, { ...local, telefone: null }], expected: ['admin-local'] },
  { name: 'cadastro sem regional identificada vai ao responsável da ferramenta', canal: 'email', regional: null, candidates: [responsavel, local], expected: ['marcelo-ferramenta'] },
  { name: 'sem contato alternativo não inventa outro administrador', canal: 'whatsapp', candidates: [{ ...responsavel, telefone: null }, diretor], expected: [] },
];
const quote = value => `'${String(value).replaceAll("'", "''")}'`;
const sql = scenarios.map((s, i) => `SELECT ${i} AS case_id, public.cadastro_selecionar_destinatarios(
  ${quote(JSON.stringify(s.candidates))}::jsonb,
  ${s.regional === null ? 'NULL' : quote(regional)}::uuid,
  'marcelo-ferramenta', ${quote(s.canal)}) AS destinatarios`).join(' UNION ALL ');
const result = JSON.parse(execFileSync('lovable', ['supabase', 'query', sql, '--json'], { encoding: 'utf8' }));
describe('destinatários de cadastro no servidor', () => {
  scenarios.forEach((s, i) => test(s.name, () => {
    const row = result.rows.find(row => Number(row.case_id) === i);
    expect(row).toBeDefined();
    expect(row.destinatarios.map(d => d.profile_id).sort()).toEqual(s.expected);
  }));
});