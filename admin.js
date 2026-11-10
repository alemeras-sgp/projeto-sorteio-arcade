// ==========================================
// 1. AUTENTICAÇÃO E SESSÃO (Resolve o bug do F5)
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const chave = urlParams.get('chave');

    if (chave !== 'al3m3r45') return;

    db.auth.onAuthStateChange((event, session) => {
        const telaLogin = document.getElementById('tela-login');
        const painelAdmin = document.getElementById('conteudo-admin');

        if (session) {
            telaLogin.style.display = 'none';
            painelAdmin.style.display = 'block';
        } else {
            telaLogin.style.display = 'flex';
            painelAdmin.style.display = 'none';
        }
    });
});

document.addEventListener('click', async (event) => {
    // Login
    if (event.target && event.target.id === 'btn-login-admin') {
        const inputEmail = document.getElementById('email-admin').value;
        const inputSenha = document.getElementById('senha-admin').value;
        const msgErro = document.getElementById('erro-login');

        if (!inputEmail || !inputSenha) return alert("Preencha e-mail e senha!");

        event.target.textContent = "Autenticando...";
        event.target.disabled = true;

        const { error } = await db.auth.signInWithPassword({ email: inputEmail, password: inputSenha });

        if (error) {
            msgErro.style.display = 'block';
            msgErro.textContent = "Erro: " + error.message;
            event.target.textContent = "Entrar no Painel";
            event.target.disabled = false;
        }
    }

    // Logout
    if (event.target && event.target.id === 'btn-logout') {
        if (confirm("Deseja realmente sair?")) {
            await db.auth.signOut();
            location.reload();
        }
    }
});


// ==========================================
// 2. SISTEMA DE LOADING GLOBAL (NOVO)
// ==========================================
function mostrarLoading(mensagem) {
    let overlay = document.getElementById('loading-overlay-global');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'loading-overlay-global';
        overlay.innerHTML = `
            <style>
                #loading-overlay-global {
                    position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
                    background: rgba(15, 15, 18, 0.9);
                    backdrop-filter: blur(8px);
                    z-index: 999999;
                    display: flex; flex-direction: column; justify-content: center; align-items: center;
                    color: #ffffff;
                }
                .spinner-arcade {
                    width: 70px; height: 70px;
                    border: 8px solid rgba(130, 87, 229, 0.2);
                    border-top-color: #8257e5;
                    border-radius: 50%;
                    animation: spin 1s linear infinite;
                    margin-bottom: 25px;
                    box-shadow: 0 0 20px rgba(130, 87, 229, 0.5);
                }
                @keyframes spin { 100% { transform: rotate(360deg); } }
                #loading-msg-global {
                    font-size: 1.5rem; font-weight: bold; text-transform: uppercase; letter-spacing: 1px;
                    text-shadow: 0 2px 10px rgba(0,0,0,0.8);
                }
            </style>
            <div class="spinner-arcade"></div>
            <div id="loading-msg-global">${mensagem}</div>
        `;
        document.body.appendChild(overlay);
    } else {
        document.getElementById('loading-msg-global').textContent = mensagem;
        overlay.style.display = 'flex';
    }
}

function esconderLoading() {
    const overlay = document.getElementById('loading-overlay-global');
    if (overlay) overlay.style.display = 'none';
}


// ==========================================
// 3. MOTOR DE REPLAY ESTÁVEL
// ==========================================
const canalReplay = db.channel('canal_replay_alertas');
canalReplay.subscribe();

window.dispararReplayNaLive = async function (nomeComprador, mensagemLive) {
    let textoReal = mensagemLive || "Comprou e já garantiu a participação no sorteio!";
    if (textoReal.includes('|')) {
        textoReal = textoReal.split('|')[1].trim();
    }

    await canalReplay.send({
        type: 'broadcast',
        event: 'forcar_alerta',
        payload: { nome: nomeComprador, mensagem: textoReal }
    });

    console.log("Replay disparado com sucesso para:", nomeComprador);
}


