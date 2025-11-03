Option Explicit

' =========================================================================
' MACRO: Compilar Dados de Integrantes
' =========================================================================
' Objetivo: Combinar dados do Arquivo A (IDs e datas) com Arquivo B (dados completos)
' 
' Arquivo A: Estrutura hierárquica em blocos (Regional > Divisão > Integrantes)
'   - Colunas: Numero (ID), Apelido (Nome), Cargo/Funcao, Dt.Adm.
' 
' Arquivo B: Estrutura tabular completa mas faltando ID e Data de Admissão
'   - Colunas: Regional, Divisao, NomeColete, Cargo, etc.
'   - Faltam: id_integrante, data_entrada
' 
' Resultado: Arquivo B completo com id_integrante e data_entrada preenchidos
' =========================================================================

Sub CompilaDadosIntegrantes()
    Dim wbA As Workbook, wbB As Workbook
    Dim wsA As Worksheet, wsB As Worksheet
    Dim dictIntegrantes As Object, dictDivisoesCompletas As Object
    Dim ultimaLinhaA As Long, ultimaLinhaB As Long
    Dim i As Long, j As Long
    Dim regionalAtual As String, divisaoAtual As String, divisaoNormalizada As String
    Dim nomeIntegrante As String, idIntegrante As String, dataAdmissao As String
    Dim chave As String
    Dim encontrados As Long, naoEncontrados As Long
    Dim listaNaoEncontrados As String
    Dim colID As Long, colData As Long, colDivisaoCompleta As Long
    
    ' Inicializar variáveis
    Set dictIntegrantes = CreateObject("Scripting.Dictionary")
    Set dictDivisoesCompletas = CreateObject("Scripting.Dictionary")
    encontrados = 0
    naoEncontrados = 0
    listaNaoEncontrados = ""
    
    On Error GoTo ErroHandler
    
    ' =========================================================================
    ' PASSO 1: ABRIR ARQUIVOS
    ' =========================================================================
    Application.ScreenUpdating = False
    Application.DisplayAlerts = False
    
    ' Solicitar Arquivo A
    Dim caminhoA As String
    caminhoA = Application.GetOpenFilename("Arquivos Excel (*.xls; *.xlsx), *.xls; *.xlsx", , "Selecione o Arquivo A (com IDs)")
    If caminhoA = "False" Then
        MsgBox "Operação cancelada pelo usuário.", vbInformation
        Exit Sub
    End If
    Set wbA = Workbooks.Open(caminhoA)
    Set wsA = wbA.Sheets(1)
    
    ' Solicitar Arquivo B
    Dim caminhoB As String
    caminhoB = Application.GetOpenFilename("Arquivos Excel (*.xls; *.xlsx), *.xls; *.xlsx", , "Selecione o Arquivo B (dados completos)")
    If caminhoB = "False" Then
        wbA.Close SaveChanges:=False
        MsgBox "Operação cancelada pelo usuário.", vbInformation
        Exit Sub
    End If
    Set wbB = Workbooks.Open(caminhoB)
    Set wsB = wbB.Sheets(1)
    
    ' =========================================================================
    ' PASSO 2: LER ARQUIVO A E CONSTRUIR DICIONÁRIO
    ' =========================================================================
    Debug.Print "=========================================="
    Debug.Print "INICIANDO PROCESSAMENTO DO ARQUIVO A"
    Debug.Print "=========================================="
    
    ultimaLinhaA = wsA.Cells(wsA.Rows.Count, 1).End(xlUp).Row
    regionalAtual = ""
    divisaoAtual = ""
    
    For i = 1 To ultimaLinhaA
        Dim colA As String, colB As String
        colA = Trim(CStr(wsA.Cells(i, 1).Value))
        colB = Trim(CStr(wsA.Cells(i, 2).Value))
        
        ' Detectar linhas vazias
        If colA = "" And colB = "" Then
            GoTo ProximaLinhaA
        End If
        
        ' =====================================================================
        ' DETECTAR REGIONAL (linha sem número na coluna A, texto em maiúsculas)
        ' =====================================================================
        If Not IsNumeric(colA) And colA <> "" And InStr(1, colA, "REGIONAL", vbTextCompare) > 0 Then
            regionalAtual = LimpaNomeEstrutura(colA)
            divisaoAtual = regionalAtual ' Integrantes da regional usam regional como divisão
            Debug.Print ">>> REGIONAL: " & regionalAtual
            GoTo ProximaLinhaA
        End If
        
        ' =====================================================================
        ' DETECTAR DIVISÃO (linha sem número na coluna A, não é regional)
        ' =====================================================================
        If Not IsNumeric(colA) And colA <> "" And colA <> "Numero" Then
            ' É uma divisão - armazenar nome COMPLETO original
            divisaoAtual = colA ' Nome completo original
            divisaoNormalizada = NormalizaDivisao(divisaoAtual)
            
            ' Armazenar mapeamento normalizado -> completo
            If Not dictDivisoesCompletas.Exists(divisaoNormalizada) Then
                dictDivisoesCompletas.Add divisaoNormalizada, divisaoAtual
            End If
            
            Debug.Print "  >> DIVISÃO: " & divisaoAtual & " -> " & divisaoNormalizada
            GoTo ProximaLinhaA
        End If
        
        ' =====================================================================
        ' DETECTAR INTEGRANTE (linha com número na coluna A)
        ' =====================================================================
        If IsNumeric(colA) And colA <> "" Then
            idIntegrante = colA
            nomeIntegrante = LimpaNome(colB)
            dataAdmissao = ""
            
            ' Buscar data de admissão (normalmente coluna D ou E)
            If wsA.Cells(i, 4).Value <> "" Then
                dataAdmissao = FormatarData(wsA.Cells(i, 4).Value)
            ElseIf wsA.Cells(i, 5).Value <> "" Then
                dataAdmissao = FormatarData(wsA.Cells(i, 5).Value)
            End If
            
            ' Criar chave única: Nome + "|" + Divisão NORMALIZADA
            divisaoNormalizada = NormalizaDivisao(divisaoAtual)
            chave = nomeIntegrante & "|" & divisaoNormalizada
            
            ' Adicionar ao dicionário
            If Not dictIntegrantes.Exists(chave) Then
                dictIntegrantes.Add chave, idIntegrante & "|" & dataAdmissao & "|" & divisaoAtual
                Debug.Print "    - " & nomeIntegrante & " (ID: " & idIntegrante & ") [" & divisaoNormalizada & "]"
            Else
                ' Integrante com mesmo nome e divisão já existe
                Debug.Print "    ! DUPLICADO: " & nomeIntegrante & " (ID: " & idIntegrante & ") [" & divisaoNormalizada & "]"
            End If
        End If
        
