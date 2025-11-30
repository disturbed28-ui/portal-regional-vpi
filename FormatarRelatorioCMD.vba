Sub FormatarRelatorioCMD()
'==============================================================================
' MACRO DE FORMATAÇÃO DINÂMICA PARA RELATÓRIO CMD
' Com seleção de arquivo via caixa de diálogo
' Aplica formatação automaticamente identificando blocos pelos títulos
' Funciona independente da quantidade de divisões
'==============================================================================

Dim ws As Worksheet
Dim wb As Workbook
Dim ultimaLinha As Long
Dim linhaAtual As Long
Dim celula As Range
Dim tituloBloco As String
Dim linhaInicio As Long
Dim linhaFim As Long
Dim arquivoSelecionado As Variant

' ==============================
' SELEÇÃO DO ARQUIVO
' ==============================
arquivoSelecionado = Application.GetOpenFilename( _
    FileFilter:="Arquivos Excel (*.xlsx;*.xls),*.xlsx;*.xls", _
    Title:="Selecione o arquivo do Relatório CMD para formatar")

' Verificar se usuário cancelou
If arquivoSelecionado = False Then
    MsgBox "Operação cancelada.", vbInformation, "Formatação CMD"
    Exit Sub
End If

' Abrir o arquivo selecionado
Set wb = Workbooks.Open(arquivoSelecionado)
Set ws = wb.Sheets(1) ' Primeira aba

' Encontrar última linha com dados
ultimaLinha = ws.Cells(ws.Rows.Count, 1).End(xlUp).Row

' ==============================
' CONFIGURAÇÕES GLOBAIS
' ==============================

' Larguras das colunas
ws.Columns("A:A").ColumnWidth = 50
ws.Columns("B:H").ColumnWidth = 15

' ==============================
' FORMATAR CABEÇALHO (Linhas 1-4)
' ==============================
With ws.Range("A1:A3")
    .Font.Bold = True
    .Font.Size = 14
    .HorizontalAlignment = xlCenter
End With

' ==============================
' IDENTIFICAR E FORMATAR BLOCOS
' ==============================

linhaAtual = 5 ' Começa após o cabeçalho

