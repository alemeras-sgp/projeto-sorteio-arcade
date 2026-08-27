// Removemos qualquer listener antigo e usamos um único que monitora o documento inteiro
document.addEventListener('click', async (event) => {

    // Verifica se o elemento clicado é o nosso botão de login
    if (event.target && event.target.id === 'btn-login-admin') {
        //console.log("Clique capturado no botão de login!");

        const inputEmail = document.getElementById('email-admin').value;
        const inputSenha = document.getElementById('senha-admin').value;
        const msgErro = document.getElementById('erro-login');
        const telaLogin = document.getElementById('tela-login');
        const painelAdmin = document.getElementById('conteudo-admin');

        // Validação básica
        if (!inputEmail || !inputSenha) {
            alert("Preencha e-mail e senha!");
            return;
        }

        event.target.textContent = "Autenticando...";
        event.target.disabled = true;

        try {
            const { data, error } = await db.auth.signInWithPassword({
                email: inputEmail,
                password: inputSenha,
            });

            if (error) {
                console.error("Erro do Supabase:", error.message);
                msgErro.style.display = 'block';
                msgErro.textContent = "Erro: " + error.message;
                event.target.textContent = "Entrar no Painel";
                event.target.disabled = false;
            } else {
                //console.log("Sucesso!");
                telaLogin.style.display = 'none';
                painelAdmin.style.display = 'block';
            }
        } catch (e) {
            console.error("Erro inesperado:", e);
        }
    }
});

// --- AJUSTE NO TOPO DO ADMIN.JS ---
document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const chave = urlParams.get('chave');

    // 1. Primeira trava: Só entra na página se tiver a chave, 
    // MAS vamos dar uma chance para quem já está logado (opcional)
    if (chave !== 'al3m3r45') {
        // Se não tem a chave, manda embora
        //window.location.href = "/arcade"; // Volta pro sorteio
        // OU
        // window.location.href = "/"; // Volta pra sua página de links principal
        return; // Para o código aqui
    }

    // 2. Só depois de validar a chave, checamos a sessão do Supabase
    const { data: { session } } = await db.auth.getSession();

    if (session) {
        document.getElementById('tela-login').style.display = 'none';
        document.getElementById('conteudo-admin').style.display = 'block';
    } else {
        // Se não tem sessão, mostra a tela de login
        document.getElementById('tela-login').style.display = 'flex';
    }
});

// Logica para o botão de Logout
document.addEventListener('click', async (event) => {

    // ... (o seu código do botão de login continua aqui) ...

    // NOVO: Verifica se o clique foi no botão de logout
    if (event.target && event.target.id === 'btn-logout') {
        const confirmacao = confirm("Deseja realmente sair?");
        if (confirmacao) {
            await db.auth.signOut(); // Comando oficial do Supabase para encerrar a sessão
            location.reload(); // Recarrega a página para voltar à tela de login
        }
    }
});