// ==========================================
// 4. FUNÇÕES DE EXIBIÇÃO E FORMATAÇÃO
// ==========================================
function mascararCPF(cpf) {
    if (!cpf || cpf === '000.000.000-00' || cpf === 'Não informado') return 'Não informado';
    const limpo = cpf.replace(/\D/g, '');
    if (limpo.length !== 11) return cpf;
    return `${limpo.substring(0, 3)}.***.***-${limpo.substring(9, 11)}`;
}

function aplicarMascaraMoeda(input) {
    let valor = input.value.replace(/\D/g, '');
    valor = (valor / 100).toFixed(2) + '';
    valor = valor.replace('.', ',');
    valor = valor.replace(/(\d)(\d{3})(\d{3}),/g, '$1.$2.$3,');
    valor = valor.replace(/(\d)(\d{3}),/g, '$1.$2,');
    input.value = valor;
}

async function carregarVendas() {
    const { data, error } = await db.from('sorteio').select('*').eq('status', 'pago');
    if (error) return console.error(error);

    const vendasAgrupadas = data.reduce((acc, item) => {
        const chave = item.nome_comprador + item.whatsapp;
        if (!acc[chave]) {
            acc[chave] = { ...item, numeros: [item.id] };
        } else {
            acc[chave].numeros.push(item.id);
            if (item.cpf && !acc[chave].cpf) acc[chave].cpf = item.cpf;
        }
        return acc;
    }, {});

    const listaFinal = Object.values(vendasAgrupadas).sort((a, b) => 
        (a.nome_comprador || '').toLowerCase().localeCompare((b.nome_comprador || '').toLowerCase(), 'pt-BR')
    );

    const tbody = document.getElementById('tabela-admin');
    tbody.innerHTML = listaFinal.map(item => `
        <tr>
            <td>${item.numeros.sort((a, b) => a - b).map(n => String(n).padStart(3, '0')).join(', ')}</td>
            <td>${item.nome_comprador}</td>
            <td>${item.whatsapp}</td>
            <td>${item.email}</td>
            <td>${mascararCPF(item.cpf)}</td>
            <td>${item.mensagem_live || ''}<button 
            onclick="dispararReplayNaLive('${item.nome_comprador}', '${item.mensagem_live || ''}')" 
            style="margin-left: 10px; cursor: pointer; background: #8257e5; color: white; border: none; border-radius: 4px; padding: 4px 8px; font-size: 0.8rem; vertical-align: middle;">
            🔄 Replay</button></td>
        </tr>
    `).join('');
}


// ==========================================
// 5. GESTÃO DO SORTEIO (STATUS, CRIAR, EDITAR)
// ==========================================
async function carregarStatusSorteio() {
    const { data: config } = await db.from('configuracoes').select('*').eq('id', 1).single();
    const { count: total } = await db.from('sorteio').select('*', { count: 'exact', head: true });
    const { count: disponiveis } = await db.from('sorteio').select('*', { count: 'exact', head: true }).eq('status', 'disponivel');

    if (config) {
        document.getElementById('status-nome').textContent = config.nome_sorteio || "Não definido";
        document.getElementById('status-data').textContent = config.criado_em ? new Date(config.criado_em).toLocaleDateString('pt-BR') : "--/--/----";
        document.getElementById('status-valor').textContent = `R$ ${parseFloat(config.valor_numero).toFixed(2).replace('.', ',')}`;
        document.getElementById('status-tempo').textContent = config.tempo_pix_minutos;
        document.getElementById('status-estado').textContent = config.estado_produto || "Não definido";
    }

    const vendidos = total - disponiveis;
    if (document.getElementById('status-qtd')) {
        document.getElementById('status-qtd').textContent = `${vendidos} comprados / ${total} totais`;
    }
}

