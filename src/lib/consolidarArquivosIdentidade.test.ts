// @ts-expect-error bun test runtime
import { it, expect } from 'bun:test';
import * as XLSX from 'xlsx';
import { consolidarArquivos } from './consolidarArquivos';

it('preserva o ID explícito do arquivo B em vez do ID de um homônimo do arquivo A', async () => {
  const readerOriginal = globalThis.FileReader;
  class LeitorTeste {
    onload?: (event: { target: { result: string } }) => void;
    async readAsBinaryString(file: File) {
      const bytes = new Uint8Array(await file.arrayBuffer());
      this.onload?.({ target: { result: Array.from(bytes, byte => String.fromCharCode(byte)).join('') } });
    }
  }
  Object.defineProperty(globalThis, 'FileReader', { configurable: true, writable: true, value: LeitorTeste });
  const arquivo = (linhas: unknown[][], nome: string) => {
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(linhas), 'Integrantes');
    return new File([XLSX.write(book, { type: 'array', bookType: 'xlsx' })], nome);
  };
  try {
    const a = arquivo([['REGIONAL VP3 - SP'], ['DIVISAO CENTRO - SP'], [101, 'Minero', '01/01/2020']], 'a.xlsx');
    const b = arquivo([['ID', 'NomeColete', 'cargo_grau', 'Comando', 'Regional', 'Divisão'], [202, 'Minero', 'PP (Grau X)', 'COMANDO V', 'REGIONAL VP3 - SP', 'DIVISAO CENTRO - SP']], 'b.xlsx');
    const resultado = await consolidarArquivos(a, b);
    expect(resultado.registros.map(item => item.id_integrante)).toEqual([202]);
    expect(resultado.registros[0]?.data_entrada).toBeUndefined();
  } finally {
    Object.defineProperty(globalThis, 'FileReader', { configurable: true, writable: true, value: readerOriginal });
  }
});