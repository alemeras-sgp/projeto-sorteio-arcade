// Removemos qualquer listener antigo e usamos um único que monitora o documento inteiro
document.addEventListener('click', async (event) => {
    
    // Verifica se o elemento clicado é o nosso botão de login
    if (event.target && event.target.id === 'btn-login-admin') {
        console.log("Clique capturado no botão de login!");

        const inputEmail = document.getElementById('email-admin').value;
        const inputSenha = document.getElementById('senha-admin').value;
        const msgErro = document.getElementById('erro-login');
        const telaLogin = document.getElementById('tela-login');
        const painelAdmin = document.getElementById('conteudo-admin');

        // Validação básica
        if(!inputEmail || !inputSenha) {
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
                console.log("Sucesso!");
                telaLogin.style.display = 'none';
                painelAdmin.style.display = 'block';
            }
        } catch (e) {
            console.error("Erro inesperado:", e);
        }
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
    if (error) return alert("Erro ao exportar");

    // Converte JSON para CSV
    let csv = 'ID,Nome,WhatsApp,Email,Status\n';
    data.forEach(row => {
        csv += `${row.id},${row.nome_comprador || ''},${row.whatsapp || ''},${row.email || ''},${row.status || ''}\n`;
    });

    // Cria o link de download
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `backup_sorteio_${new Date().toLocaleDateString()}.csv`;
    a.click();
}

// --- INÍCIO DA INSERÇÃO: Motor de Replay ---
const canalReplay = db.channel('canal_replay_alertas');
canalReplay.subscribe();

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



async function carregarVendas() {
    const { data, error } = await db
        .from('sorteio')
        .select('*')
        .eq('status', 'pago');

    if (error) return console.error(error);

    // Lógica para agrupar números do mesmo comprador
    const vendasAgrupadas = data.reduce((acc, item) => {
        const chave = item.nome_comprador + item.whatsapp; // Identificador único
        if (!acc[chave]) {
            acc[chave] = { ...item, numeros: [item.id] };
        } else {
            acc[chave].numeros.push(item.id);
        }
        return acc;
    }, {});

    const listaFinal = Object.values(vendasAgrupadas);

    const tbody = document.getElementById('tabela-admin');
    tbody.innerHTML = listaFinal.map(item => `
        <tr>
            <td>${item.numeros.sort((a, b) => a - b).map(n => String(n).padStart(3, '0')).join(', ')}</td>
            <td>${item.nome_comprador}</td>
            <td>${item.whatsapp}</td>
            <td>${item.email}</td>
            <td>${item.mensagem_live || ''}<button 
        onclick="dispararReplayNaLive('${item.nome_comprador}', '${item.mensagem_live || ''}')" 
        style="margin-left: 10px; cursor: pointer; background: #8257e5; color: white; border: none; border-radius: 4px; padding: 4px 8px; font-size: 0.8rem; vertical-align: middle;">
        🔄 Replay
    </button></td>
        </tr>
    `).join('');
}

carregarVendas();


// --- INÍCIO DA INSERÇÃO: Motor de Reset ---
async function gerarNovoSorteio() {
    if (!confirm("TEM CERTEZA? Isso deletará todo o histórico e criará um novo sorteio.")) return;

    // 1. Captura e limpa os valores do formulário
    let valorInput = parseFloat(document.getElementById('novo-valor').value
        .replace(/\./g, '')  // Remove os pontos de milhar
        .replace(',', '.')   // Troca a vírgula por ponto decimal
    );
    const qtd = parseInt(document.getElementById('nova-qtd').value);
    const tempo = parseInt(document.getElementById('novo-tempo').value);
    const nome = document.getElementById('novo-nome').value;
    const novoEstado = document.getElementById('novo-estado').value;

    // 2. Limpa a tabela de sorteios
    const { error: erroDelete } = await db.from('sorteio').delete().neq('id', 0);
    if (erroDelete) return alert("Erro ao limpar números: " + erroDelete.message);

    // 3. Prepara e insere os novos números em lote
    const novosNumeros = [];
    for (let i = 1; i <= qtd; i++) {
        novosNumeros.push({ id: i, status: 'disponivel' });
    }

    const { error: erroInsert } = await db.from('sorteio').insert(novosNumeros);
    if (erroInsert) return alert("Erro ao gerar números: " + erroInsert.message);

    // 4. Atualiza as configurações globais do sorteio
    const { error: erroConfig } = await db.from('configuracoes').update({
        nome_sorteio: nome,
        valor_numero: valorInput,
        tempo_pix_minutos: tempo,
        estado_produto: novoEstado, // <-- LINHA INSERIDA AQUI
        criado_em: new Date().toISOString()
    }).eq('id', 1);

    if (erroConfig) return alert("Erro ao salvar config: " + erroConfig.message);

    alert("Sorteio '" + nome + "' reiniciado com sucesso! " + qtd + " números disponíveis.");
    location.reload();
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