async function exportarCSV() {
    const { data, error } = await db.from('sorteio').select('*');
    if (error) return alert("Erro ao exportar: " + error.message);

    // 1. Cabeçalho com ponto e vírgula
    let csv = 'ID;Nome;WhatsApp;Email;Status\n';

    data.forEach(row => {
        // Remove quebras de linha que poderiam quebrar o CSV
        const nome = (row.nome_comprador || '').replace(/"/g, '""').replace(/\n/g, ' ');
        const zap = (row.whatsapp || '').replace(/"/g, '""').replace(/\n/g, ' ');
        const email = (row.email || '').replace(/"/g, '""').replace(/\n/g, ' ');
        const cpf = (row.cpf || '').replace(/"/g, '""').replace(/\n/g, ' ');

        // 2. Linhas com ponto e vírgula
        csv += `"${row.id}";"${nome}";"${zap}";"${email}";"${row.status || ''}"\n`;
    });

    // 3. Adiciona o BOM (Byte Order Mark) para o Excel reconhecer acentos
    const bom = '\uFEFF';
    const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8;' });

    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `backup_sorteio_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
}

// --- INÍCIO DA INSERÇÃO: Motor de Replay ---
// const canalReplay = db.channel('canal_replay_alertas');
// canalReplay.subscribe();

// Adicionamos no 'window' para garantir que o botão no HTML consiga achar a função
window.dispararReplayNaLive = function (nomeComprador, mensagemLive) {

    // Limpa a tag de voz caso ela ainda exista no texto do banco
    let textoReal = mensagemLive || "Comprou e já garantiu a participação no sorteio!";
    if (textoReal.includes('|')) {
        textoReal = textoReal.split('|')[1].trim();
    }

    canalReplay.send({
        type: 'broadcast',
        event: 'forcar_alerta',
        payload: {
            nome: nomeComprador,
            mensagem: textoReal
        }
    });
}
// --- FIM DA INSERÇÃO ---


// --- FUNÇÃO PARA OCULTAR DADOS SENSÍVEIS (MÁSCARA DE CPF) ---
function mascararCPF(cpf) {
    if (!cpf || cpf === '000.000.000-00' || cpf === 'Não informado') return 'Não informado';
    const limpo = cpf.replace(/\D/g, '');
    if (limpo.length !== 11) return cpf; // Se vier fora do padrão, exibe original
    return `${limpo.substring(0, 3)}.***.***-${limpo.substring(9, 11)}`;
}


async function carregarVendas() {
    const { data, error } = await db
        .from('sorteio')
        .select('*')
        .eq('status', 'pago');

    if (error) return console.error(error);

    const vendasAgrupadas = data.reduce((acc, item) => {
        const chave = item.nome_comprador + item.whatsapp;
        if (!acc[chave]) {
            acc[chave] = { ...item, numeros: [item.id] };
        } else {
            acc[chave].numeros.push(item.id);
            if (item.cpf && !acc[chave].cpf) {
                acc[chave].cpf = item.cpf;
            }
        }
        return acc;
    }, {});

    const listaFinal = Object.values(vendasAgrupadas);

    listaFinal.sort((a, b) => {
        const nomeA = (a.nome_comprador || '').toLowerCase();
        const nomeB = (b.nome_comprador || '').toLowerCase();
        return nomeA.localeCompare(nomeB, 'pt-BR');
    });

    const tbody = document.getElementById('tabela-admin');
    tbody.innerHTML = listaFinal.map(item => `
        <tr>
            <td>${item.numeros.sort((a, b) => a - b).map(n => String(n).padStart(3, '0')).join(', ')}</td>
            <td>${item.nome_comprador}</td>
            <td>${item.whatsapp}</td>
            <td>${item.email}</td>
            <!-- CPF MASCARADO PARA MAIS SEGURANÇA -->
            <td>${mascararCPF(item.cpf)}</td>
            <td>${item.mensagem_live || ''}<button 
            onclick="dispararReplayNaLive('${item.nome_comprador}', '${item.mensagem_live || ''}')" 
            style="margin-left: 10px; cursor: pointer; background: #8257e5; color: white; border: none; border-radius: 4px; padding: 4px 8px; font-size: 0.8rem; vertical-align: middle;">
            🔄 Replay
        </button></td>
        </tr>
    `).join('');
}

carregarVendas();
verificarStatusKillSwitch();


// --- FUNÇÃO PARA CRIAR UM NOVO SORTEIO DO ZERO ---
async function gerarNovoSorteio() {
    if (!confirm("TEM CERTEZA? Isso deletará todo o histórico e criará um novo sorteio.")) return;

    // Captura o botão para animar o texto
    const btnGerar = event ? event.target : document.querySelector('button[onclick="gerarNovoSorteio()"]');
    const textoOriginal = btnGerar ? btnGerar.textContent : "GERAR NOVO SORTEIO";

    // 1. Captura com segurança absoluta os valores do formulário HTML
    const nome = document.getElementById('novo-nome').value.trim() || "Sorteio Oficial";

    const rawValor = document.getElementById('novo-valor').value || "1";
    let valorInput = parseFloat(rawValor.replace(/\./g, '').replace(',', '.'));
    if (isNaN(valorInput)) valorInput = 1.00;

    const qtd = parseInt(document.getElementById('nova-qtd').value) || 100;
    const novoEstado = document.getElementById('novo-estado').value || "Novo";
    const tempo = parseInt(document.getElementById('novo-tempo').value) || 10;

    // --- LÓGICA DE UPLOAD NOVO BANNER ---
    const inputBanner = document.getElementById('novo-banner');
    let urlBannerFinal = null;

    if (inputBanner && inputBanner.files.length > 0) {
        if (btnGerar) btnGerar.textContent = "Fazendo upload da imagem...";
        try {
            urlBannerFinal = await uploadBannerSupabase(inputBanner.files[0]);
        } catch (err) {
            if (btnGerar) btnGerar.textContent = textoOriginal;
            return alert(err.message);
        }
    }
    // ------------------------------------

    if (btnGerar) btnGerar.textContent = "Limpando e Gerando números...";
    //console.log("Gerando Sorteio -> Nome:", nome, "| Valor:", valorInput, "| Qtd:", qtd, "| Estado:", novoEstado, "| Tempo:", tempo);

    // 2. Limpa a tabela de sorteios antigos
    const { error: erroDelete } = await db.from('sorteio').delete().neq('id', 0);
    if (erroDelete) {
        if (btnGerar) btnGerar.textContent = textoOriginal;
        return alert("Erro ao limpar números: " + erroDelete.message);
    }

    // 3. Prepara e insere os novos números em lote
    const novosNumeros = [];
    for (let i = 1; i <= qtd; i++) {
        novosNumeros.push({ id: i, status: 'disponivel' });
    }

    const { error: erroInsert } = await db.from('sorteio').insert(novosNumeros);
    if (erroInsert) {
        if (btnGerar) btnGerar.textContent = textoOriginal;
        return alert("Erro ao gerar números: " + erroInsert.message);
    }

    // 4. Gera a data local exata de hoje (Fuso horário do Brasil)
    const hojeLocal = new Date();
    const ano = hojeLocal.getFullYear();
    const mes = String(hojeLocal.getMonth() + 1).padStart(2, '0');
    const dia = String(hojeLocal.getDate()).padStart(2, '0');
    const dataLocalFormatada = `${ano}-${mes}-${dia}T00:00:00.000Z`;

    // 5. Prepara os dados para salvar na tabela configuracoes
    const objNovoSorteio = {
        id: 1, // Força a linha 1
        nome_sorteio: nome,
        valor_numero: valorInput,
        tempo_pix_minutos: tempo,
        estado_produto: novoEstado,
        criado_em: dataLocalFormatada
    };

    // Só adiciona a coluna banner_url se a imagem tiver subido com sucesso (CORREÇÃO AQUI)
    if (urlBannerFinal) {
        objNovoSorteio.banner_url = urlBannerFinal;
    }

    // 6. Salva/Atualiza as configurações globais
    const { error: erroConfig } = await db.from('configuracoes').upsert(objNovoSorteio);

    if (erroConfig) {
        if (btnGerar) btnGerar.textContent = textoOriginal;
        return alert("Erro ao salvar config: " + erroConfig.message);
    }

    alert(`Sorteio '${nome}' reiniciado com sucesso! ${qtd} números disponíveis.`);
    // --- INSERIR AQUI PARA ATUALIZAR A TELA SEM PISCAR ---
    carregarStatusSorteio();
    carregarDadosParaEdicao();
    carregarVendas();
}

async function carregarStatusSorteio() {
    // 1. Busca configurações
    const { data: config } = await db.from('configuracoes').select('*').eq('id', 1).single();

    // 2. Busca contagem de números
    const { count: total } = await db.from('sorteio').select('*', { count: 'exact', head: true });
    const { count: disponiveis } = await db.from('sorteio').select('*', { count: 'exact', head: true }).eq('status', 'disponivel');

    // 3. Atualiza os campos na tela
    if (config) {
        document.getElementById('status-nome').textContent = config.nome_sorteio || "Não definido";
        document.getElementById('status-data').textContent = config.criado_em ? new Date(config.criado_em).toLocaleDateString('pt-BR') : "--/--/----";
        document.getElementById('status-valor').textContent = `R$ ${parseFloat(config.valor_numero).toFixed(2).replace('.', ',')}`;
        document.getElementById('status-tempo').textContent = config.tempo_pix_minutos;
        document.getElementById('status-estado').textContent = config.estado_produto || "Não definido"; // <-- LINHA INSERIDA AQUI
    }

    const vendidos = total - disponiveis;
    document.getElementById('status-qtd').textContent = `${vendidos} comprados / ${total} totais`;
}

// Chamar ao carregar o painel
carregarStatusSorteio();



// --- ATUALIZA A COR E O TEXTO DO BOTÃO KILL SWITCH ---
async function verificarStatusKillSwitch() {
    const { data, error } = await db.from('configuracoes').select('ativo').eq('id', 1).single();
    const btn = document.getElementById('btn-kill-switch');
    if (!btn) return;

    if (error) {
        console.error("Erro ao buscar status:", error);
        return;
    }

    if (data.ativo) {
        btn.textContent = "🟢 Sorteio ATIVO (Clique para Pausar)";
        btn.style.backgroundColor = "#00875f"; // Verde profissional
        btn.style.color = "#ffffff";
    } else {
        btn.textContent = "🔴 Sorteio PAUSADO (Clique para Ativar)";
        btn.style.backgroundColor = "#ff4747"; // Vermelho de alerta
        btn.style.color = "#ffffff";
    }
}

// --- FUNÇÃO KILL SWITCH (LIGA/DESLIGA SORTEIO) ---
async function alternarStatusSorteio() {
    const { data, error } = await db.from('configuracoes').select('ativo').eq('id', 1).single();
    if (error) return alert("Erro ao verificar status do sorteio.");

    const novoStatus = !data.ativo;

    const { error: erroUpdate } = await db.from('configuracoes')
        .update({ ativo: novoStatus })
        .eq('id', 1);

    if (erroUpdate) return alert("Erro ao alterar status: " + erroUpdate.message);

    // Atualiza o botão na hora e avisa
    verificarStatusKillSwitch();
    alert(novoStatus ? "✅ Sorteio LIGADO com sucesso!" : "🛑 Sorteio PAUSADO (Desligado do ar)!");
}

// --- FUNÇÃO KILL SWITCH (LIGA/DESLIGA SORTEIO) ---
async function alternarStatusSorteio() {
    // 1. Busca o status atual no banco
    const { data, error } = await db.from('configuracoes').select('ativo').eq('id', 1).single();
    if (error) return alert("Erro ao verificar status do sorteio.");

    const novoStatus = !data.ativo; // Inverte o valor (se tá true vira false, e vice-versa)

    // 2. Atualiza no banco
    const { error: erroUpdate } = await db.from('configuracoes')
        .update({ ativo: novoStatus })
        .eq('id', 1);

    if (erroUpdate) return alert("Erro ao alterar status: " + erroUpdate.message);

    alert(novoStatus ? "✅ Sorteio LIGADO com sucesso!" : "🛑 Sorteio PAUSADO (Desligado do ar)!");
    
    // --- INSERIR AQUI PARA ATUALIZAR A TELA SEM PISCAR ---
    verificarStatusKillSwitch();
    carregarStatusSorteio();
}

// --- CARREGA OS DADOS ATUAIS NOS INPUTS DE EDIÇÃO ---
async function carregarDadosParaEdicao() {
    const { data, error } = await db.from('configuracoes').select('*').eq('id', 1).single();
    // Busca a quantidade atual de números no banco
    const { count: totalNumeros } = await db.from('sorteio').select('*', { count: 'exact', head: true });

    if (error) return console.error("Erro ao carregar dados para edição:", error);

    if (data) {
        const inputNome = document.getElementById('edit-nome');
        const inputValor = document.getElementById('edit-valor');
        const inputEstado = document.getElementById('edit-estado');
        const inputTempo = document.getElementById('edit-tempo');
        const inputQtd = document.getElementById('edit-qtd');

        if (inputNome) inputNome.value = data.nome_sorteio || '';
        if (inputValor) inputValor.value = data.valor_numero ? String(data.valor_numero).replace('.', ',') : '';
        if (inputEstado) inputEstado.value = data.estado_produto || 'Novo';
        if (inputTempo) inputTempo.value = data.tempo_pix_minutos || 10;
        if (inputQtd) inputQtd.value = totalNumeros || 100;
        // --- INSERÇÃO ---
        const inputBanner = document.getElementById('edit-banner');
        if (inputBanner) inputBanner.value = data.banner_url || '';
        // ----------------
    }
}

// --- SALVA AS ALTERAÇÕES DO SORTEIO ATUAL SEM ZERAR ---
async function salvarEdicaoSorteio() {
    if (!confirm("Deseja atualizar as informações do sorteio atual?")) return;

    const nome = document.getElementById('edit-nome').value.trim() || "Sorteio Oficial";

    const rawValor = document.getElementById('edit-valor').value || "1";
    let valorInput = parseFloat(rawValor.replace(/\./g, '').replace(',', '.'));
    if (isNaN(valorInput)) valorInput = 1.00;

    const estado = document.getElementById('edit-estado').value || "Novo";
    const tempo = parseInt(document.getElementById('edit-tempo').value) || 10;
    const qtdNova = parseInt(document.getElementById('edit-qtd').value);

    // --- INÍCIO DA INSERÇÃO: LÓGICA DE UPLOAD EDIÇÃO BANNER ---
    const inputBannerEdit = document.getElementById('edit-banner');

    const objAtualizacao = {
        nome_sorteio: nome,
        valor_numero: valorInput,
        estado_produto: estado,
        tempo_pix_minutos: tempo
    };

    if (inputBannerEdit && inputBannerEdit.files.length > 0) {
        // Pega o botão para mostrar que está carregando
        const btnSalvar = event ? event.target : document.querySelector('button[onclick="salvarEdicaoSorteio()"]');
        if (btnSalvar) btnSalvar.textContent = "Fazendo upload...";

        try {
            // Usa a função de upload que você colocou no admin.js e anexa a URL no objeto
            objAtualizacao.banner_url = await uploadBannerSupabase(inputBannerEdit.files[0]);
        } catch (err) {
            if (btnSalvar) btnSalvar.textContent = "SALVAR ALTERAÇÕES";
            return alert(err.message);
        }
    }
    // --- FIM DA INSERÇÃO ---

    // 1. Atualiza as configurações no banco usando o objeto modificado
    const { error } = await db.from('configuracoes')
        .update(objAtualizacao)
        .eq('id', 1);

    if (error) {
        alert("Erro ao atualizar configurações: " + error.message);
        return;
    }

    // 2. Adiciona novos números se a quantidade foi aumentada
    if (qtdNova) {
        const { count: qtdAtual } = await db.from('sorteio').select('*', { count: 'exact', head: true });

        if (qtdNova > qtdAtual) {
            const novosNumeros = [];
            for (let i = qtdAtual + 1; i <= qtdNova; i++) {
                novosNumeros.push({ id: i, status: 'disponivel' });
            }

            const { error: erroInsert } = await db.from('sorteio').insert(novosNumeros);
            if (erroInsert) return alert("Erro ao criar novos números: " + erroInsert.message);
        } else if (qtdNova < qtdAtual) {
            alert("Aviso: A quantidade só pode ser aumentada. A diminuição foi ignorada para evitar exclusão de vendas.");
        }
    }

    alert("✅ Sorteio atualizado com sucesso!");
    // --- INSERIR AQUI PARA ATUALIZAR A TELA SEM PISCAR ---
    carregarStatusSorteio();
    carregarDadosParaEdicao();
}

// --- FUNÇÃO PARA UPAR IMAGEM NO SUPABASE STORAGE ---
async function uploadBannerSupabase(file) {
    const fileExt = file.name.split('.').pop();
    const fileName = `banner_${Date.now()}.${fileExt}`; // Cria um nome único com a data atual

    // 1. Faz o upload para o bucket 'banners'
    const { data, error } = await db.storage.from('banners').upload(fileName, file);
    if (error) throw new Error("Erro ao fazer upload da imagem: " + error.message);

    // 2. Pega o link público da imagem que acabou de subir
    const { data: publicUrlData } = db.storage.from('banners').getPublicUrl(fileName);
    return publicUrlData.publicUrl;
}


function aplicarMascaraMoeda(input) {
    let valor = input.value.replace(/\D/g, ''); // Remove tudo que não é número
    valor = (valor / 100).toFixed(2) + '';
    valor = valor.replace('.', ','); // Troca ponto por vírgula
    valor = valor.replace(/(\d)(\d{3})(\d{3}),/g, '$1.$2.$3,'); // Formata milhar
    valor = valor.replace(/(\d)(\d{3}),/g, '$1.$2,'); // Formata centena
    input.value = valor;
}
// --- FIM DA INSERÇÃO ---

setInterval(carregarStatusSorteio, 30000);