ProximaLinhaA:
    Next i
    
    Debug.Print ""
    Debug.Print "Total de integrantes únicos no dicionário: " & dictIntegrantes.Count
    Debug.Print ""
    
    ' =========================================================================
    ' PASSO 3: PROCESSAR ARQUIVO B E ADICIONAR COLUNAS
    ' =========================================================================
    Debug.Print "=========================================="
    Debug.Print "PROCESSANDO ARQUIVO B"
    Debug.Print "=========================================="
    
    ultimaLinhaB = wsB.Cells(wsB.Rows.Count, 1).End(xlUp).Row
    
    ' Encontrar coluna "NomeColete" e "Divisao" no cabeçalho
    Dim colNome As Long, colDivisao As Long
    colNome = 0
    colDivisao = 0
    
    For j = 1 To 20 ' Procurar nas primeiras 20 colunas
        Dim headerText As String
        headerText = Trim(CStr(wsB.Cells(3, j).Value))
        
        If InStr(1, headerText, "NomeColete", vbTextCompare) > 0 Or _
           InStr(1, headerText, "Nome", vbTextCompare) > 0 Then
            colNome = j
        End If
        
        If InStr(1, headerText, "Divisao", vbTextCompare) > 0 Or _
           InStr(1, headerText, "Divisão", vbTextCompare) > 0 Then
            colDivisao = j
        End If
    Next j
    
    If colNome = 0 Or colDivisao = 0 Then
        MsgBox "Erro: Não foi possível encontrar as colunas NomeColete e/ou Divisão no Arquivo B.", vbCritical
        GoTo Cleanup
    End If
    
    ' =========================================================================
    ' PASSO 3.1: INSERIR COLUNA A PARA id_integrante
    ' =========================================================================
    ' Inserir nova coluna A - isso empurra todas as colunas existentes para a direita
    wsB.Columns(1).Insert Shift:=xlToRight
    
    ' Agora todas as colunas foram deslocadas em +1
    ' Coluna A (nova): id_integrante
    ' Coluna B (era A): comando
    ' Coluna C (era B): cargo
    ' ...
    
    colID = 1 ' id_integrante agora é a coluna A
    
    ' Ajustar referências das colunas que foram deslocadas
    colNome = colNome + 1
    colDivisao = colDivisao + 1
    
    ' =========================================================================
    ' PASSO 3.2: RENOMEAR COLUNA "cargo" PARA "cargo_grau"
    ' =========================================================================
    ' Procurar a coluna que contém "cargo" e renomear para "cargo_grau"
    For j = 1 To 20
        Dim cargoHeader As String
        cargoHeader = Trim(CStr(wsB.Cells(3, j).Value))
        
        If InStr(1, cargoHeader, "cargo", vbTextCompare) > 0 Then
            wsB.Cells(3, j).Value = "cargo_grau"
            Debug.Print "  >> Coluna 'cargo' renomeada para 'cargo_grau' na coluna " & j
            Exit For
        End If
    Next j
    
    ' =========================================================================
    ' PASSO 3.3: ADICIONAR COLUNA data_entrada NO FINAL
    ' =========================================================================
    Dim ultimaColB As Long
    ultimaColB = wsB.Cells(3, wsB.Columns.Count).End(xlToLeft).Column
    colData = ultimaColB + 1
    
    ' Cabeçalhos das novas colunas
    wsB.Cells(3, colID).Value = "id_integrante"
    wsB.Cells(3, colData).Value = "data_entrada"
    
    ' Formatar cabeçalhos
    With wsB.Range(wsB.Cells(3, colID), wsB.Cells(3, colID))
        .Font.Bold = True
        .Interior.Color = RGB(200, 230, 255)
    End With
    
    With wsB.Range(wsB.Cells(3, colData), wsB.Cells(3, colData))
        .Font.Bold = True
        .Interior.Color = RGB(200, 230, 255)
    End With
    
    Debug.Print "  >> Coluna 'id_integrante' adicionada na coluna A"
    Debug.Print "  >> Coluna 'data_entrada' adicionada na coluna " & colData
    
    ' Processar cada linha do Arquivo B (começando da linha 4)
    For i = 4 To ultimaLinhaB
        nomeIntegrante = LimpaNome(CStr(wsB.Cells(i, colNome).Value))
        divisaoAtual = CStr(wsB.Cells(i, colDivisao).Value) ' Nome truncado original
        divisaoNormalizada = NormalizaDivisao(divisaoAtual)
        
        ' Criar chave de busca com nome normalizado
        chave = nomeIntegrante & "|" & divisaoNormalizada
        
        Dim encontrou As Boolean
        encontrou = False
        Dim divisaoEncontrada As String
        
        ' Tentar buscar diretamente
        If dictIntegrantes.Exists(chave) Then
            encontrou = True
            divisaoEncontrada = divisaoNormalizada
        Else
            ' Se divisão termina com "EXTREMO - SP", tentar variações
            If Right(divisaoNormalizada, 12) = "EXTREMO - SP" Then
                Dim baseExtremo As String
                baseExtremo = Left(divisaoNormalizada, Len(divisaoNormalizada) - 12)
                
                Dim variantes As Variant
                variantes = Array("EXTREMO SUL - SP", "EXTREMO NORTE - SP", "EXTREMO LESTE - SP", "EXTREMO OESTE - SP")
                
                Dim v As Variant
                For Each v In variantes
                    Dim chaveVariante As String
                    chaveVariante = nomeIntegrante & "|" & baseExtremo & v
                    
                    If dictIntegrantes.Exists(chaveVariante) Then
                        chave = chaveVariante
                        divisaoEncontrada = baseExtremo & v
                        encontrou = True
                        Exit For
                    End If
                Next v
            End If
        End If
        
        ' Processar resultado
        If encontrou Then
            ' Encontrado! Extrair ID, Data e Divisão Completa
            Dim dados As String
            dados = dictIntegrantes(chave)
            
            Dim partes() As String
            partes = Split(dados, "|")
            
            wsB.Cells(i, colID).Value = partes(0) ' ID
            If UBound(partes) >= 1 Then
                wsB.Cells(i, colData).Value = partes(1) ' Data
            End If
            If UBound(partes) >= 2 Then
                wsB.Cells(i, colDivisao).Value = partes(2) ' Substituir divisão truncada pela completa
            End If
            
            encontrados = encontrados + 1
        Else
            ' Não encontrado
            wsB.Cells(i, colID).Value = "NÃO ENCONTRADO"
            wsB.Cells(i, colData).Value = "NÃO ENCONTRADO"
            wsB.Cells(i, colDivisao).Value = "NÃO ENCONTRADO"
            wsB.Cells(i, colID).Interior.Color = RGB(255, 200, 200)
            wsB.Cells(i, colData).Interior.Color = RGB(255, 200, 200)
            wsB.Cells(i, colDivisao).Interior.Color = RGB(255, 200, 200)
            
            naoEncontrados = naoEncontrados + 1
            listaNaoEncontrados = listaNaoEncontrados & vbCrLf & "  - " & nomeIntegrante & " [" & divisaoNormalizada & "]"
            
            Debug.Print "  X NÃO ENCONTRADO: " & nomeIntegrante & " [" & divisaoNormalizada & "]"
        End If
    Next i
    
    ' =========================================================================
    ' PASSO 4: LIMPEZA E AJUSTES FINAIS
    ' =========================================================================
    Debug.Print ""
    Debug.Print "=========================================="
    Debug.Print "LIMPEZA E AJUSTES FINAIS"
    Debug.Print "=========================================="
    
    ' Procurar e renomear coluna CargoEstagio para cargo_estagio
    Dim colCargoEstagio As Long
    colCargoEstagio = 0
    
    For j = 1 To 30
        Dim headerValue As String
        headerValue = Trim(CStr(wsB.Cells(3, j).Value))
        
        If InStr(1, headerValue, "CargoEstagio", vbTextCompare) > 0 Or _
           InStr(1, headerValue, "Cargo Estagio", vbTextCompare) > 0 Or _
           InStr(1, headerValue, "CargoEstágio", vbTextCompare) > 0 Or _
           InStr(1, headerValue, "Estagio", vbTextCompare) > 0 Or _
           InStr(1, headerValue, "Estágio", vbTextCompare) > 0 Then
            colCargoEstagio = j
            Exit For
        End If
    Next j
    
    If colCargoEstagio > 0 Then
        ' Renomear para Estagio (formato legível para Excel)
        wsB.Cells(3, colCargoEstagio).Value = "Estagio"
        Debug.Print "  >> Coluna 'CargoEstagio' (coluna " & colCargoEstagio & ") renomeada para 'Estagio'"
    Else
        Debug.Print "  >> Coluna 'CargoEstagio' não encontrada"
    End If
    
    ' =========================================================================
    ' PASSO 5: RELATÓRIO FINAL
    ' =========================================================================
    Debug.Print ""
    Debug.Print "=========================================="
    Debug.Print "RELATÓRIO FINAL"
    Debug.Print "=========================================="
    Debug.Print "Total de linhas processadas: " & (ultimaLinhaB - 1)
    Debug.Print "Encontrados e preenchidos: " & encontrados
    Debug.Print "Não encontrados: " & naoEncontrados
    Debug.Print ""
    
    ' Ajustar largura das colunas
    wsB.Columns(colID).AutoFit
    wsB.Columns(colData).AutoFit
    wsB.Columns(colDivisao).AutoFit
    
    ' Remover linhas vazias do topo (linhas 1 e 2)
    If Application.WorksheetFunction.CountA(wsB.Rows(1)) = 0 Then
        wsB.Rows("1:2").Delete
    End If
    
    ' Salvar Arquivo B
    Dim novoCaminho As String
    novoCaminho = Replace(caminhoB, ".xls", "-COMPLETO.xlsx")
    wbB.SaveAs novoCaminho, FileFormat:=51 ' xlOpenXMLWorkbook
    
    ' Mensagem final
    Dim mensagemFinal As String
    mensagemFinal = "Processamento concluído!" & vbCrLf & vbCrLf
    mensagemFinal = mensagemFinal & "Total processados: " & (ultimaLinhaB - 1) & vbCrLf
    mensagemFinal = mensagemFinal & "Encontrados: " & encontrados & vbCrLf
    mensagemFinal = mensagemFinal & "Não encontrados: " & naoEncontrados & vbCrLf & vbCrLf
    mensagemFinal = mensagemFinal & "Arquivo salvo como:" & vbCrLf & novoCaminho
    
    If naoEncontrados > 0 Then
        mensagemFinal = mensagemFinal & vbCrLf & vbCrLf & "Integrantes não encontrados:" & listaNaoEncontrados
    End If
    
    MsgBox mensagemFinal, vbInformation, "Compilação Concluída"
    