async function verificarStatusKillSwitch() {
    const { data, error } = await db.from('configuracoes').select('ativo').eq('id', 1).single();
    const btn = document.getElementById('btn-kill-switch');
    if (!btn || error) return;

    if (data.ativo) {
        btn.textContent = "🟢 Sorteio ATIVO (Clique para Pausar)";
        btn.style.backgroundColor = "#00875f";
        btn.style.color = "#ffffff";
    } else {
        btn.textContent = "🔴 Sorteio PAUSADO (Clique para Ativar)";
        btn.style.backgroundColor = "#ff4747";
        btn.style.color = "#ffffff";
    }
}

async function alternarStatusSorteio() {
    const { data, error } = await db.from('configuracoes').select('ativo').eq('id', 1).single();
    if (error) return alert("Erro ao verificar status do sorteio.");

    const novoStatus = !data.ativo;
    const { error: erroUpdate } = await db.from('configuracoes').update({ ativo: novoStatus }).eq('id', 1);
    if (erroUpdate) return alert("Erro ao alterar status: " + erroUpdate.message);

    alert(novoStatus ? "✅ Sorteio LIGADO com sucesso!" : "🛑 Sorteio PAUSADO (Desligado do ar)!");
    verificarStatusKillSwitch();
    carregarStatusSorteio();
}

async function carregarDadosParaEdicao() {
    const { data, error } = await db.from('configuracoes').select('*').eq('id', 1).single();
    const { count: totalNumeros } = await db.from('sorteio').select('*', { count: 'exact', head: true });

    if (error) return console.error(error);
    if (data) {
        const inputNome = document.getElementById('edit-nome');
        const inputValor = document.getElementById('edit-valor');
        const inputEstado = document.getElementById('edit-estado');
        const inputTempo = document.getElementById('edit-tempo');
        const inputQtd = document.getElementById('edit-qtd');
        const inputBanner = document.getElementById('edit-banner');

        if (inputNome) inputNome.value = data.nome_sorteio || '';
        if (inputValor) inputValor.value = data.valor_numero ? String(data.valor_numero).replace('.', ',') : '';
        if (inputEstado) inputEstado.value = data.estado_produto || 'Novo';
        if (inputTempo) inputTempo.value = data.tempo_pix_minutos || 10;
        if (inputQtd) inputQtd.value = totalNumeros || 100;
        if (inputBanner) inputBanner.value = ''; // Limpa o input de arquivo
    }
}

async function uploadBannerSupabase(file) {
    const fileExt = file.name.split('.').pop();
    const fileName = `banner_${Date.now()}.${fileExt}`;
    const { data, error } = await db.storage.from('banners').upload(fileName, file);
    if (error) throw new Error("Erro ao fazer upload: " + error.message);
    const { data: publicUrlData } = db.storage.from('banners').getPublicUrl(fileName);
    return publicUrlData.publicUrl;
}

