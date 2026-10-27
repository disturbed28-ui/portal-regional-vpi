import { useEffect, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import './PesquisaSatisfacao.css';

interface Dados {
  comandos: { id: string; nome: string }[];
  regionais: { id: string; comandoId: string; nome: string }[];
  divisoes: { id: string; regionalId: string; nome: string }[];
  perguntas: string[];
  atividades: { codigo: string; rotulo: string }[];
  perguntaAtividades: string;
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
const OPCIONAIS = [4, 6];
const ruimExcelente = ['Muito ruim', 'Ruim', 'Regular', 'Boa', 'Excelente'];
const ESCALAS = [
  { key: 'nota', titulo: 'De modo geral, qual é o seu nível de satisfação com a divisão que você está avaliando?', rotulos: ['Muito insatisfeito', 'Insatisfeito', 'Neutro', 'Satisfeito', 'Muito satisfeito'] },
  { key: 'pertencimento', titulo: 'Quanto você se sente acolhido, valorizado e parte da divisão que está avaliando?', rotulos: ['Nada', 'Pouco', 'Moderadamente', 'Muito', 'Totalmente'] },
  { key: 'lideranca', titulo: 'Como você avalia a atuação da diretoria da divisão em relação à comunicação, organização e atenção aos integrantes?', rotulos: ruimExcelente },
  { key: 'atividades', titulo: 'Como você avalia as oportunidades de participação em rolês, encontros e atividades promovidas pela divisão?', rotulos: ruimExcelente },
] as const;
type Chave = typeof ESCALAS[number]['key'];

export default function PesquisaSatisfacao() {
  const [dados, setDados] = useState<Dados>();
  const [comando, setComando] = useState('');
  const [regional, setRegional] = useState('');
  const [divisao, setDivisao] = useState('');
  const [notas, setNotas] = useState<Record<Chave, string>>({ nota: '', pertencimento: '', lideranca: '', atividades: '' });
  const [respostas, setRespostas] = useState<string[]>([]);
  const [sugeridas, setSugeridas] = useState<string[]>([]);
  const [outros, setOutros] = useState('');
  const [avisoAtv, setAvisoAtv] = useState('');
  function alternar(codigo: string) {
    setAvisoAtv('');
    setSugeridas(sel => {
      if (sel.includes(codigo)) return sel.filter(c => c !== codigo);
      if (codigo === 'NENHUMA') return ['NENHUMA'];
      const base = sel.filter(c => c !== 'NENHUMA');
      if (base.length >= 2) { setAvisoAtv('Você já selecionou duas opções. Desmarque uma para escolher outra.'); return sel; }
      return [...base, codigo];
    });
  }
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
    if (respostas.some((r, i) => !OPCIONAIS.includes(i) && !r.trim())) {
      setErro('Preencha as perguntas obrigatórias.'); return;
    }
    if (sugeridas.length === 0) { setErro('Selecione pelo menos uma atividade.'); return; }
    if (sugeridas.includes('OUTROS') && !outros.trim()) { setErro('Especifique a atividade em "Outros".'); return; }
    setEnviando(true); setErro('');
    try {
      const result = await chamar({
        comandoId: comando, regionalId: regional, divisaoId: divisao,
        nota: Number(notas.nota), pertencimento: Number(notas.pertencimento), lideranca: Number(notas.lideranca), atividades: Number(notas.atividades),
        respostas, atividadesSugeridas: sugeridas, atividadeOutros: sugeridas.includes('OUTROS') ? outros : '',
      });
      if (result.ok !== true) throw new Error('Não foi possível confirmar o envio.');
      setEnviado(true);
    } catch (e) { setErro(e instanceof Error ? e.message : 'Não foi possível enviar.'); }
    finally { setEnviando(false); }
  }
  return <div className="pesquisa-satisfacao"><main className="pesquisa-wrap">
    <section className="pesquisa-panel">
      <h1>Pesquisa de Satisfação Interna</h1>
      <p className="pesquisa-muted">Sua opinião contribui para melhorar nossas divisões. Responda com sinceridade.</p>
      <div className="pesquisa-notice">Esta pesquisa é anônima. Para preservar o anonimato de todos, evite mencionar nomes ou informações que identifiquem pessoas nas respostas.</div>
    </section>
    {dados && !enviado && <form onSubmit={enviar}>
      <fieldset disabled={enviando}>
        <section className="pesquisa-panel">
          <h2>Divisão avaliada</h2>
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
        </section>
        <section className="pesquisa-panel">
          <h2>Avaliação (1 a 5)</h2>
          {ESCALAS.map((esc, n) => <fieldset key={esc.key} className="pesquisa-rating">
            <legend>{n + 1}. {esc.titulo} <span className="pesquisa-req">*</span></legend>
            <div className="pesquisa-notas">{esc.rotulos.map((rot, i) => <label key={rot}>
              <input type="radio" name={esc.key} required value={i + 1} checked={notas[esc.key] === String(i + 1)} onChange={e => setNotas(s => ({ ...s, [esc.key]: e.target.value }))} />
              <strong>{i + 1}</strong><span>{rot}</span>
            </label>)}</div>
          </fieldset>)}
        </section>
        <section className="pesquisa-panel">
          <fieldset className="pesquisa-atividades">
            <legend>5. {dados.perguntaAtividades} <span className="pesquisa-req">*</span></legend>
            <p className="pesquisa-muted">Selecione até duas opções.</p>
            {dados.atividades.map(a => <label key={a.codigo} className="pesquisa-check">
              <input type="checkbox" name="atividades" value={a.codigo} checked={sugeridas.includes(a.codigo)} onChange={() => alternar(a.codigo)} />
              <span>{a.rotulo}</span>
            </label>)}
            {avisoAtv && <p className="pesquisa-aviso" role="status">{avisoAtv}</p>}
            {sugeridas.includes('OUTROS') && <>
              <label htmlFor="pesquisa-outros">Qual atividade? <span className="pesquisa-req">*</span></label>
              <textarea id="pesquisa-outros" required maxLength={500} value={outros} onChange={e => setOutros(e.target.value)} />
            </>}
          </fieldset>
        </section>
        <section className="pesquisa-panel">
          <h2>Respostas abertas</h2>
          {dados.perguntas.map((q, i) => <div key={q}>
            <label htmlFor={`pesquisa-q${i}`}>{i + 1}. {q}{OPCIONAIS.includes(i) ? <span className="pesquisa-opc"> (opcional)</span> : <span className="pesquisa-req"> *</span>}</label>
            <textarea id={`pesquisa-q${i}`} required={!OPCIONAIS.includes(i)} maxLength={5000} value={respostas[i] || ''} onChange={e => setRespostas(rs => rs.map((r, j) => i === j ? e.target.value : r))} />
          </div>)}
          <Button className="pesquisa-enviar" type="submit" disabled={enviando}>{enviando ? 'Enviando...' : 'Enviar avaliação anônima'}</Button>
        </section>
      </fieldset>
    </form>}
    {enviado && <section className="pesquisa-panel pesquisa-success" role="status">Avaliação enviada. Obrigado pela contribuição!</section>}
    {!dados && !erro && <section className="pesquisa-panel" role="status">Carregando estrutura...</section>}
    {erro && <section className="pesquisa-panel pesquisa-error" role="alert">{erro}{!dados && <Button className="pesquisa-enviar" onClick={() => { setErro(''); setTentativa(t => t + 1); }}>Tentar novamente</Button>}</section>}
  </main></div>;
}
