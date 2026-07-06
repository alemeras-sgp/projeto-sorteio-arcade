// Conexão rápida (use as mesmas chaves do seu script.js)
const supabaseUrl = "https://wfnimuncbyvfglhbqjtj.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndmbmltdW5jYnl2ZmdsaGJxanRqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2MTkwMzIsImV4cCI6MjA5NjE5NTAzMn0.Q9GD87K1hQ0IYzN0sXuKOUWBvbXT9-K0DhWorIJwDdw";
const db = supabase.createClient(supabaseUrl, supabaseKey);

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

    // Substitua a linha atual por esta:
    const valorInput = parseFloat(document.getElementById('novo-valor').value.replace(',', '.'));
    const qtd = parseInt(document.getElementById('nova-qtd').value);

    // 1. Limpa a tabela de sorteios
    const { error: erroDelete } = await db.from('sorteio').delete().neq('id', 0); // Deleta tudo
    if (erroDelete) return alert("Erro ao limpar: " + erroDelete.message);

    // 2. Prepara os novos números
    const novosNumeros = [];
    for (let i = 1; i <= qtd; i++) {
        novosNumeros.push({ id: i, status: 'disponivel' });
    }

    // 3. Insere em lote
    const { error: erroInsert } = await db.from('sorteio').insert(novosNumeros);
    if (erroInsert) return alert("Erro ao gerar: " + erroInsert.message);

    // Dentro da sua função gerarNovoSorteio(), adicione essa linha antes do alert:
    await db.from('configuracoes').update({ valor_numero: valorInput }).eq('id', 1);


    alert("Sorteio reiniciado com sucesso! " + qtd + " números disponíveis.");
    location.reload(); // Atualiza a página para mostrar a tabela vazia
}
// --- FIM DA INSERÇÃO ---