Cleanup:
    ' Fechar arquivos
    wbA.Close SaveChanges:=False
    wbB.Close SaveChanges:=True
    
    Application.ScreenUpdating = True
    Application.DisplayAlerts = True
    
    Exit Sub
    
ErroHandler:
    MsgBox "Erro durante o processamento: " & Err.Description, vbCritical
    On Error Resume Next
    If Not wbA Is Nothing Then wbA.Close SaveChanges:=False
    If Not wbB Is Nothing Then wbB.Close SaveChanges:=False
    Application.ScreenUpdating = True
    Application.DisplayAlerts = True
End Sub

' =========================================================================
' FUNÇÕES AUXILIARES
' =========================================================================

' Limpar nome de integrante (remover espaços extras, converter para maiúsculas)
Function LimpaNome(nome As String) As String
    nome = Trim(UCase(nome))
    nome = Replace(nome, "  ", " ") ' Remover espaços duplos
    LimpaNome = nome
End Function

' Limpar nome de estrutura (Regional/Divisão)
Function LimpaNomeEstrutura(texto As String) As String
    texto = Trim(UCase(texto))
    
    ' Remover prefixos comuns
    texto = Replace(texto, "REGIONAL ", "REGIONAL ")
    texto = Replace(texto, "DIVISAO ", "DIVISAO ")
    texto = Replace(texto, "DIVISÃO ", "DIVISAO ")
    
    ' Normalizar texto
    texto = Replace(texto, "  ", " ")
    
    LimpaNomeEstrutura = texto