// Funções com o Novo Loading Global Integrado
async function gerarNovoSorteio() {
    if (!confirm("TEM CERTEZA? Isso deletará todo o histórico e criará um novo sorteio.")) return;
    mostrarLoading("⏳ Iniciando novo sorteio...");

    try {
        const nome = document.getElementById('novo-nome').value.trim() || "Sorteio Oficial";
        const rawValor = document.getElementById('novo-valor').value || "1";
        let valorInput = parseFloat(rawValor.replace(/\./g, '').replace(',', '.'));
        if (isNaN(valorInput)) valorInput = 1.00;

        const qtd = parseInt(document.getElementById('nova-qtd').value) || 100;
        const novoEstado = document.getElementById('novo-estado').value || "Novo";
        const tempo = parseInt(document.getElementById('novo-tempo').value) || 10;
        const inputBanner = document.getElementById('novo-banner');
        let urlBannerFinal = null;

        if (inputBanner && inputBanner.files.length > 0) {
            mostrarLoading("⏳ Fazendo upload do novo banner...");
            urlBannerFinal = await uploadBannerSupabase(inputBanner.files[0]);
        }

        mostrarLoading("⏳ Limpando banco e gerando números...");
        const { error: erroDelete } = await db.from('sorteio').delete().neq('id', 0);
        if (erroDelete) throw new Error(erroDelete.message);

        const novosNumeros = [];
        for (let i = 1; i <= qtd; i++) novosNumeros.push({ id: i, status: 'disponivel' });

        const { error: erroInsert } = await db.from('sorteio').insert(novosNumeros);
        if (erroInsert) throw new Error(erroInsert.message);

        const hojeLocal = new Date();
        const ano = hojeLocal.getFullYear();
        const mes = String(hojeLocal.getMonth() + 1).padStart(2, '0');
        const dia = String(hojeLocal.getDate()).padStart(2, '0');
        
        const objNovoSorteio = {
            id: 1, nome_sorteio: nome, valor_numero: valorInput, 
            tempo_pix_minutos: tempo, estado_produto: novoEstado, 
            criado_em: `${ano}-${mes}-${dia}T00:00:00.000Z`
        };
        if (urlBannerFinal) objNovoSorteio.banner_url = urlBannerFinal;

        const { error: erroConfig } = await db.from('configuracoes').upsert(objNovoSorteio);
        if (erroConfig) throw new Error(erroConfig.message);

        alert(`✅ Sorteio '${nome}' reiniciado com sucesso!`);
        carregarStatusSorteio(); carregarDadosParaEdicao(); carregarVendas();
    } catch (erro) {
        alert("Erro: " + erro.message);
    } finally {
        esconderLoading();
    }
}

async function salvarEdicaoSorteio() {
    if (!confirm("Deseja atualizar as informações do sorteio atual?")) return;
    mostrarLoading("⏳ Atualizando configurações...");

    try {
        const nome = document.getElementById('edit-nome').value.trim() || "Sorteio Oficial";
        const rawValor = document.getElementById('edit-valor').value || "1";
        let valorInput = parseFloat(rawValor.replace(/\./g, '').replace(',', '.'));
        if (isNaN(valorInput)) valorInput = 1.00;

        const estado = document.getElementById('edit-estado').value || "Novo";
        const tempo = parseInt(document.getElementById('edit-tempo').value) || 10;
        const qtdNova = parseInt(document.getElementById('edit-qtd').value);
        const inputBannerEdit = document.getElementById('edit-banner');

        const objAtualizacao = { nome_sorteio: nome, valor_numero: valorInput, estado_produto: estado, tempo_pix_minutos: tempo };

        if (inputBannerEdit && inputBannerEdit.files.length > 0) {
            mostrarLoading("⏳ Fazendo upload da imagem...");
            objAtualizacao.banner_url = await uploadBannerSupabase(inputBannerEdit.files[0]);
        }

        mostrarLoading("⏳ Salvando no banco de dados...");
        const { error } = await db.from('configuracoes').update(objAtualizacao).eq('id', 1);
        if (error) throw new Error(error.message);

        if (qtdNova) {
            const { count: qtdAtual } = await db.from('sorteio').select('*', { count: 'exact', head: true });
            if (qtdNova > qtdAtual) {
                mostrarLoading("⏳ Gerando novos números...");
                const novosNumeros = [];
                for (let i = qtdAtual + 1; i <= qtdNova; i++) novosNumeros.push({ id: i, status: 'disponivel' });
                const { error: erroInsert } = await db.from('sorteio').insert(novosNumeros);
                if (erroInsert) throw new Error(erroInsert.message);
            }
        }

        alert("✅ Sorteio atualizado com sucesso!");
        carregarStatusSorteio(); carregarDadosParaEdicao();
    } catch (erro) {
        alert("Erro: " + erro.message);
    } finally {
        esconderLoading();
    }
}