Do While linhaAtual <= ultimaLinha
    Set celula = ws.Cells(linhaAtual, 1)
    tituloBloco = Trim(UCase(celula.Value))
    
    ' Verificar se é um título de bloco conhecido
    If tituloBloco <> "" And _
       (InStr(tituloBloco, "MOVIMENTAÇÃO") > 0 Or _
        InStr(tituloBloco, "CRESCIMENTO") > 0 Or _
        InStr(tituloBloco, "EFETIVO") > 0 Or _
        InStr(tituloBloco, "INADIMPLÊNCIA") > 0 Or _
        InStr(tituloBloco, "AÇÕES DE") > 0 Or _
        InStr(tituloBloco, "ENTRADAS") > 0 Or _
        InStr(tituloBloco, "CONFLITOS") > 0 Or _
        InStr(tituloBloco, "AÇÕES SOCIAIS") > 0 Or _
        InStr(tituloBloco, "BATEDORES") > 0 Or _
        InStr(tituloBloco, "CAVEIRAS") > 0 Or _
        InStr(tituloBloco, "SGT ARMAS") > 0 Or _
        InStr(tituloBloco, "COMBATE") > 0 Or _
        InStr(tituloBloco, "PERÍODO") > 0) Then
        
        ' FORMATAR TÍTULO DO BLOCO
        With celula
            .Font.Bold = True
            .Font.Size = 11
            .Interior.Color = RGB(217, 217, 217) ' Cinza claro
            .Borders(xlEdgeBottom).LineStyle = xlContinuous
        End With
        
        linhaInicio = linhaAtual + 1
        
        ' FORMATAR CABEÇALHO (próxima linha)
        If linhaInicio <= ultimaLinha Then
            Dim ultimaColuna As Long
            ultimaColuna = ws.Cells(linhaInicio, ws.Columns.Count).End(xlToLeft).Column
            
            With ws.Range(ws.Cells(linhaInicio, 1), ws.Cells(linhaInicio, ultimaColuna))
                .Font.Bold = True
                .Interior.Color = RGB(189, 215, 238) ' Azul claro
                .Borders(xlEdgeTop).LineStyle = xlContinuous
                .Borders(xlEdgeBottom).LineStyle = xlContinuous
                .Borders(xlEdgeLeft).LineStyle = xlContinuous
                .Borders(xlEdgeRight).LineStyle = xlContinuous
                .Borders(xlInsideVertical).LineStyle = xlContinuous
            End With
            
            ' ENCONTRAR FIM DO BLOCO (célula vazia ou próximo título)
            linhaFim = linhaInicio + 1
            Do While linhaFim <= ultimaLinha
                If Trim(ws.Cells(linhaFim, 1).Value) = "" Then
                    linhaFim = linhaFim - 1
                    Exit Do
                End If
                
                ' Verificar se é início de novo bloco
                Dim proximoTexto As String
                proximoTexto = Trim(UCase(ws.Cells(linhaFim, 1).Value))
                If (InStr(proximoTexto, "MOVIMENTAÇÃO") > 0 Or _
                    InStr(proximoTexto, "CRESCIMENTO") > 0 Or _
                    InStr(proximoTexto, "EFETIVO") > 0 Or _
                    InStr(proximoTexto, "INADIMPLÊNCIA") > 0 Or _
                    InStr(proximoTexto, "AÇÕES DE") > 0 Or _
                    InStr(proximoTexto, "ENTRADAS") > 0 Or _
                    InStr(proximoTexto, "CONFLITOS") > 0 Or _
                    InStr(proximoTexto, "AÇÕES SOCIAIS") > 0 Or _
                    InStr(proximoTexto, "BATEDORES") > 0 Or _
                    InStr(proximoTexto, "CAVEIRAS") > 0 Or _
                    InStr(proximoTexto, "SGT ARMAS") > 0 Or _
                    InStr(proximoTexto, "COMBATE") > 0) And linhaFim > linhaInicio + 1 Then
                    linhaFim = linhaFim - 1
                    Exit Do
                End If
                
                linhaFim = linhaFim + 1
            Loop
            
            ' FORMATAR DADOS DO BLOCO
            If linhaFim >= linhaInicio + 1 Then
                ultimaColuna = ws.Cells(linhaInicio, ws.Columns.Count).End(xlToLeft).Column
                
                With ws.Range(ws.Cells(linhaInicio + 1, 1), ws.Cells(linhaFim, ultimaColuna))
                    .Borders(xlEdgeTop).LineStyle = xlContinuous
                    .Borders(xlEdgeBottom).LineStyle = xlContinuous
                    .Borders(xlEdgeLeft).LineStyle = xlContinuous
                    .Borders(xlEdgeRight).LineStyle = xlContinuous
                    .Borders(xlInsideVertical).LineStyle = xlContinuous
                    .Borders(xlInsideHorizontal).LineStyle = xlContinuous
                End With
                
                ' FORMATAR LINHA TOTAL (última linha do bloco)
                Dim linhaTotalTexto As String
                linhaTotalTexto = Trim(UCase(ws.Cells(linhaFim, 1).Value))
                If linhaTotalTexto = "TOTAL" Or InStr(linhaTotalTexto, "SEM ") > 0 Then
                    With ws.Range(ws.Cells(linhaFim, 1), ws.Cells(linhaFim, ultimaColuna))
                        .Font.Bold = True
                        .Borders(xlEdgeTop).Weight = xlMedium
                    End With
                End If
            End If
            
            ' Pular para depois do bloco
            linhaAtual = linhaFim + 2
        Else
            linhaAtual = linhaAtual + 1
        End If
    Else
        linhaAtual = linhaAtual + 1
    End If
Loop

' ==============================
' AJUSTES FINAIS
' ==============================

' Centralizar números
ws.Columns("B:H").HorizontalAlignment = xlCenter

' Zoom confortável
ActiveWindow.Zoom = 90

' Salvar arquivo
wb.Save

MsgBox "Formatação aplicada com sucesso!" & vbCrLf & _
       "Arquivo: " & wb.Name & vbCrLf & _
       "Total de linhas processadas: " & ultimaLinha, vbInformation, "Formatação CMD"

End Sub