End Function

' Remover acentos e caracteres especiais
Function RemoveAcentos(texto As String) As String
    texto = Replace(texto, "Á", "A")
    texto = Replace(texto, "À", "A")
    texto = Replace(texto, "Ã", "A")
    texto = Replace(texto, "Â", "A")
    texto = Replace(texto, "Ä", "A")
    texto = Replace(texto, "É", "E")
    texto = Replace(texto, "È", "E")
    texto = Replace(texto, "Ê", "E")
    texto = Replace(texto, "Ë", "E")
    texto = Replace(texto, "Í", "I")
    texto = Replace(texto, "Ì", "I")
    texto = Replace(texto, "Î", "I")
    texto = Replace(texto, "Ï", "I")
    texto = Replace(texto, "Ó", "O")
    texto = Replace(texto, "Ò", "O")
    texto = Replace(texto, "Õ", "O")
    texto = Replace(texto, "Ô", "O")
    texto = Replace(texto, "Ö", "O")
    texto = Replace(texto, "Ú", "U")
    texto = Replace(texto, "Ù", "U")
    texto = Replace(texto, "Û", "U")
    texto = Replace(texto, "Ü", "U")
    texto = Replace(texto, "Ç", "C")
    texto = Replace(texto, "á", "a")
    texto = Replace(texto, "à", "a")
    texto = Replace(texto, "ã", "a")
    texto = Replace(texto, "â", "a")
    texto = Replace(texto, "ä", "a")
    texto = Replace(texto, "é", "e")
    texto = Replace(texto, "è", "e")
    texto = Replace(texto, "ê", "e")
    texto = Replace(texto, "ë", "e")
    texto = Replace(texto, "í", "i")
    texto = Replace(texto, "ì", "i")
    texto = Replace(texto, "î", "i")
    texto = Replace(texto, "ï", "i")
    texto = Replace(texto, "ó", "o")
    texto = Replace(texto, "ò", "o")
    texto = Replace(texto, "õ", "o")
    texto = Replace(texto, "ô", "o")
    texto = Replace(texto, "ö", "o")
    texto = Replace(texto, "ú", "u")
    texto = Replace(texto, "ù", "u")
    texto = Replace(texto, "û", "u")
    texto = Replace(texto, "ü", "u")
    texto = Replace(texto, "ç", "c")
    
    RemoveAcentos = texto
