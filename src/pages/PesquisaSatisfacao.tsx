import { useEffect, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import './PesquisaSatisfacao.css';

interface Dados {
  comandos: { id: string; nome: string }[];
  regionais: { id: string; comandoId: string; nome: string }[];
  divisoes: { id: string; regionalId: string; nome: string }[];
  perguntas: string[];
}
const endpoint = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/pesquisa-satisfacao`;
async function chamar(payload?: unknown): Promise<any> {
  // A separate anonymous request: never attach the signed-in portal user's token or cookies.
  const res = await fetch(endpoint, {
    method: payload ? 'POST' : 'GET', credentials: 'omit',
    headers: { apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY, 'Content-Type': 'application/json' },
    ...(payload ? { body: JSON.stringify(payload) } : {}),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Não foi possível acessar a pesquisa.');
  return data;
}
const notas = ['Muito insatisfeito', 'Insatisfeito', 'Neutro', 'Satisfeito', 'Muito satisfeito'];
const rostos = ['😞', '🙁', '😐', '🙂', '😄'];

export default function PesquisaSatisfacao() {
  const [dados, setDados] = useState<Dados>();
  const [comando, setComando] = useState('');
  const [regional, setRegional] = useState('');
  const [divisao, setDivisao] = useState('');
  const [nota, setNota] = useState('');
  const [respostas, setRespostas] = useState<string[]>([]);
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [tentativa, setTentativa] = useState(0);
  useEffect(() => {
    let ativo = true;
    document.title = 'Pesquisa de Satisfação - INSANOS MC | VP1';
    chamar().then((d: Dados) => {
      if (!ativo) return;
      setDados(d); setComando(d.comandos.length === 1 ? d.comandos[0].id : '');
      setRespostas(d.perguntas.map(() => '')); setErro('');
    }).catch(e => { if (ativo) setErro(e.message); });
    return () => { ativo = false; };
  }, [tentativa]);
  async function enviar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (enviando || enviado || !dados) return;
    if (respostas.some((r, i) => i !== 5 && !r.trim())) {
      setErro('Preencha as perguntas obrigatórias.'); return;
    }
    setEnviando(true); setErro('');
    try {
      const result = await chamar({ comandoId: comando, regionalId: regional, divisaoId: divisao, nota: Number(nota), respostas });
      if (result.ok !== true) throw new Error('Não foi possível confirmar o envio.');
      setEnviado(true);
    } catch (e) { setErro(e instanceof Error ? e.message : 'Não foi possível enviar.'); }
    finally { setEnviando(false); }
  }
  return <div className="pesquisa-satisfacao"><main className="pesquisa-wrap">
    <section className="pesquisa-panel">
      <h1>Pesquisa de Satisfação Interna</h1>
      <p className="pesquisa-muted">Sua opinião contribui para melhorar nossas divisões. Responda com sinceridade.</p>
      <div className="pesquisa-notice"><strong>Pesquisa anônima.</strong> Não solicitamos nome, nome de colete, ID ou e-mail. O formulário não envia informações de identificação do integrante junto às respostas.</div>
    </section>
    {dados && !enviado && <form className="pesquisa-panel" onSubmit={enviar}>
      <fieldset disabled={enviando}>
        <h2>Selecione a divisão avaliada</h2>
        <label htmlFor="pesquisa-comando">Comando <span className="pesquisa-req">*</span></label>
        <select id="pesquisa-comando" required value={comando} onChange={e => { setComando(e.target.value); setRegional(''); setDivisao(''); }}>
          <option value="">Selecione o comando</option>{dados.comandos.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
        </select>
        <label htmlFor="pesquisa-regional">Regional <span className="pesquisa-req">*</span></label>
        <select id="pesquisa-regional" required disabled={!comando || enviando} value={regional} onChange={e => { setRegional(e.target.value); setDivisao(''); }}>
          <option value="">Selecione a regional</option>{dados.regionais.filter(r => r.comandoId === comando).map(r => <option key={r.id} value={r.id}>{r.nome}</option>)}
        </select>
        <label htmlFor="pesquisa-divisao">Divisão <span className="pesquisa-req">*</span></label>
        <select id="pesquisa-divisao" required disabled={!regional || enviando} value={divisao} onChange={e => setDivisao(e.target.value)}>
          <option value="">Selecione a divisão</option>{dados.divisoes.filter(d => d.regionalId === regional).map(d => <option key={d.id} value={d.id}>{d.nome}</option>)}
        </select>
        <fieldset className="pesquisa-rating">
          <legend>De modo geral, qual é o seu nível de satisfação com a divisão avaliada? <span className="pesquisa-req">*</span></legend>
          <div className="pesquisa-notas">{notas.map((n, i) => <label key={n}>
            <input type="radio" name="nota" required value={i + 1} checked={nota === String(i + 1)} onChange={e => setNota(e.target.value)} />
            <span>{i + 1} {rostos[i]}</span><span>{n}</span>
          </label>)}</div>
        </fieldset>
        {dados.perguntas.map((q, i) => <div key={q}>
          <label htmlFor={`pesquisa-q${i}`}>{i + 1}. {q}{i !== 5 && <span className="pesquisa-req"> *</span>}</label>
          <textarea id={`pesquisa-q${i}`} required={i !== 5} maxLength={5000} value={respostas[i] || ''} onChange={e => setRespostas(rs => rs.map((r, j) => i === j ? e.target.value : r))} />
        </div>)}
        <Button className="pesquisa-enviar" type="submit" disabled={enviando}>{enviando ? 'Enviando...' : 'Enviar avaliação anônima'}</Button>
      </fieldset>
    </form>}
    {enviado && <section className="pesquisa-panel pesquisa-success" role="status">Avaliação enviada. Obrigado pela contribuição!</section>}
    {!dados && !erro && <section className="pesquisa-panel" role="status">Carregando estrutura...</section>}
    {erro && <section className="pesquisa-panel pesquisa-error" role="alert">{erro}{!dados && <Button className="pesquisa-enviar" onClick={() => { setErro(''); setTentativa(t => t + 1); }}>Tentar novamente</Button>}</section>}
  </main></div>;
}