// ==========================================
// 6. EXPORTAÇÃO E INICIALIZAÇÃO
// ==========================================
async function exportarCSV() {
    const { data, error } = await db.from('sorteio').select('*');
    if (error) return alert("Erro ao exportar: " + error.message);

    let csv = 'ID;Nome;WhatsApp;Email;Status\n';
    data.forEach(row => {
        const nome = (row.nome_comprador || '').replace(/"/g, '""').replace(/\n/g, ' ');
        const zap = (row.whatsapp || '').replace(/"/g, '""').replace(/\n/g, ' ');
        const email = (row.email || '').replace(/"/g, '""').replace(/\n/g, ' ');
        csv += `"${row.id}";"${nome}";"${zap}";"${email}";"${row.status || ''}"\n`;
    });

    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `backup_sorteio_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
}


// --- CARREGAR DADOS DO VENCEDOR NO PAINEL ADMIN ---
async function carregarDadosVencedorParaEdicao() {
    const { data, error } = await db.from('configuracoes').select('nome_vencedor, numero_vencedor').eq('id', 1).single();
    if (error) return console.error("Erro ao carregar vencedor:", error);

    if (data) {
        const inputNomeVencedor = document.getElementById('input-nome-vencedor');
        const inputNumeroVencedor = document.getElementById('input-numero-vencedor');

        if (inputNomeVencedor) inputNomeVencedor.value = data.nome_vencedor || '';
        if (inputNumeroVencedor) inputNumeroVencedor.value = data.numero_vencedor || '';
    }
}

// Chame essa função junto com as outras inicializações do admin (logo abaixo de carregarDadosParaEdicao())
carregarDadosVencedorParaEdicao();


// --- SALVAR OU LIMPAR O VENCEDOR NO BANCO ---
async function salvarVencedor() {
    const inputNome = document.getElementById('input-nome-vencedor');
    const inputNumero = document.getElementById('input-numero-vencedor');

    const nomeVencedor = inputNome ? inputNome.value.trim() : "";
    const numeroVencedor = inputNumero ? inputNumero.value.trim() : "";

    // Se ambos estiverem vazios, entendemos que o usuário quer REMOVER o vencedor
    const apagandoDados = (!nomeVencedor && !numeroVencedor);

    if (!apagandoDados && (!nomeVencedor || !numeroVencedor)) {
        return alert("Preencha ambos os campos (Nome e Número) ou deixe os dois totalmente vazios para remover o vencedor.");
    }

    const mensagemConfirmacao = apagandoDados 
        ? "Deseja remover/limpar o vencedor atual do site?" 
        : `Confirmar que o vencedor é ${nomeVencedor} com o número ${numeroVencedor}?`;

    if (!confirm(mensagemConfirmacao)) return;

    mostrarLoading(apagandoDados ? "⏳ Removendo vencedor..." : "⏳ Salvando dados do vencedor...");

    try {
        // Se estiver apagando, enviamos null para o Supabase limpar de verdade a linha
        const dadosParaSalvar = apagandoDados ? {
            nome_vencedor: null,
            numero_vencedor: null
        } : {
            nome_vencedor: nomeVencedor,
            numero_vencedor: numeroVencedor
        };

        const { error } = await db.from('configuracoes')
            .update(dadosParaSalvar)
            .eq('id', 1);

        if (error) throw new Error(error.message);

        alert(apagandoDados ? "🧹 Vencedor removido com sucesso do site!" : "🏆 Vencedor salvo com sucesso!");
        
        // Limpa a memória de sessão para o modal aparecer de novo se cadastrar outro
        sessionStorage.removeItem('modal_vencedor_fechado');
        
        carregarDadosVencedorParaEdicao();
    } catch (err) {
        alert("Erro ao salvar vencedor: " + err.message);
    } finally {
        esconderLoading();
    }
}

// Inicia as chamadas ao abrir a página
carregarVendas();
verificarStatusKillSwitch();
carregarStatusSorteio();
setInterval(carregarStatusSorteio, 30000);