End Function

' Normalizar nome de divisão para matching
Function NormalizaDivisao(divisao As String) As String
    ' 1. Limpar e converter para maiúsculas
    divisao = Trim(UCase(divisao))
    
    ' 2. Remover acentos
    divisao = RemoveAcentos(divisao)
    
    ' 3. Padronizar "Divisão" -> "DIVISAO"
    divisao = Replace(divisao, "DIVISÃO", "DIVISAO")
    
    ' 4. Normalizar múltiplos espaços
    Do While InStr(divisao, "  ") > 0
        divisao = Replace(divisao, "  ", " ")
    Loop
    
    ' 5. Remover todos os sufixos possíveis de " - SP" e suas variações
    divisao = Replace(divisao, " - SP", "")
    divisao = Replace(divisao, " -SP", "")
    divisao = Replace(divisao, "-SP", "")
    divisao = Replace(divisao, " - S", "")
    divisao = Replace(divisao, " -S", "")
    divisao = Replace(divisao, "-S", "")
    divisao = Replace(divisao, "–SP", "")  ' travessão
    divisao = Replace(divisao, "— SP", "")  ' travessão longo
    
    ' 6. Limpar completamente o final da string
    ' Remove espaços, hífens, letras S e P soltas
    divisao = Trim(divisao)
    
    Do While Len(divisao) > 0
        Dim ultimoChar As String
        ultimoChar = Right(divisao, 1)
        
        ' Se o último caractere for espaço, hífen, S ou P, remove
        If ultimoChar = " " Or ultimoChar = "-" Or ultimoChar = "S" Or ultimoChar = "P" Then
            divisao = Left(divisao, Len(divisao) - 1)
        Else
            Exit Do ' Não é mais um caractere a ser removido
        End If
    Loop
    
    ' 7. Trim final e adicionar " - SP" padronizado
    divisao = Trim(divisao) & " - SP"
    
    NormalizaDivisao = divisao
End Function

' Formatar data
Function FormatarData(valor As Variant) As String
    On Error Resume Next
    If IsDate(valor) Then
        FormatarData = Format(CDate(valor), "dd/mm/yyyy")
    Else
        FormatarData = CStr(valor)
    End If
    On Error GoTo 0
End Function
